package com.example.gpsreporterapp // Zde bude tvůj package name

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

    private val logoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(LocationService.EXTRA_LOGOUT_MESSAGE) ?: "Došlo k chybě přihlášení."
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
                        cachedCountTextView.text = "Pozic v mezipaměti: ${serviceState.cachedCount}"
                        val powerStatus = serviceState.powerStatus
                        powerStatusTextView.text = "Power: ${powerStatus}"
                        if (!powerStatus.equals(lastPowerStatus, ignoreCase = true)) {
                            if (powerStatus.equals("OFF", ignoreCase = true) && serviceState.connectionStatus.contains("instrukce", true)) {
                                Toast.makeText(this@MainActivity, "Službu vypnul server.", Toast.LENGTH_LONG).show()
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
            if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
                checkAndRequestPermissions()
            } else {
                Toast.makeText(this, "Povolení k poloze je nutné pro funkčnost aplikace.", Toast.LENGTH_LONG).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val sharedPrefs = getEncryptedSharedPreferences()
        if (!sharedPrefs.getBoolean("isAuthenticated", false)) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        // Propojení UI prvků
        statusTextView = findViewById(R.id.statusTextView)
        toggleButton = findViewById(R.id.toggleButton)
        lastConnectionStatusTextView = findViewById(R.id.lastConnectionStatusTextView)
        countdownTextView = findViewById(R.id.countdownTextView)
        lastLocationTextView = findViewById(R.id.lastLocationTextView)
        cachedCountTextView = findViewById(R.id.cachedCountTextView)
        powerStatusTextView = findViewById(R.id.powerStatusTextView)
        consoleTextView = findViewById(R.id.consoleTextView)
        consoleScrollView = findViewById(R.id.consoleScrollView)

        lastPowerStatus = SharedPreferencesHelper.getPowerState(this).toString()
        powerStatusTextView.text = "Power: ${lastPowerStatus}"

        updateUiState(false) // Nastaví výchozí stav (služba není spuštěna)

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
                .setTitle("Odhlásit se?")
                .setMessage("Opravdu se chcete odhlásit?")
                .setPositiveButton("Ano") { _, _ -> performLogout() }
                .setNegativeButton("Ne", null)
                .show()
            true
        }

        val consoleCard = findViewById<CardView>(R.id.consoleCard)
        consoleCard.setOnLongClickListener {
            AlertDialog.Builder(this)
                .setTitle("Vymazat konzoli?")
                .setMessage("Opravdu chcete vymazat obsah konzole?")
                .setPositiveButton("Ano") { _, _ -> ConsoleLogger.clear() }
                .setNegativeButton("Ne", null)
                .show()
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
                .setTitle("Odhlášení")
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

            SharedPreferencesHelper.setPowerState(this@MainActivity, PowerState.OFF)
            sharedPrefs.edit()
                .remove("session_cookie")
                .putBoolean("isAuthenticated", false)
                .apply()
            Toast.makeText(this@MainActivity, "Odhlášení úspěšné.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this@MainActivity, LoginActivity::class.java))
            finish()
        }
    }

    private suspend fun sendLogoutRequest(baseUrl: String, sessionCookie: String) {
        withContext(Dispatchers.IO) {
            try {
                ConsoleLogger.log("Odesílám požadavek na odhlášení...")
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
                    ConsoleLogger.log("Odhlášení selhalo ($code): $body")
                } else {
                    ConsoleLogger.log("Odhlášení proběhlo úspěšně ($code)")
                }
            } catch (e: Exception) {
                ConsoleLogger.log("Chyba při odhlášení: ${e.message}")
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
        registerReceiver(logoutReceiver, logoutFilter)


        // Požádáme službu o poslání aktuálního stavu
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_REQUEST_STATUS_UPDATE
        }
        startService(intent)
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
        unregisterReceiver(logoutReceiver)
        countdownTimer?.cancel()
    }

    private fun updateUiState(isServiceRunning: Boolean) {
        if (isServiceRunning) {
            statusTextView.text = "Služba je aktivní"
            toggleButton.text = "ON"
            toggleButton.setBackgroundResource(R.drawable.button_bg_on)
        } else {
            statusTextView.text = "Služba je zastavena"
            toggleButton.text = "OFF"
            toggleButton.setBackgroundResource(R.drawable.button_bg_off)
        }
    }

    private fun startCountdown(nextUpdateTimeMillis: Long) {
        countdownTimer?.cancel()
        val millisInFuture = nextUpdateTimeMillis - System.currentTimeMillis()
        if (millisInFuture <= 0) {
            countdownTextView.text = "Probíhá odeslání..."
            return
        }

        countdownTimer = object : CountDownTimer(millisInFuture, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                countdownTextView.text = "za ${millisUntilFinished / 1000}s"
            }
            override fun onFinish() {
                countdownTextView.text = "Probíhá odeslání..."
            }
        }.start()
    }

    private fun checkAndRequestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
                return
            }
        }
        startLocationService()
    }

    private fun startLocationService() {
        SharedPreferencesHelper.setPowerState(this, PowerState.ON)
        val intent = Intent(this, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopLocationService() {
        stopService(Intent(this, LocationService::class.java))
        SharedPreferencesHelper.setPowerState(this, PowerState.OFF)
    }

    private fun runPreFlightChecks() {
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        val errorMessages = mutableListOf<String>()
        if (!isLocationEnabled) errorMessages.add("• Služby pro určování polohy jsou vypnuté.")

        if (errorMessages.isNotEmpty()) {
            showErrorDialog("Požadované služby nejsou aktivní", errorMessages.joinToString(""))
        } else {
            checkAndRequestPermissions()
        }
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Rozumím", null)
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