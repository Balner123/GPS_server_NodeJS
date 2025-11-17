package com.example.gpsreporterapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationHelper {

    private const val CHANNEL_ID_ALERTS = "gps_reporter_alerts"
    private const val CHANNEL_NAME_ALERTS = "Server & Device Alerts"
    private const val SERVER_TURN_OFF_NOTIFICATION_ID = 2001
    private const val GPS_DISABLED_NOTIFICATION_ID = 2002
    private const val NETWORK_OFF_NOTIFICATION_ID = 2003

    private fun ensureAlertsChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelExists = manager.getNotificationChannel(CHANNEL_ID_ALERTS) != null
        if (!channelExists) {
            val channel = NotificationChannel(
                CHANNEL_ID_ALERTS,
                CHANNEL_NAME_ALERTS,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for server instructions and device errors"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }
    }

    fun showServerTurnOffNotification(context: Context, message: String) {
        ensureAlertsChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
            .setSmallIcon(R.drawable.ic_gps_pin)
            .setContentTitle("Service stopped by server")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .setOngoing(true)
            .build()

        NotificationManagerCompat.from(context).notify(SERVER_TURN_OFF_NOTIFICATION_ID, notification)
    }

    fun cancelServerTurnOffNotification(context: Context) {
        NotificationManagerCompat.from(context).cancel(SERVER_TURN_OFF_NOTIFICATION_ID)
    }

    fun showGpsDisabledNotification(context: Context, message: String) {
        ensureAlertsChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
            .setSmallIcon(R.drawable.ic_gps_pin)
            .setContentTitle("GPS disabled")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(false)
            .setOngoing(true)
            .build()

        NotificationManagerCompat.from(context).notify(GPS_DISABLED_NOTIFICATION_ID, notification)
    }

    fun cancelGpsDisabledNotification(context: Context) {
        NotificationManagerCompat.from(context).cancel(GPS_DISABLED_NOTIFICATION_ID)
    }

    fun showNetworkUnavailableNotification(context: Context, cachedCount: Int) {
        ensureAlertsChannel(context)
        val body = if (cachedCount > 0) {
            "Data (${cachedCount}) waiting to upload. Connect to the internet."
        } else {
            "Connect to the internet to send pending data."
        }
        val notification = NotificationCompat.Builder(context, CHANNEL_ID_ALERTS)
            .setSmallIcon(R.drawable.ic_gps_pin)
            .setContentTitle("Offline mode")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(false)
            .setOngoing(true)
            .build()

        NotificationManagerCompat.from(context).notify(NETWORK_OFF_NOTIFICATION_ID, notification)
    }

    fun cancelNetworkUnavailableNotification(context: Context) {
        NotificationManagerCompat.from(context).cancel(NETWORK_OFF_NOTIFICATION_ID)
    }
}
