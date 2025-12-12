package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Shared logic for synchronizing location data.
 * Used by both SyncWorker (background/retry) and LocationService (immediate).
 */
object SyncHelper {

    suspend fun performSync(context: Context): Boolean {
        // Run IO operations on IO thread
        return withContext(Dispatchers.IO) {
            val dao = AppDatabase.getDatabase(context).locationDao()
            val sharedPrefs = getEncryptedSharedPreferences(context)
            
            val sessionCookie = sharedPrefs.getString("session_cookie", null)?.split(";")?.firstOrNull()
            val baseUrl = sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
            val clientType = sharedPrefs.getString("client_type", "APK") ?: "APK"

            // If no cookie, we might be logged out, but we try anyway (server might accept device_id auth or reject)
            // Ideally we check isAuthenticated here.

            val batchSize = 50
            var allBatchesSuccess = true

            while (true) {
                // Check if we have data
                val cachedLocations = dao.getLocationsBatch(batchSize)
                if (cachedLocations.isEmpty()) {
                    break // Nothing more to send
                }

                ConsoleLogger.debug("SyncHelper: Preparing batch of ${cachedLocations.size} items.")

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
                    if (location.speed in 0f..1000f) jsonObject.put("speed", location.speed)
                    if (location.altitude in -1000.0..10000.0) jsonObject.put("altitude", location.altitude)
                    if (location.accuracy >= 0f && location.accuracy <= 100f) jsonObject.put("accuracy", location.accuracy)
                    if (location.satellites in 0..50) jsonObject.put("satellites", location.satellites)
                    
                    payload.put(jsonObject)
                    idsToDelete.add(location.id)
                }

                try {
                    val response = ApiClient.sendBatch(baseUrl, sessionCookie, payload)

                    if (response.success) {
                        // Success: Delete and process instructions
                        dao.deleteLocationsByIds(idsToDelete)
                        
                        // Update Cached Count in UI via Repository (Service will pick it up)
                        val remaining = dao.getCachedCount()
                        updateServiceStateCacheCount(remaining)
                        
                        handleServerResponse(context, sharedPrefs, response)
                        ConsoleLogger.debug("SyncHelper: Batch sent successfully.")
                    } else {
                        ConsoleLogger.warn("SyncHelper: Server returned success=false: ${response.message}")
                        allBatchesSuccess = false
                        break // Stop trying this loop, let WorkManager retry later
                    }

                } catch (e: Exception) {
                    // Handle specific errors
                    when (e) {
                        is UnauthorizedException -> {
                            ConsoleLogger.error("SyncHelper: Unauthorized.")
                            handleUnauthorized(context)
                            allBatchesSuccess = false
                            break
                        }
                        is ClientException -> {
                            val msg = e.message ?: ""
                            if (msg.contains("404") || msg.contains("400")) {
                                ConsoleLogger.warn("SyncHelper: Fatal error ($msg). Deleting bad batch.")
                                dao.deleteLocationsByIds(idsToDelete) // Delete bad data
                                if (msg.contains("404")) handleDeviceNotRegistered(context)
                            } else {
                                allBatchesSuccess = false
                                break
                            }
                        }
                        else -> {
                            ConsoleLogger.error("SyncHelper: Network/Server error: ${e.message}")
                            allBatchesSuccess = false
                            break
                        }
                    }
                }
            }
            
            if (allBatchesSuccess) {
                 // Trigger handshake if needed (sync_complete) - logic from SyncWorker
                 // But be careful not to create infinite loops if handshake triggers input.
                 // HandshakeManager.launchHandshake(context, reason = "sync_complete")
            }
            
            return@withContext allBatchesSuccess
        }
    }

    private fun updateServiceStateCacheCount(count: Int) {
        val current = ServiceStateRepository.serviceState.value
        ServiceStateRepository.updateState(current.copy(cachedCount = count))
    }

    private fun handleServerResponse(context: Context, sharedPrefs: SharedPreferences, response: ServerResponse) {
        val editor = sharedPrefs.edit()
        var settingsChanged = false

        response.interval_gps?.let { 
            if (sharedPrefs.getInt("gps_interval_seconds", 60) != it) {
                editor.putInt("gps_interval_seconds", it)
                settingsChanged = true
            }
        }
        response.interval_send?.let {
            if (sharedPrefs.getInt("sync_interval_count", 1) != it) {
                editor.putInt("sync_interval_count", it)
                settingsChanged = true
            }
        }
        
        if (settingsChanged) {
            editor.apply()
            // Notify Service to restart if needed? 
            // LocationService handles this by checking prefs, or we can broadcast an intent.
            // For now, simpler to leave it to next Service start or HandshakeManager.
        } else {
            editor.apply()
        }

        val instruction = response.power_instruction?.uppercase(Locale.US)
        if (instruction == "TURN_OFF") {
             PowerController.requestTurnOff(context, origin = "sync")
        } else {
             PowerController.markTurnOffAcknowledged(context, origin = "sync")
        }
    }

    private fun handleUnauthorized(context: Context) {
        SharedPreferencesHelper.setPowerState(context, PowerState.OFF, pendingAck = false, reason = "unauthorized")
        val logoutIntent = Intent(LocationService.ACTION_FORCE_LOGOUT).apply {
            putExtra(LocationService.EXTRA_LOGOUT_MESSAGE, "Session invalid.")
        }
        context.sendBroadcast(logoutIntent)
    }

    private fun handleDeviceNotRegistered(context: Context) {
        SharedPreferencesHelper.setPowerState(context, PowerState.OFF, pendingAck = false, reason = "not_registered")
        val logoutIntent = Intent(LocationService.ACTION_FORCE_LOGOUT).apply {
            putExtra(LocationService.EXTRA_LOGOUT_MESSAGE, "Device not registered.")
        }
        context.sendBroadcast(logoutIntent)
    }

    private fun getEncryptedSharedPreferences(context: Context): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            "EncryptedAppPrefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun formatTimestamp(timestamp: Long): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date(timestamp))
    }
}