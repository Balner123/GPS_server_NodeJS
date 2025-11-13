package com.example.gpsreporterapp

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object SharedPreferencesHelper {

    private const val PREFS_NAME = "EncryptedAppPrefs"
    private const val KEY_POWER_STATUS = "power_status"
    private const val KEY_PENDING_TURN_OFF_ACK = "pending_turn_off_ack"
    private const val KEY_POWER_TRANSITION_REASON = "power_transition_reason"
    private const val KEY_POWER_TRANSITION_TIMESTAMP = "power_transition_timestamp"

    fun getEncryptedSharedPreferences(context: Context): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            PREFS_NAME,
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun getPowerState(context: Context): PowerState {
        val storedValue = getEncryptedSharedPreferences(context).getString(KEY_POWER_STATUS, null)
        return PowerState.fromString(storedValue)
    }

    fun setPowerState(
        context: Context,
        state: PowerState,
        pendingAck: Boolean = false,
        reason: String? = null,
        timestampMillis: Long = System.currentTimeMillis()
    ) {
        val prefs = getEncryptedSharedPreferences(context)
        prefs.edit().apply {
            putString(KEY_POWER_STATUS, state.toString())
            putBoolean(KEY_PENDING_TURN_OFF_ACK, pendingAck)
            reason?.let { putString(KEY_POWER_TRANSITION_REASON, it) }
            putLong(KEY_POWER_TRANSITION_TIMESTAMP, timestampMillis)
            apply()
        }
    }

    fun isTurnOffAckPending(context: Context): Boolean {
        return getEncryptedSharedPreferences(context).getBoolean(KEY_PENDING_TURN_OFF_ACK, false)
    }

    fun setTurnOffAckPending(context: Context, pending: Boolean) {
        getEncryptedSharedPreferences(context).edit().putBoolean(KEY_PENDING_TURN_OFF_ACK, pending).apply()
    }

    fun getPowerTransitionReason(context: Context): String? {
        return getEncryptedSharedPreferences(context).getString(KEY_POWER_TRANSITION_REASON, null)
    }

    fun getPowerTransitionTimestamp(context: Context): Long {
        return getEncryptedSharedPreferences(context).getLong(KEY_POWER_TRANSITION_TIMESTAMP, 0L)
    }
}

