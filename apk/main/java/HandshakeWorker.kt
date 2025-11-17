package com.example.gpsreporterapp

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class HandshakeWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            val reason = inputData.getString("reason") ?: "worker"
            HandshakeManager.performHandshake(applicationContext, reason = reason)
            Result.success()
        } catch (ex: Exception) {
            ConsoleLogger.error("HandshakeWorker failed: ${ex.message}")
            Result.retry()
        }
    }
}