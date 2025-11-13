package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.gson.Gson

object PowerController {

	private val gson = Gson()

	fun requestTurnOff(context: Context, origin: String) {
		val currentState = SharedPreferencesHelper.getPowerState(context)
		val alreadyPending = SharedPreferencesHelper.isTurnOffAckPending(context)

		ConsoleLogger.log(
			"PowerController[$origin]: TURN_OFF instruction intercepted (currentState=$currentState, pendingAck=$alreadyPending)"
		)

		if (currentState == PowerState.OFF && alreadyPending) {
			ConsoleLogger.log("PowerController[$origin]: TURN_OFF already pending; broadcasting snapshot only.")
			broadcastSnapshot(
				context = context,
				status = StatusMessages.SERVICE_STOPPED,
				connectionStatus = "Vypnuto na základě instrukce serveru",
				ackPending = true,
				source = origin
			)
			return
		}

		ConsoleLogger.log("PowerController[$origin]: applying TURN_OFF, persisting OFF state and stopping service.")

		SharedPreferencesHelper.setPowerState(
			context,
			PowerState.OFF,
			pendingAck = true,
			reason = origin
		)

		ConsoleLogger.log("PowerController[$origin]: stopping LocationService and cancelling periodic handshake.")
		stopLocationService(context)
		HandshakeManager.cancelPeriodicHandshake(context)

		broadcastSnapshot(
			context = context,
			status = StatusMessages.SERVICE_STOPPED,
			connectionStatus = "Vypnuto na základě instrukce serveru",
			ackPending = true,
			source = origin
		)

		if (!alreadyPending) {
			ConsoleLogger.log("PowerController[$origin]: scheduling TURN_OFF acknowledgement handshake.")
			scheduleAckHandshake(context, origin)
		} else {
			ConsoleLogger.log("PowerController[$origin]: acknowledgement already pending, handshake not rescheduled.")
		}
	}

	fun requestTurnOn(context: Context, origin: String): Boolean {
		if (SharedPreferencesHelper.isTurnOffAckPending(context)) {
			ConsoleLogger.log("PowerController[$origin]: start blocked – TURN_OFF acknowledgement still pending.")
			broadcastSnapshot(
				context = context,
				status = StatusMessages.SERVICE_STOPPED,
				connectionStatus = "Čekání na potvrzení TURN_OFF",
				ackPending = true,
				source = SharedPreferencesHelper.getPowerTransitionReason(context) ?: origin
			)
			return false
		}

		ConsoleLogger.log("PowerController[$origin]: transitioning power state to ON and restarting LocationService.")
		SharedPreferencesHelper.setPowerState(
			context,
			PowerState.ON,
			pendingAck = false,
			reason = origin
		)

		startLocationService(context)
		HandshakeManager.schedulePeriodicHandshake(context)
		HandshakeManager.launchHandshake(context, reason = "${origin}_power_on")
		return true
	}

	fun markTurnOffAcknowledged(context: Context, origin: String) {
		if (!SharedPreferencesHelper.isTurnOffAckPending(context)) {
			ConsoleLogger.log("PowerController[$origin]: no pending TURN_OFF acknowledgement to clear.")
			return
		}

		val currentState = SharedPreferencesHelper.getPowerState(context)
		SharedPreferencesHelper.setPowerState(
			context,
			currentState,
			pendingAck = false,
			reason = origin
		)
		ConsoleLogger.log("PowerController[$origin]: TURN_OFF acknowledgement confirmed; resuming periodic handshake.")

		broadcastSnapshot(
			context = context,
			status = StatusMessages.SERVICE_STOPPED,
			connectionStatus = "Server potvrdil vypnutí",
			ackPending = false,
			source = origin
		)

		HandshakeManager.schedulePeriodicHandshake(context)
	}

	private fun scheduleAckHandshake(context: Context, origin: String) {
		ConsoleLogger.log("PowerController[$origin]: launching immediate handshake + enqueue for TURN_OFF acknowledgement.")
		HandshakeManager.launchHandshake(context, reason = "${origin}_turn_off_ack")
		HandshakeManager.enqueueHandshakeWork(context)
	}

	private fun stopLocationService(context: Context) {
		context.stopService(Intent(context, LocationService::class.java))
	}

	private fun startLocationService(context: Context) {
		val intent = Intent(context, LocationService::class.java)
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
			context.startForegroundService(intent)
		} else {
			context.startService(intent)
		}
	}

	private fun broadcastSnapshot(
		context: Context,
		status: String,
		connectionStatus: String,
		ackPending: Boolean,
		source: String?
	) {
		ConsoleLogger.log(
			"PowerController[$source]: broadcasting state -> status=$status, connection=$connectionStatus, ackPending=$ackPending"
		)
		val state = ServiceState(
			isRunning = false,
			statusMessage = status,
			connectionStatus = connectionStatus,
			nextUpdateTimestamp = 0,
			cachedCount = 0,
			powerStatus = PowerState.OFF.toString(),
			ackPending = ackPending,
			powerInstructionSource = source
		)

		val intent = Intent(LocationService.ACTION_BROADCAST_STATUS).apply {
			putExtra(LocationService.EXTRA_SERVICE_STATE, gson.toJson(state))
		}
		LocalBroadcastManager.getInstance(context).sendBroadcast(intent)
	}
}
