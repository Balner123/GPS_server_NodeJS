package com.example.gpsreporterapp

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SyncWorker(appContext: Context, workerParams: WorkerParameters):
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val cachedLocations = dao.getAllCachedLocations()

        if (cachedLocations.isEmpty()) {
            Log.d("SyncWorker", "No locations to sync.")
            return Result.success()
        }

        Log.d("SyncWorker", "Found ${cachedLocations.size} locations to sync.")

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
            val sessionCookie = sharedPrefs.getString("session_cookie", null)
            if (sessionCookie != null) {
                connection.setRequestProperty("Cookie", sessionCookie.split(";")[0])
            }

            connection.outputStream.use { os ->
                val input = jsonArray.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            Log.d("SyncWorker", "Server response code: $responseCode")

            return if (responseCode == HttpURLConnection.HTTP_OK) {
                Log.d("SyncWorker", "Sync successful. Deleting ${cachedLocations.size} locations from cache.")
                val idsToDelete = cachedLocations.map { it.id }
                dao.deleteLocationsByIds(idsToDelete)
                Result.success()
            } else {
                Log.e("SyncWorker", "Sync failed with response code: $responseCode")
                Result.retry()
            }

        } catch (e: Exception) {
            Log.e("SyncWorker", "Error during sync", e)
            return Result.retry()
        }
    }
}
