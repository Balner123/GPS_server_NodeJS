package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.TimeUnit

object HandshakeManager {

    private const val HANDSHAKE_WORK_NAME = "apk_handshake_refresh"
    private const val HANDSHAKE_PERIODIC_WORK_NAME = "apk_handshake_refresh_periodic"
    private val gson = Gson()
    private val handshakeConstraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    suspend fun performHandshake(context: Context, reason: String = "manual") {
        ConsoleLogger.info("Handshake: Starting (reason=$reason)")

        if (!NetworkUtils.isOnline(context)) {
            ConsoleLogger.warn("Handshake: Skipped – internet unavailable")
            enqueueHandshakeWork(context)
            return
        }

        val result = runCatching {
            executeHandshake(context, reason)
        }
        result.exceptionOrNull()?.let { error ->
            ConsoleLogger.error("Handshake: Error ($reason): ${error.message}")
            throw error
        }
    }

    fun launchHandshake(context: Context, reason: String = "manual") {
        CoroutineScope(Dispatchers.IO).launch {
            performHandshake(context, reason)
        }
    }

    fun enqueueHandshakeWork(context: Context) {
        val workRequest = OneTimeWorkRequestBuilder<HandshakeWorker>()
            .setConstraints(handshakeConstraints)
            .setInputData(workDataOf("reason" to "scheduled_once"))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            HANDSHAKE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            workRequest
        )
    }

    fun schedulePeriodicHandshake(context: Context, repeatMinutes: Long = 60) {
        ConsoleLogger.info("Handshake: Scheduling periodic run every ${repeatMinutes} min")
        val periodicWork = PeriodicWorkRequestBuilder<HandshakeWorker>(repeatMinutes, TimeUnit.MINUTES)
            .setConstraints(handshakeConstraints)
            .setInputData(workDataOf("reason" to "periodic"))
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HANDSHAKE_PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicWork
        )
    }

    fun cancelPeriodicHandshake(context: Context) {
        ConsoleLogger.info("Handshake: Cancelling periodic run")
        WorkManager.getInstance(context).cancelUniqueWork(HANDSHAKE_PERIODIC_WORK_NAME)
    }

    private fun executeHandshake(context: Context, reason: String) {
        val prefs = SharedPreferencesHelper.getEncryptedSharedPreferences(context)
        val deviceId = prefs.getString("device_id", null) ?: return
        val sessionCookie = prefs.getString("session_cookie", null)
        val baseUrl = prefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
        val powerState = SharedPreferencesHelper.getPowerState(context)
        val appVersion = BuildConfig.VERSION_NAME
        val platform = "Android ${Build.VERSION.SDK_INT}"

        val requestPayload = mapOf(
            "device_id" to deviceId,
            "client_type" to (prefs.getString("client_type", "APK") ?: "APK"),
            "power_status" to powerState.toString(),
            "app_version" to appVersion,
            "platform" to platform,
            "reason" to reason
        )

        ConsoleLogger.debug(
            "Handshake: Request: device=$deviceId power=$powerState reason=$reason"
        )

        val url = URL("$baseUrl/api/devices/handshake")
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        connection.setRequestProperty("Accept", "application/json")
        sessionCookie
            ?.split(";")
            ?.firstOrNull()
            ?.takeIf { it.isNotBlank() }
            ?.let { connection.setRequestProperty("Cookie", it) }
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.doOutput = true

        OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
            writer.write(gson.toJson(requestPayload))
        }

        val responseCode = connection.responseCode
        val stream = if (responseCode < 400) connection.inputStream else connection.errorStream
        val responseBody = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }

        ConsoleLogger.debug(
            "Handshake: Response: code=$responseCode body=${responseBody.take(160)}"
        )

        if (responseCode != HttpURLConnection.HTTP_OK) {
            return
        }

        val response = gson.fromJson(responseBody, HandshakeResponse::class.java)
        handleHandshakeResponse(context, response)
    }

    private fun handleHandshakeResponse(context: Context, response: HandshakeResponse) {
        if (!response.registered) {
            ConsoleLogger.error("Handshake: Device is not registered.")
            val intent = Intent(LocationService.ACTION_FORCE_LOGOUT).apply {
                putExtra(LocationService.EXTRA_LOGOUT_MESSAGE, "Device is not registered. Please re-register it.")
            }
            context.sendBroadcast(intent)
            return
        }

        val prefs = SharedPreferencesHelper.getEncryptedSharedPreferences(context)
        val editor = prefs.edit()
        var settingsChanged = false
        val powerInstruction = response.power_instruction?.uppercase(Locale.US)

        response.config?.interval_gps?.let { intervalGps ->
            if (prefs.getInt("gps_interval_seconds", 60) != intervalGps) {
                editor.putInt("gps_interval_seconds", intervalGps)
                settingsChanged = true
                ConsoleLogger.info("Handshake: GPS interval changed to ${intervalGps}s")
            }
        }

        response.config?.interval_send?.let { intervalSend ->
            if (prefs.getInt("sync_interval_count", 1) != intervalSend) {
                editor.putInt("sync_interval_count", intervalSend)
                settingsChanged = true
                ConsoleLogger.info("Handshake: Send interval changed to ${intervalSend}")
            }
        }

        editor.apply()

        val currentPowerState = SharedPreferencesHelper.getPowerState(context)
        val isCurrentlyOn = currentPowerState == PowerState.ON
        val ackPending = SharedPreferencesHelper.isTurnOffAckPending(context)

        ConsoleLogger.debug(
            "Handshake: State: instruction=${powerInstruction ?: "NONE"} current=$currentPowerState ackPending=$ackPending"
        )

        if (settingsChanged && isCurrentlyOn && powerInstruction != "TURN_OFF" && !ackPending) {
            restartLocationService(context)
        }

        if (powerInstruction == "TURN_OFF") {
            PowerController.requestTurnOff(context, origin = "handshake")
        } else {
            PowerController.markTurnOffAcknowledged(context, origin = "handshake")
        }
    }

    private fun restartLocationService(context: Context) {
        if (SharedPreferencesHelper.getPowerState(context) == PowerState.OFF) {
            ConsoleLogger.info("Handshake: Service restart skipped (power OFF)")
            return
        }
        ConsoleLogger.info("Handshake: Restarting LocationService to apply new config")
        context.stopService(Intent(context, LocationService::class.java))
        val intent = Intent(context, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
}