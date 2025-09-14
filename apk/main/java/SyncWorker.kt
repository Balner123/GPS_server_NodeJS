package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
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

    private fun broadcastSyncLog(message: String) {
        val serviceState = ServiceState(consoleLog = "[SyncWorker] $message")
        val intent = Intent(LocationService.ACTION_BROADCAST_STATUS).apply {
            putExtra(LocationService.EXTRA_SERVICE_STATE, gson.toJson(serviceState))
        }
        LocalBroadcastManager.getInstance(applicationContext).sendBroadcast(intent)
    }

    override suspend fun doWork(): Result {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val cachedLocations = dao.getAllCachedLocations()

        if (cachedLocations.isEmpty()) {
            Log.d("SyncWorker", "No locations to sync.")
            // Není potřeba logovat do UI, pokud se nic neděje
            return Result.success()
        }

        broadcastSyncLog("Nalezeno ${cachedLocations.size} pozic k synchronizaci.")

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

            val url = URL("https://lotr-system.xyz/api/devices/input")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.doOutput = true
            connection.connectTimeout = 30000
            connection.readTimeout = 30000

            val sharedPrefs = applicationContext.getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
            sharedPrefs.getString("session_cookie", null)?.let {
                connection.setRequestProperty("Cookie", it.split(";")[0])
            }

            val payload = jsonArray.toString()
            broadcastSyncLog("Odesílám POST na $url\nData: ${payload.take(500)}${if (payload.length > 500) "..." else ""}")

            connection.outputStream.use { os ->
                val input = payload.toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            val responseBody = try {
                val reader = BufferedReader(InputStreamReader(if (responseCode < 400) connection.inputStream else connection.errorStream))
                reader.readText()
            } catch (e: Exception) {
                "Nelze přečíst odpověď: ${e.message}"
            }

            broadcastSyncLog("Odpověď serveru: Status $responseCode\nOdpověď: ${responseBody.take(500)}${if (responseBody.length > 500) "..." else ""}")

            return if (responseCode == HttpURLConnection.HTTP_OK) {
                broadcastSyncLog("Synchronizace úspěšná. Mažu ${cachedLocations.size} pozic z cache.")
                val idsToDelete = cachedLocations.map { it.id }
                dao.deleteLocationsByIds(idsToDelete)
                Result.success()
            } else {
                broadcastSyncLog("Synchronizace selhala. Pokus bude opakován.")
                Result.retry()
            }

        } catch (e: Exception) {
            Log.e("SyncWorker", "Error during sync", e)
            broadcastSyncLog("Kritická chyba při synchronizaci: ${e.message}")
            return Result.retry()
        }
    }
}