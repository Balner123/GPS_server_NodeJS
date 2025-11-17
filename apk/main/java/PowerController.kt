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

		ConsoleLogger.info(
			"PowerController[$origin]: TURN_OFF instruction intercepted (currentState=$currentState, pendingAck=$alreadyPending)"
		)

		if (currentState == PowerState.OFF && alreadyPending) {
			ConsoleLogger.debug("PowerController[$origin]: TURN_OFF already pending; broadcasting snapshot only.")
			broadcastSnapshot(
				context = context,
				status = StatusMessages.SERVICE_STOPPED,
				connectionStatus = "Stopped per server instruction",
				ackPending = true,
				source = origin
			)
			return
		}

		ConsoleLogger.info("PowerController[$origin]: Applying TURN_OFF, persisting OFF state and stopping service.")

		SharedPreferencesHelper.setPowerState(
			context,
			PowerState.OFF,
			pendingAck = true,
			reason = origin
		)

		ConsoleLogger.debug("PowerController[$origin]: stopping LocationService and cancelling periodic handshake.")
		stopLocationService(context)
		HandshakeManager.cancelPeriodicHandshake(context)
		NotificationHelper.showServerTurnOffNotification(
			context,
			"Service was stopped remotely. Waiting for server confirmation."
		)

		broadcastSnapshot(
			context = context,
			status = StatusMessages.SERVICE_STOPPED,
			connectionStatus = "Stopped per server instruction",
			ackPending = true,
			source = origin
		)

		if (!alreadyPending) {
			ConsoleLogger.debug("PowerController[$origin]: scheduling TURN_OFF acknowledgement handshake.")
			scheduleAckHandshake(context, origin)
		} else {
			ConsoleLogger.debug("PowerController[$origin]: acknowledgement already pending, handshake not rescheduled.")
		}
	}

	fun requestTurnOn(context: Context, origin: String): Boolean {
		if (SharedPreferencesHelper.isTurnOffAckPending(context)) {
			ConsoleLogger.warn("PowerController[$origin]: start blocked – TURN_OFF acknowledgement still pending.")
			broadcastSnapshot(
				context = context,
				status = StatusMessages.SERVICE_STOPPED,
				connectionStatus = "Waiting for TURN_OFF confirmation",
				ackPending = true,
				source = SharedPreferencesHelper.getPowerTransitionReason(context) ?: origin
			)
			return false
		}

		ConsoleLogger.info("PowerController[$origin]: transitioning power state to ON and restarting LocationService.")
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
			ConsoleLogger.debug("PowerController[$origin]: no pending TURN_OFF acknowledgement to clear.")
			return
		}

		val currentState = SharedPreferencesHelper.getPowerState(context)
		SharedPreferencesHelper.setPowerState(
			context,
			currentState,
			pendingAck = false,
			reason = origin
		)
		ConsoleLogger.info("PowerController[$origin]: TURN_OFF acknowledgement confirmed; resuming periodic handshake.")

		broadcastSnapshot(
			context = context,
			status = StatusMessages.SERVICE_STOPPED,
			connectionStatus = "Server confirmed shutdown",
			ackPending = false,
			source = origin
		)

		HandshakeManager.schedulePeriodicHandshake(context)
		NotificationHelper.cancelServerTurnOffNotification(context)
	}

	private fun scheduleAckHandshake(context: Context, origin: String) {
		ConsoleLogger.debug("PowerController[$origin]: launching immediate handshake + enqueue for TURN_OFF acknowledgement.")
		HandshakeManager.launchHandshake(context, reason = "${origin}_turn_off_ack")
		HandshakeManager.enqueueHandshakeWork(context)
	}

	private fun stopLocationService(context: Context) {
		LocalBroadcastManager.getInstance(context).sendBroadcast(Intent(LocationService.ACTION_STOP_SERVICE))
		context.stopService(Intent(context, LocationService::class.java))
	}

	private fun startLocationService(context: Context) {
		val intent = Intent(context, LocationService::class.java)
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
			context.startForegroundService(intent)
		} else {
			context.startService(intent)
		}
		NotificationHelper.cancelServerTurnOffNotification(context)
	}

	private fun broadcastSnapshot(
		context: Context,
		status: String,
		connectionStatus: String,
		ackPending: Boolean,
		source: String?
	) {
		ConsoleLogger.debug(
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