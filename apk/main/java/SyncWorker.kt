package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
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

    override suspend fun doWork(): Result {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val cachedLocations = dao.getAllCachedLocations()

        if (cachedLocations.isEmpty()) {
            return Result.success()
        }

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

            connection.outputStream.use { os ->
                val input = payload.toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            val responseBody = try {
                val reader = BufferedReader(InputStreamReader(if (responseCode < 400) connection.inputStream else connection.errorStream))
                reader.readText()
            } catch (e: Exception) {
                return Result.retry()
            }

            if (responseCode == HttpURLConnection.HTTP_OK) {
                try {
                    val serverResponse = gson.fromJson(responseBody, ServerResponse::class.java)
                    if (serverResponse.success) {
                        val editor = sharedPrefs.edit()
                        var settingsChanged = false
                        serverResponse.interval_gps?.let {
                            if (sharedPrefs.getInt("gps_interval_seconds", 60) != it) {
                                editor.putInt("gps_interval_seconds", it)
                                settingsChanged = true
                            }
                        }
                        serverResponse.interval_send?.let {
                            if (sharedPrefs.getInt("sync_interval_count", 1) != it) {
                                editor.putInt("sync_interval_count", it)
                                settingsChanged = true
                            }
                        }
                        if (settingsChanged) {
                            editor.apply()
                            // Restart service to apply new settings
                            val serviceIntent = Intent(applicationContext, LocationService::class.java)
                            applicationContext.stopService(serviceIntent)
                            applicationContext.startService(serviceIntent)
                        }
                    }
                } catch (e: JsonSyntaxException) {
                    // JSON parsing failed, but the request was successful
                }

                val idsToDelete = cachedLocations.map { it.id }
                dao.deleteLocationsByIds(idsToDelete)
                return Result.success()
            } else {
                return Result.retry()
            }

        } catch (e: Exception) {
            return Result.retry()
        }
    }
}