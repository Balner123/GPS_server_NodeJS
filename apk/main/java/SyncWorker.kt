package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SyncWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

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
        ConsoleLogger.debug("Sync: Worker started")

        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = getEncryptedSharedPreferences()

        val sessionCookie = sharedPrefs.getString("session_cookie", null)?.split(";")?.firstOrNull()
        val baseUrl = sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
        val clientType = sharedPrefs.getString("client_type", "APK") ?: "APK"

        if (sessionCookie.isNullOrBlank()) {
            ConsoleLogger.warn("Sync: No session cookie, falling back to device_id")
        }

        if (SharedPreferencesHelper.isTurnOffAckPending(applicationContext)) {
            ConsoleLogger.info("Sync: Upload paused, waiting for TURN_OFF confirmation")
            HandshakeManager.launchHandshake(applicationContext, reason = "sync_turn_off_ack")
            HandshakeManager.enqueueHandshakeWork(applicationContext)
            return Result.success()
        }

        val batchSize = 50
        var continueSync = true

        while (continueSync) {
            val cachedLocations = dao.getLocationsBatch(batchSize)
            if (cachedLocations.isEmpty()) {
                ConsoleLogger.debug("Sync: No positions to upload")
                break
            }

            ConsoleLogger.debug("Sync: Sending batch of ${cachedLocations.size} positions")

            val payload = JSONArray()
            val idsToDelete = mutableListOf<Int>()

            cachedLocations.forEach { location ->
                val jsonObject = JSONObject().apply {
                    put("device", location.deviceId)
                    put("name", location.deviceName)
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("power_status", location.powerStatus)
                    put("client_type", clientType)
                    put("timestamp", formatTimestamp(location.timestamp))
                }

                if (location.speed in 0f..1000f) {
                    jsonObject.put("speed", location.speed)
                }

                if (location.altitude in -1000.0..10000.0) {
                    jsonObject.put("altitude", location.altitude)
                }

                if (location.accuracy >= 0f && location.accuracy <= 100f) {
                    jsonObject.put("accuracy", location.accuracy)
                }

                if (location.satellites in 0..50) {
                    jsonObject.put("satellites", location.satellites)
                }
                payload.put(jsonObject)
                idsToDelete.add(location.id)
            }

            try {
                val response = ApiClient.sendBatch(baseUrl, sessionCookie, payload)

                if (!response.success) {
                    ConsoleLogger.warn("Sync: Server responded with success=false. Message: ${response.message}")
                    return Result.retry()
                }

                continueSync = handleServerResponse(sharedPrefs, response)
                dao.deleteLocationsByIds(idsToDelete)
                
                val remainingCount = dao.getCachedCount()
                val currentState = ServiceStateRepository.serviceState.value
                ServiceStateRepository.updateState(currentState.copy(cachedCount = remainingCount))
                
                ConsoleLogger.debug("Sync: Batch of ${idsToDelete.size} positions sent successfully")

            } catch (e: UnauthorizedException) {
                ConsoleLogger.error("Sync: Unauthorized access: ${e.message}")
                handleUnauthorized()
                return Result.failure()
            } catch (e: ServerException) {
                ConsoleLogger.warn("Sync: Server error: ${e.message}")
                return Result.retry()
            } catch (e: ApiException) {
                ConsoleLogger.error("Sync: Unexpected API error: ${e.message}")
                return Result.retry()
            }
        }

        ConsoleLogger.debug("Sync: Triggering handshake after sync session completion")
        HandshakeManager.launchHandshake(applicationContext, reason = "sync_complete")

        return Result.success()
    }

    // postBatch and parseResponse are now handled by ApiClient

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
                ConsoleLogger.info("Sync: GPS interval updated to ${intervalGps}s")
            }
        }

        response.interval_send?.let { intervalSend ->
            if (sharedPrefs.getInt("sync_interval_count", 1) != intervalSend) {
                editor.putInt("sync_interval_count", intervalSend)
                settingsChanged = true
                ConsoleLogger.info("Sync: Send interval updated to ${intervalSend} positions")
            }
        }

        if (settingsChanged) {
            editor.apply()
            restartLocationServiceIfActive()
        } else {
            editor.apply()
        }

        val instruction = response.power_instruction?.uppercase(Locale.US)
        ConsoleLogger.debug("Sync: Received instruction='${instruction ?: "NONE"}', pendingAck=${SharedPreferencesHelper.isTurnOffAckPending(applicationContext)}")
        return when (instruction) {
            "TURN_OFF" -> {
                PowerController.requestTurnOff(applicationContext, origin = "sync")
                false
            }
            else -> {
                PowerController.markTurnOffAcknowledged(applicationContext, origin = "sync")
                true
            }
        }
    }

    private fun restartLocationServiceIfActive() {
        if (SharedPreferencesHelper.getPowerState(applicationContext) == PowerState.OFF) {
            ConsoleLogger.debug("Sync: Service restart skipped (power is OFF)")
            return
        }

        if (SharedPreferencesHelper.isTurnOffAckPending(applicationContext)) {
            ConsoleLogger.warn("Sync: Service restart blocked (waiting for TURN_OFF confirmation)")
            return
        }

        ConsoleLogger.info("Sync: Restarting LocationService to apply new configuration")
        val serviceIntent = Intent(applicationContext, LocationService::class.java)
        applicationContext.stopService(serviceIntent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            applicationContext.startForegroundService(serviceIntent)
        } else {
            applicationContext.startService(serviceIntent)
        }
    }

    private fun handleUnauthorized() {
        SharedPreferencesHelper.setPowerState(
            applicationContext,
            PowerState.OFF,
            pendingAck = false,
            reason = "unauthorized"
        )
        applicationContext.stopService(Intent(applicationContext, LocationService::class.java))

        val logoutIntent = Intent(LocationService.ACTION_FORCE_LOGOUT).apply {
            putExtra(
                LocationService.EXTRA_LOGOUT_MESSAGE,
                "Session is invalid. Please sign in again."
            )
        }
        applicationContext.sendBroadcast(logoutIntent)
    }

    private fun formatTimestamp(timestamp: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(timestamp))
    }
}