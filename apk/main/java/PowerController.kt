package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.gson.Gson

object PowerController {

    private val gson = Gson()

    fun handleTurnOffInstruction(context: Context, origin: String) {
        val previousState = SharedPreferencesHelper.getPowerState(context)
        val alreadyPending = SharedPreferencesHelper.isTurnOffAckPending(context)

        ConsoleLogger.log("$origin: přijata instrukce TURN_OFF (předchozí stav = $previousState)")

        SharedPreferencesHelper.setPowerState(context, PowerState.OFF)
        SharedPreferencesHelper.setTurnOffAckPending(context, true)

        val serviceIntent = Intent(context, LocationService::class.java)
        context.stopService(serviceIntent)
        HandshakeManager.cancelPeriodicHandshake(context)

        val stateJson = gson.toJson(
            ServiceState(
                isRunning = false,
                statusMessage = StatusMessages.SERVICE_STOPPED,
                connectionStatus = "Vypnuto na základě instrukce serveru",
                nextUpdateTimestamp = 0,
                cachedCount = 0,
                powerStatus = PowerState.OFF.toString()
            )
        )

        LocalBroadcastManager.getInstance(context).sendBroadcast(
            Intent(LocationService.ACTION_BROADCAST_STATUS).apply {
                putExtra(LocationService.EXTRA_SERVICE_STATE, stateJson)
            }
        )

        if (!alreadyPending || previousState != PowerState.OFF) {
            ConsoleLogger.log("$origin: plánuju potvrzovací handshake TURN_OFF")
            HandshakeManager.launchHandshake(context, reason = "${origin}_turn_off_ack")
            HandshakeManager.enqueueHandshakeWork(context)
        } else {
            ConsoleLogger.log("$origin: TURN_OFF již potvrzujeme, další handshake se neplánuje.")
        }
    }

    fun markTurnOffAcknowledged(context: Context) {
        if (SharedPreferencesHelper.isTurnOffAckPending(context)) {
            ConsoleLogger.log("TURN_OFF instrukce potvrzena – ruším pending stav.")
            SharedPreferencesHelper.setTurnOffAckPending(context, false)
        }
    }
}
