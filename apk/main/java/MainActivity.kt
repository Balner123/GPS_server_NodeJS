package com.example.gpsreporterapp // Zde bude tvůj package name

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
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
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var statusTextView: TextView
    private lateinit var toggleButton: TextView
    private lateinit var lastConnectionStatusTextView: TextView
    private lateinit var countdownTextView: TextView
    private lateinit var lastLocationTextView: TextView
    private lateinit var consoleTextView: TextView
    private lateinit var consoleScrollView: ScrollView

    private var countdownTimer: CountDownTimer? = null
    private val gson = Gson()
    private var isServiceRunning = false

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

        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
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
        consoleTextView = findViewById(R.id.consoleTextView)
        consoleScrollView = findViewById(R.id.consoleScrollView)

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
            consoleTextView.text = logs.joinToString("
")
            consoleScrollView.post { consoleScrollView.fullScroll(View.FOCUS_DOWN) }
        }
    }

    private fun performLogout() {
        stopLocationService()
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit()
            .remove("session_cookie")
            .putBoolean("isAuthenticated", false)
            .apply()
        Toast.makeText(this, "Odhlášení úspěšné.", Toast.LENGTH_SHORT).show()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(LocationService.ACTION_BROADCAST_STATUS)
        LocalBroadcastManager.getInstance(this).registerReceiver(statusReceiver, filter)

        // Požádáme službu o poslání aktuálního stavu
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_REQUEST_STATUS_UPDATE
        }
        startService(intent)
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
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
        val intent = Intent(this, LocationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopLocationService() {
        stopService(Intent(this, LocationService::class.java))
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