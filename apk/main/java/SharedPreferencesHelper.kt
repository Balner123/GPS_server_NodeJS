package com.example.gpsreporterapp

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

object SharedPreferencesHelper {

    private const val PREFS_NAME = "EncryptedAppPrefs"
    private const val KEY_POWER_STATUS = "power_status"

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

    fun setPowerState(context: Context, state: PowerState) {
        getEncryptedSharedPreferences(context).edit().putString(KEY_POWER_STATUS, state.toString()).apply()
    }
}
