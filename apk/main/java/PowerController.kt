package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent

/**
 * Singleton object responsible for managing the power state of the location service.
 * It acts as a state machine to handle server instructions like TURN_OFF and ensures
 * the service is not started while a TURN_OFF command is pending acknowledgement.
 */
object PowerController {

    /**
     * Attempts to turn the location service ON.
     * This will fail if a TURN_OFF instruction is pending acknowledgement.
     *
     * @param context The application context.
     * @param origin A string indicating the source of the request (e.g., "manual_button", "boot").
     * @return `true` if the service was started, `false` otherwise.
     */
    fun requestTurnOn(context: Context, origin: String): Boolean {
        if (SharedPreferencesHelper.isTurnOffAckPending(context)) {
            ConsoleLogger.warn("PowerController: Start request from '$origin' denied, TURN_OFF is pending acknowledgement.")
            // Optionally, trigger a handshake to try to resolve the pending state
            HandshakeManager.launchHandshake(context, reason = "turn_on_while_ack_pending")
            return false
        }

        ConsoleLogger.info("PowerController: Start request from '$origin' approved.")
        SharedPreferencesHelper.setPowerState(context, PowerState.ON, pendingAck = false, reason = origin)

        val serviceIntent = Intent(context, LocationService::class.java)
        context.startService(serviceIntent)
        return true
    }

    /**
     * Requests the service to be turned OFF.
     * This stops the service and sets a flag indicating that the server's instruction
     * must be acknowledged in a subsequent handshake.
     *
     * @param context The application context.
     * @param origin The source of the turn-off request (e.g., "handshake", "sync").
     */
    fun requestTurnOff(context: Context, origin: String) {
        val wasOn = SharedPreferencesHelper.getPowerState(context) == PowerState.ON
        val wasAckPending = SharedPreferencesHelper.isTurnOffAckPending(context)

        // Only act if the state is changing
        if (!wasOn && wasAckPending) {
             ConsoleLogger.info("PowerController: Turn-off request from '$origin' ignored, already in the correct state.")
             return
        }

        ConsoleLogger.warn("PowerController: Executing turn-off request from '$origin'.")
        SharedPreferencesHelper.setPowerState(context, PowerState.OFF, pendingAck = true, reason = origin)

        // Stop the running service
        context.stopService(Intent(context, LocationService::class.java))

        // Trigger a handshake to inform the server we have received the instruction
        HandshakeManager.launchHandshake(context, reason = "turn_off_requested")
    }

    /**
     * Marks the pending TURN_OFF instruction as acknowledged.
     * This is called when a handshake or sync completes, and the server no longer sends
     * the TURN_OFF instruction, effectively clearing the state.
     *
     * @param context The application context.
     * @param origin The source of the acknowledgement (e.g., "handshake", "sync").
     */
    fun markTurnOffAcknowledged(context: Context, origin: String) {
        if (SharedPreferencesHelper.isTurnOffAckPending(context)) {
            ConsoleLogger.info("PowerController: TURN_OFF acknowledged via '$origin'. Clearing pending flag.")
            // We only clear the flag but leave the power state as OFF.
            // The user or another process must explicitly request to turn it back on.
            SharedPreferencesHelper.setPowerState(
                context,
                powerState = PowerState.OFF, // Keep power OFF
                pendingAck = false,           // Clear the flag
                reason = origin
            )
        }
    }
}
