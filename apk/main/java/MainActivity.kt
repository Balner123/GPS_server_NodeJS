package com.example.gpsreporterapp // Application package name

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.view.animation.AnimationUtils
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.gson.Gson
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.google.gson.JsonSyntaxException
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var statusTextView: TextView
    private lateinit var toggleButton: TextView
    private lateinit var serverInstructionBanner: TextView
    private lateinit var lastConnectionStatusTextView: TextView
    private lateinit var countdownTextView: TextView
    private lateinit var lastLocationTextView: TextView
    private lateinit var cachedCountTextView: TextView
    private lateinit var powerStatusTextView: TextView
    private lateinit var consoleTextView: TextView
    private lateinit var consoleScrollView: ScrollView

    private var countdownTimer: CountDownTimer? = null
    private val gson = Gson()
    private var isServiceRunning = false
    private var lastPowerStatus: String = ""
    private var lastAckPending: Boolean = false

    private val logoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(LocationService.EXTRA_LOGOUT_MESSAGE) ?: "A login error occurred."
            showLogoutDialog(message)
        }
    }

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.takeIf { it.action == LocationService.ACTION_BROADCAST_STATUS }?.let {
                val serviceStateJson = it.getStringExtra(LocationService.EXTRA_SERVICE_STATE)
                if (serviceStateJson != null) {
                    try {
                        val serviceState = gson.fromJson(serviceStateJson, ServiceState::class.java)
                        isServiceRunning = serviceState.isRunning
                        updateUiState(isServiceRunning)

                        lastLocationTextView.text = serviceState.statusMessage
                        lastConnectionStatusTextView.text = serviceState.connectionStatus
                        cachedCountTextView.text = "Cached positions: ${serviceState.cachedCount}"
                        val powerStatus = serviceState.powerStatus
                        powerStatusTextView.text = "Power: ${powerStatus}"
                        toggleButton.isEnabled = !serviceState.ackPending
                        serverInstructionBanner.visibility = View.GONE
                        serverInstructionBanner.text = ""
                        lastAckPending = serviceState.ackPending
                        if (!powerStatus.equals(lastPowerStatus, ignoreCase = true)) {
                            if (powerStatus.equals("OFF", ignoreCase = true) && serviceState.connectionStatus.contains("instrukce", true)) {
                                Toast.makeText(this@MainActivity, "Service was stopped by the server.", Toast.LENGTH_LONG).show()
                            }
                            lastPowerStatus = powerStatus
                        }

                        if (serviceState.nextUpdateTimestamp > 0) {
                            startCountdown(serviceState.nextUpdateTimestamp)
                        } else {
                            countdownTimer?.cancel()
                            countdownTextView.text = "-"
                        }

                    } catch (e: JsonSyntaxException) {
                        // Ignore parsing errors
                    }
                }
            }
        }
    }

    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            // Check if all requested permissions were granted
            val allGranted = permissions.entries.all { it.value }
            if (allGranted) {
                // If all permissions were granted, proceed with the next check (which might be background location)
                checkAndRequestPermissions()
            } else {
                // Not all permissions were granted. Check if any were permanently denied.
                val permanentlyDenied = permissions.entries.any { !it.value && !shouldShowRequestPermissionRationale(it.key) }
                if (permanentlyDenied) {
                    // If a permission is permanently denied, show a dialog to guide the user to settings.
                    showSettingsDialog()
                } else {
                    // If permissions were denied but not permanently, show a toast.
                    Toast.makeText(this, "Permissions are required for the app to function.", Toast.LENGTH_LONG).show()
                }
            }
        }

    /**
     * Shows a dialog that informs the user that permissions are required and provides a button
     * to open the app's settings page.
     */
    private fun showSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle("Permissions Required")
            .setMessage("This app needs certain permissions to function properly. Please grant them in the app settings.")
            .setPositiveButton("Go to Settings") { _, _ ->
                // Create an intent to open the application details settings page.
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                val uri = android.net.Uri.fromParts("package", packageName, null)
                intent.data = uri
                startActivity(intent)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        ConsoleLogger.initialize(this)

        val sharedPrefs = getEncryptedSharedPreferences()
        if (!sharedPrefs.getBoolean("isAuthenticated", false)) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        // Bind UI elements
        statusTextView = findViewById(R.id.statusTextView)
        toggleButton = findViewById(R.id.toggleButton)
        serverInstructionBanner = findViewById(R.id.serverInstructionBanner)
        serverInstructionBanner.visibility = View.GONE
        serverInstructionBanner.text = ""
        lastConnectionStatusTextView = findViewById(R.id.lastConnectionStatusTextView)
        countdownTextView = findViewById(R.id.countdownTextView)
        lastLocationTextView = findViewById(R.id.lastLocationTextView)
        cachedCountTextView = findViewById(R.id.cachedCountTextView)
        powerStatusTextView = findViewById(R.id.powerStatusTextView)
        consoleTextView = findViewById(R.id.consoleTextView)
        consoleScrollView = findViewById(R.id.consoleScrollView)

        lastPowerStatus = SharedPreferencesHelper.getPowerState(this).toString()
        lastAckPending = SharedPreferencesHelper.isTurnOffAckPending(this)
        powerStatusTextView.text = "Power: ${lastPowerStatus}"
        toggleButton.isEnabled = !lastAckPending

        updateUiState(false) // Initialize default state (service not running)

        toggleButton.setOnClickListener {
            animateButton()
            if (isServiceRunning) {
                stopLocationService()
            } else {
                runPreFlightChecks()
            }
        }

        toggleButton.setOnLongClickListener {
            AlertDialog.Builder(this)
                .setTitle("Log out?")
                .setMessage("Are you sure you want to log out?")
                .setPositiveButton("Yes") { _, _ -> performLogout() }
                .setNegativeButton("No", null)
                .show()
            true
        }

        val consoleCard = findViewById<CardView>(R.id.consoleCard)
        consoleCard.setOnLongClickListener {
            showConsoleOptionsDialog()
            true
        }

        ConsoleLogger.logs.observe(this) { logs ->
            consoleTextView.text = logs.joinToString("")
            consoleScrollView.post { consoleScrollView.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun showLogoutDialog(message: String) {
        if (!isFinishing) {
            AlertDialog.Builder(this)
                .setTitle("Logout")
                .setMessage(message)
                .setPositiveButton("OK") { _, _ -> performLogout() }
                .setCancelable(false)
                .show()
        }
    }

    private fun performLogout() {
        stopLocationService()
        val sharedPrefs = getEncryptedSharedPreferences()
        toggleButton.isEnabled = false
        val sessionCookie = sharedPrefs.getString("session_cookie", null)
        val serverUrl = sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL

        lifecycleScope.launch {
            sessionCookie?.let {
                sendLogoutRequest(serverUrl, it)
            }

            SharedPreferencesHelper.setPowerState(
                this@MainActivity,
                PowerState.OFF,
                pendingAck = false,
                reason = "logout"
            )
            sharedPrefs.edit()
                .remove("session_cookie")
                .putBoolean("isAuthenticated", false)
                .apply()
            Toast.makeText(this@MainActivity, "Logged out successfully.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this@MainActivity, LoginActivity::class.java))
            finish()
        }
    }

    private suspend fun sendLogoutRequest(baseUrl: String, sessionCookie: String) {
        withContext(Dispatchers.IO) {
            try {
                ConsoleLogger.info("Sending logout request...")
                val url = URL("$baseUrl/api/apk/logout")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.setRequestProperty("Cookie", sessionCookie.split(";")[0])
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                connection.outputStream.use { output ->
                    OutputStreamWriter(output, Charsets.UTF_8).use { writer ->
                        writer.write("{}")
                    }
                }

                val code = connection.responseCode
                val stream = if (code < 400) connection.inputStream else connection.errorStream
                val body = stream?.let { BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader -> reader.readText() } } ?: ""
                if (code >= 400) {
                    ConsoleLogger.error("Logout failed ($code): $body")
                } else {
                    ConsoleLogger.info("Logout succeeded ($code)")
                }
            } catch (e: Exception) {
                ConsoleLogger.error("Logout error: ${e.message}")
            }
        }
    }

    private fun getEncryptedSharedPreferences(): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            "EncryptedAppPrefs",
            masterKeyAlias,
            this,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    override fun onResume() {
        super.onResume()
        val statusFilter = IntentFilter(LocationService.ACTION_BROADCAST_STATUS)
        LocalBroadcastManager.getInstance(this).registerReceiver(statusReceiver, statusFilter)

        val logoutFilter = IntentFilter(LocationService.ACTION_FORCE_LOGOUT)
        ContextCompat.registerReceiver(
            this,
            logoutReceiver,
            logoutFilter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        // Request service status only if it should remain running
        if (SharedPreferencesHelper.getPowerState(this) == PowerState.ON) {
            val intent = Intent(this, LocationService::class.java).apply {
                action = LocationService.ACTION_REQUEST_STATUS_UPDATE
            }
            startService(intent)
        } else {
            updateUiState(false)
        }
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
        unregisterReceiver(logoutReceiver)
        countdownTimer?.cancel()
    }

    private fun updateUiState(isServiceRunning: Boolean) {
        val ackPending = SharedPreferencesHelper.isTurnOffAckPending(this)
        toggleButton.isEnabled = !ackPending
        serverInstructionBanner.visibility = if (ackPending) View.VISIBLE else View.GONE
        serverInstructionBanner.visibility = View.GONE
        serverInstructionBanner.text = ""
        if (ackPending) {
            statusTextView.text = "Service paused by server"
            toggleButton.text = "OFF"
            toggleButton.setBackgroundResource(R.drawable.button_bg_off)
            return
        }
        if (isServiceRunning) {
            statusTextView.text = "Service is active"
            toggleButton.text = "ON"
            toggleButton.setBackgroundResource(R.drawable.button_bg_on)
        } else {
            statusTextView.text = "Service is stopped"
            toggleButton.text = "OFF"
            toggleButton.setBackgroundResource(R.drawable.button_bg_off)
        }
    }

    private fun startCountdown(nextUpdateTimeMillis: Long) {
        countdownTimer?.cancel()
        val millisInFuture = nextUpdateTimeMillis - System.currentTimeMillis()
        if (millisInFuture <= 0) {
            countdownTextView.text = "Uploading..."
            return
        }

        countdownTimer = object : CountDownTimer(millisInFuture, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                countdownTextView.text = "in ${millisUntilFinished / 1000}s"
            }
            override fun onFinish() {
                countdownTextView.text = "Uploading..."
            }
        }.start()
    }

    private fun checkAndRequestPermissions() {
        val requiredPermissions = mutableListOf<String>()

        // 1. Fine Location (and Coarse)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requiredPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            requiredPermissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        // 2. Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requiredPermissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Request all needed permissions at once
        if (requiredPermissions.isNotEmpty()) {
            requestPermissionLauncher.launch(requiredPermissions.toTypedArray())
            return // Wait for user response
        }

        // 3. Background Location (Android 10+) - must be requested separately
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                // Explain why background location is needed
                AlertDialog.Builder(this)
                    .setTitle("Background Location Access")
                    .setMessage("This app requires background location access to track your position even when the app is closed. Please select 'Allow all the time' in the next screen.")
                    .setPositiveButton("Grant") { _, _ ->
                        // The launcher will now handle the result of this single permission request
                        requestPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
                return // Wait for user response
            }
        }

        // All permissions are granted, start the service
        startLocationService()
    }

    private fun startLocationService() {
        if (!PowerController.requestTurnOn(this, origin = "manual_button")) {
            Toast.makeText(this, "Cannot start – waiting for TURN_OFF confirmation.", Toast.LENGTH_LONG).show()
        }
    }

    private fun stopLocationService() {
        stopService(Intent(this, LocationService::class.java))
        SharedPreferencesHelper.setPowerState(this, PowerState.OFF, pendingAck = false, reason = "manual_stop")
        HandshakeManager.launchHandshake(this, reason = "manual_stop")
    }

    private fun runPreFlightChecks() {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        val errorMessages = mutableListOf<String>()
        if (!isLocationEnabled) errorMessages.add("• Location services are disabled.")

        if (errorMessages.isNotEmpty()) {
            showErrorDialog("Required services are inactive", errorMessages.joinToString(""))
        } else {
            checkAndRequestPermissions()
        }
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Understood", null)
            .show()
    }

    private fun showConsoleOptionsDialog() {
        val allLevels = ConsoleLogger.LogLevel.values()
        val levelNames = allLevels.map { it.name }.toTypedArray()
        val checkedItems = allLevels.map { ConsoleLogger.getDisplayedLogLevels().contains(it) }.toBooleanArray()

        AlertDialog.Builder(this)
            .setTitle("Console Log Level")
            .setMultiChoiceItems(levelNames, checkedItems) { _, which, isChecked ->
                checkedItems[which] = isChecked
            }
            .setPositiveButton("OK") { _, _ ->
                val selectedLevels = allLevels.filterIndexed { index, _ -> checkedItems[index] }.toSet()
                ConsoleLogger.setDisplayedLogLevels(this, selectedLevels)
            }
            .setNeutralButton("Clear") { _, _ ->
                ConsoleLogger.clear()
                Toast.makeText(this, "Console cleared", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun animateButton() {
        val anim = if (isServiceRunning) {
            AnimationUtils.loadAnimation(this, R.anim.scale_down)
        } else {
            AnimationUtils.loadAnimation(this, R.anim.scale_up)
        }
        toggleButton.startAnimation(anim)
    }
}