package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SyncWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    private val gson = Gson()

    private fun getEncryptedSharedPreferences(): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            "EncryptedAppPrefs",
            masterKeyAlias,
            applicationContext,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    override suspend fun doWork(): Result {
        ConsoleLogger.log("SyncWorker spuštěn.")

        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = getEncryptedSharedPreferences()

        val sessionCookie = sharedPrefs.getString("session_cookie", null)?.split(";")?.firstOrNull()
        val baseUrl = sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
        val clientType = sharedPrefs.getString("client_type", "APK") ?: "APK"

        if (sessionCookie.isNullOrBlank()) {
            ConsoleLogger.log("SyncWorker: chybí session cookie, synchronizace přeskočena.")
            return Result.success()
        }

        val batchSize = 50
        var continueSync = true

        while (continueSync) {
            val cachedLocations = dao.getLocationsBatch(batchSize)
            if (cachedLocations.isEmpty()) {
                ConsoleLogger.log("SyncWorker: žádné pozice k odeslání.")
                break
            }

            ConsoleLogger.log("SyncWorker: nalezena dávka ${cachedLocations.size} pozic k odeslání.")

            val payload = JSONArray()
            val idsToDelete = mutableListOf<Int>()

            cachedLocations.forEach { location ->
                val jsonObject = JSONObject().apply {
                    put("device", location.deviceId)
                    put("name", location.deviceName)
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("speed", location.speed)
                    put("altitude", location.altitude)
                    put("accuracy", location.accuracy)
                    put("satellites", location.satellites)
                    put("power_status", location.powerStatus)
                    put("client_type", clientType)
                    put("timestamp", formatTimestamp(location.timestamp))
                }
                payload.put(jsonObject)
                idsToDelete.add(location.id)
            }

            try {
                val responseBody = postBatch(baseUrl, sessionCookie, payload)
                val response = parseResponse(responseBody)

                if (!response.success) {
                    ConsoleLogger.log("SyncWorker: server vrátil success=false (${response.message ?: "bez detailu"}).")
                    return Result.retry()
                }

                continueSync = handleServerResponse(sharedPrefs, response)
                dao.deleteLocationsByIds(idsToDelete)
                ConsoleLogger.log("SyncWorker: dávka ${idsToDelete.size} pozic odeslána a odstraněna z cache.")
            } catch (ex: RecoverableSyncException) {
                ConsoleLogger.log("SyncWorker: obnovitelná chyba (${ex.message}). Úloha bude zopakována.")
                return Result.retry()
            } catch (ex: UnauthorizedException) {
                ConsoleLogger.log("SyncWorker: neautorizovaný přístup (${ex.message}).")
                handleUnauthorized()
                return Result.failure()
            } catch (ex: Exception) {
                ConsoleLogger.log("SyncWorker: neočekávaná chyba: ${ex.message}")
                return Result.retry()
            }
        }

        return Result.success()
    }

    private fun postBatch(baseUrl: String, sessionCookie: String, payload: JSONArray): String {
        val url = URL("$baseUrl/api/devices/input")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Cookie", sessionCookie)
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
        }

        try {
            BufferedWriter(OutputStreamWriter(connection.outputStream, Charsets.UTF_8)).use { writer ->
                writer.write(payload.toString())
            }

            val responseCode = connection.responseCode
            val stream = if (responseCode < 400) connection.inputStream else connection.errorStream
            val responseBody = stream?.let {
                BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader -> reader.readText() }
            } ?: ""

            when {
                responseCode == HttpURLConnection.HTTP_UNAUTHORIZED || responseCode == HttpURLConnection.HTTP_FORBIDDEN ->
                    throw UnauthorizedException("HTTP $responseCode: $responseBody")
                responseCode >= 500 -> throw RecoverableSyncException("HTTP $responseCode: $responseBody")
                responseCode >= 400 -> throw Exception("HTTP $responseCode: $responseBody")
            }

            return responseBody
        } finally {
            connection.disconnect()
        }
    }

    private fun parseResponse(responseBody: String): ServerResponse {
        return try {
            gson.fromJson(responseBody, ServerResponse::class.java)
        } catch (ex: JsonSyntaxException) {
            throw RecoverableSyncException("Neplatná odpověď serveru (${ex.message})")
        }
    }

    private fun handleServerResponse(
        sharedPrefs: SharedPreferences,
        response: ServerResponse
    ): Boolean {
        val editor = sharedPrefs.edit()
        var settingsChanged = false

        response.interval_gps?.let { intervalGps ->
            if (sharedPrefs.getInt("gps_interval_seconds", 60) != intervalGps) {
                editor.putInt("gps_interval_seconds", intervalGps)
                settingsChanged = true
                ConsoleLogger.log("SyncWorker: aktualizován interval GPS na ${intervalGps}s.")
            }
        }

        response.interval_send?.let { intervalSend ->
            if (sharedPrefs.getInt("sync_interval_count", 1) != intervalSend) {
                editor.putInt("sync_interval_count", intervalSend)
                settingsChanged = true
                ConsoleLogger.log("SyncWorker: aktualizován interval odesílání na ${intervalSend} pozic.")
            }
        }

        if (settingsChanged) {
            editor.apply()
            restartLocationServiceIfActive()
        } else {
            editor.apply()
        }

        return applyPowerInstruction(response.power_instruction)
    }

    private fun restartLocationServiceIfActive() {
        if (SharedPreferencesHelper.getPowerState(applicationContext) == PowerState.OFF) {
            ConsoleLogger.log("SyncWorker: konfigurace změněna, ale služba je vypnutá. Restart se neprovádí.")
            return
        }

        ConsoleLogger.log("SyncWorker: restartuji LocationService pro aplikaci nové konfigurace.")
        val serviceIntent = Intent(applicationContext, LocationService::class.java)
        applicationContext.stopService(serviceIntent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(serviceIntent)
        } else {
            applicationContext.startService(serviceIntent)
        }
    }

    private fun applyPowerInstruction(instruction: String?): Boolean {
        return when (instruction?.uppercase(Locale.US)) {
            "TURN_OFF" -> {
                val wasOn = SharedPreferencesHelper.getPowerState(applicationContext) != PowerState.OFF
                ConsoleLogger.log("SyncWorker: server požaduje vypnutí služby.")
                SharedPreferencesHelper.setPowerState(applicationContext, PowerState.OFF)
                applicationContext.stopService(Intent(applicationContext, LocationService::class.java))

                val stateJson = gson.toJson(
                    ServiceState(
                        isRunning = false,
                        statusMessage = StatusMessages.SERVICE_STOPPED,
                        connectionStatus = "Vypnuto na základě instrukce serveru",
                        nextUpdateTimestamp = 0,
                        cachedCount = 0,
                        powerStatus = PowerState.OFF.toString()
                    )
                )

                val statusIntent = Intent(LocationService.ACTION_BROADCAST_STATUS).apply {
                    putExtra(LocationService.EXTRA_SERVICE_STATE, stateJson)
                }
                LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(statusIntent)

                if (wasOn) {
                    ConsoleLogger.log("SyncWorker: odesílám potvrzení o vypnutí.")
                    HandshakeManager.launchHandshake(applicationContext, reason = "sync_turn_off")
                    HandshakeManager.enqueueHandshakeWork(applicationContext)
                }
                false
            }
            else -> true
        }
    }

    private fun handleUnauthorized() {
        SharedPreferencesHelper.setPowerState(applicationContext, PowerState.OFF)
        applicationContext.stopService(Intent(applicationContext, LocationService::class.java))

        val logoutIntent = Intent(LocationService.ACTION_FORCE_LOGOUT).apply {
            putExtra(
                LocationService.EXTRA_LOGOUT_MESSAGE,
                "Session je neplatná. Přihlaste se prosím znovu."
            )
        }
        applicationContext.sendBroadcast(logoutIntent)
    }

    private fun formatTimestamp(timestamp: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(timestamp))
    }

    private class RecoverableSyncException(message: String) : Exception(message)

    private class UnauthorizedException(message: String) : Exception(message)
}
