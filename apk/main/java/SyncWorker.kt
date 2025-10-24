package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

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
        val batchSize = 50

        while (true) {
            val cachedLocations = dao.getLocationsBatch(batchSize)
            if (cachedLocations.isEmpty()) {
                ConsoleLogger.log("Žádné další pozice k synchronizaci.")
                break
            }

            ConsoleLogger.log("Nalezeno ${cachedLocations.size} pozic k synchronizaci v této dávce.")

            try {
                val jsonArray = JSONArray()
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
                        put("timestamp", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                            timeZone = java.util.TimeZone.getTimeZone("UTC")
                        }.format(java.util.Date(location.timestamp)))
                    }
                    jsonArray.put(jsonObject)
                }

                val url = URL("${BuildConfig.API_BASE_URL}/api/devices/input")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 30000
                connection.readTimeout = 30000

                val sharedPrefs = getEncryptedSharedPreferences()
                sharedPrefs.getString("session_cookie", null)?.let {
                    connection.setRequestProperty("Cookie", it.split(";")[0])
                }

                val payload = jsonArray.toString()
                ConsoleLogger.log("Odesílám dávku dat na server...")

                connection.outputStream.use { os ->
                    val input = payload.toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = connection.responseCode
                val responseBody = try {
                    val reader = BufferedReader(InputStreamReader(if (responseCode < 400) connection.inputStream else connection.errorStream))
                    reader.readText()
                } catch (e: Exception) {
                    ConsoleLogger.log("Chyba při čtení odpovědi od serveru: ${e.message}")
                    return Result.retry()
                }

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    ConsoleLogger.log("Odpověď serveru: OK ($responseCode)")
                    if (cachedLocations.size > 10) { // Only update settings if clearing a backlog
                        try {
                            val serverResponse = gson.fromJson(responseBody, ServerResponse::class.java)
                            if (serverResponse.success) {
                                val editor = sharedPrefs.edit()
                                var settingsChanged = false
                                serverResponse.interval_gps?.let {
                                    if (sharedPrefs.getInt("gps_interval_seconds", 60) != it) {
                                        editor.putInt("gps_interval_seconds", it)
                                        settingsChanged = true
                                        ConsoleLogger.log("Aktualizován interval GPS na: ${it}s")
                                    }
                                }
                                serverResponse.interval_send?.let {
                                    if (sharedPrefs.getInt("sync_interval_count", 1) != it) {
                                        editor.putInt("sync_interval_count", it)
                                        settingsChanged = true
                                        ConsoleLogger.log("Aktualizován interval odeslání na: ${it} pozic")
                                    }
                                }
                                if (settingsChanged) {
                                    editor.apply()
                                    ConsoleLogger.log("Restartuji službu pro aplikaci nového nastavení.")
                                    val serviceIntent = Intent(applicationContext, LocationService::class.java)
                                    applicationContext.stopService(serviceIntent)
                                    applicationContext.startService(serviceIntent)
                                }
                            }
                        } catch (e: JsonSyntaxException) {
                            ConsoleLogger.log("Chyba při parsování odpovědi serveru: ${e.message}")
                        }
                    }

                    val idsToDelete = cachedLocations.map { it.id }
                    dao.deleteLocationsByIds(idsToDelete)
                    ConsoleLogger.log("Vymazáno ${idsToDelete.size} pozic z mezipaměti.")
                } else {
                    ConsoleLogger.log("Chyba serveru: ($responseCode). Pokus bude opakován.")
                    return Result.retry()
                }

            } catch (e: Exception) {
                ConsoleLogger.log("Kritická chyba v SyncWorker: ${e.message}")
                return Result.retry()
            }
        }
        return Result.success()
    }
}
