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

    override suspend fun doWork(): Result {
        ConsoleLogger.debug("SyncWorker: Started via WorkManager")

        // Delegate all logic to the shared helper
        val success = SyncHelper.performSync(applicationContext)

        if (success) {
            ConsoleLogger.debug("SyncWorker: Completed successfully")
            
            // Handshake logic if needed, similar to previous implementation
            HandshakeManager.launchHandshake(applicationContext, reason = "sync_complete")

            // Update status
            val finalState = ServiceStateRepository.serviceState.value
            val newStatus = if (finalState.isRunning) StatusMessages.TRACKING_ACTIVE else StatusMessages.SERVICE_STOPPED
            ServiceStateRepository.updateState(finalState.copy(statusMessage = newStatus))
            
            return Result.success()
        } else {
            ConsoleLogger.warn("SyncWorker: Sync failed or partial failure. Will retry.")
            return Result.retry()
        }
    }
}