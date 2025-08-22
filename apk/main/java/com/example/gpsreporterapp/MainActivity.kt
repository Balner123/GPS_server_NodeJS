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
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var statusTextView: TextView
    private lateinit var toggleButton: TextView

    // Nové UI prvky
    private lateinit var lastConnectionStatusTextView: TextView
    private lateinit var countdownTextView: TextView
    private lateinit var lastLocationTextView: TextView
    private lateinit var consoleTextView: TextView
    private lateinit var consoleScrollView: ScrollView

    private var countdownTimer: CountDownTimer? = null
    private var isServiceRunning = false

    // Přijímač zpráv z LocationService
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                if (it.action == LocationService.ACTION_BROADCAST_STATUS) {
                    // Zpracování logovacích zpráv pro konzoli
                    if (it.hasExtra(LocationService.EXTRA_CONSOLE_LOG)) {
                        val logMessage = it.getStringExtra(LocationService.EXTRA_CONSOLE_LOG)
                        appendToConsole(logMessage)
                    }

                    // Zpracování běžných stavových zpráv
                    val statusMessage = it.getStringExtra(LocationService.EXTRA_STATUS_MESSAGE)
                    val connectionMessage = it.getStringExtra(LocationService.EXTRA_IS_CONNECTION_EVENT) // Nyní posíláme přímo zprávu
                    
                    if (statusMessage != null || connectionMessage != null) {
                        // Zjistíme, jestli služba běží, z jedné ze zpráv
                        isServiceRunning = statusMessage?.contains("zastavena") == false
                        updateUiState()

                        lastLocationTextView.text = statusMessage ?: lastLocationTextView.text
                        lastConnectionStatusTextView.text = connectionMessage ?: lastConnectionStatusTextView.text

                        if (it.hasExtra(LocationService.EXTRA_NEXT_UPDATE_TIMESTAMP)) {
                            val nextUpdateTime = it.getLongExtra(LocationService.EXTRA_NEXT_UPDATE_TIMESTAMP, 0)
                            if (nextUpdateTime > 0) {
                                startCountdown(nextUpdateTime)
                            } else {
                                countdownTimer?.cancel()
                                countdownTextView.text = "-"
                            }
                        }
                    }
                }
            }
        }
    }

    // Moderní způsob, jak zpracovat výsledek žádosti o povolení
    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            // Zkontrolujeme, zda bylo uděleno hlavní oprávnění pro polohu na popředí
            if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
                // Pokud ano, zkusíme znovu zkontrolovat oprávnění.
                // Tím se buď spustí služba, nebo se vyžádá oprávnění pro běh na pozadí.
                checkAndRequestPermissions()
            } else {
                // Uživatel odmítl klíčové povolení.
                Toast.makeText(this, "Povolení k poloze je nutné pro funkčnost aplikace.", Toast.LENGTH_LONG).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Musí být zavoláno před super.onCreate()
        installSplashScreen()

        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Kontrola přihlášení
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val isAuthenticated = sharedPrefs.getBoolean("isAuthenticated", false)

        if (!isAuthenticated) {
            val intent = Intent(this, LoginActivity::class.java)
            startActivity(intent)
            finish() // Ukončí MainActivity, aby se uživatel nemohl vrátit zpět bez přihlášení
            return
        }

        // Propojení prvků z XML s proměnnými v kódu
        statusTextView = findViewById(R.id.statusTextView)
        toggleButton = findViewById(R.id.toggleButton)
        lastConnectionStatusTextView = findViewById(R.id.lastConnectionStatusTextView)
        countdownTextView = findViewById(R.id.countdownTextView)
        lastLocationTextView = findViewById(R.id.lastLocationTextView)
        consoleTextView = findViewById(R.id.consoleTextView)
        consoleScrollView = findViewById(R.id.consoleScrollView)

        // Výchozí stav je vždy "OFF"
        updateUiState()

        toggleButton.setOnClickListener {
            animateButton()
            if (isServiceRunning) {
                stopLocationService()
            } else {
                runPreFlightChecks()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(LocationService.ACTION_BROADCAST_STATUS)
        LocalBroadcastManager.getInstance(this).registerReceiver(statusReceiver, filter)

        // Požádáme službu o poslání aktuálního stavu, aby se UI obnovilo
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_REQUEST_STATUS_UPDATE
        }
        // Použijeme startService, které jen doručí intent běžící službě
        startService(intent)
        }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
        countdownTimer?.cancel()
        countdownTextView.text = "-"
        lastConnectionStatusTextView.text = "-"
        lastLocationTextView.text = "Služba je zastavena."
    }

    private fun updateUiState() {
        if (isServiceRunning) {
            statusTextView.text = "Služba je aktivní"
            toggleButton.text = "ON"
            toggleButton.setBackgroundResource(R.drawable.button_bg_on)
        } else {
            statusTextView.text = "Služba je zastavena"
            toggleButton.text = "OFF"
            toggleButton.setBackgroundResource(R.drawable.button_bg_off)
            countdownTimer?.cancel()
            countdownTextView.text = "-"
            lastConnectionStatusTextView.text = "-"
            lastLocationTextView.text = "Služba je zastavena."
        }
    }

    private fun appendToConsole(message: String?) {
        if (message == null) return

        // Udržujeme konzoli v rozumné délce, aby nedošlo k přetečení paměti
        val currentText = consoleTextView.text.toString()
        val lines = currentText.split("\n")
        val textToKeep = if (lines.size > 100) {
            lines.subList(lines.size - 99, lines.size).joinToString("\n") + "\n"
        } else {
            currentText + "\n"
        }

        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        consoleTextView.text = "$textToKeep[$timestamp] $message"

        // Automatické posunutí na konec
        consoleScrollView.post {
            consoleScrollView.fullScroll(View.FOCUS_DOWN)
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
                val seconds = millisUntilFinished / 1000
                countdownTextView.text = "za ${seconds}s"
            }

            override fun onFinish() {
                countdownTextView.text = "Probíhá odeslání..."
            }
        }.start()
    }

    private fun checkAndRequestPermissions() {
        // Nejprve zkontrolujeme oprávnění pro polohu na popředí
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return
        }

        // Pokud máme oprávnění pro popředí a běžíme na Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Zkontrolujeme oprávnění pro běh na pozadí
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                // A pokud ho nemáme, požádáme o něj
                requestPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
                return
            }
        }

        // Pokud máme všechna potřebná oprávnění, spustíme službu
            startLocationService()
    }

    private fun startLocationService() {
        val intent = Intent(this, LocationService::class.java)
        // Pro Android 8+ musíme použít startForegroundService
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        // UI se aktualizuje po přijetí broadcastu ze služby
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
        isServiceRunning = false
        updateUiState()
        Toast.makeText(this, "Sledování polohy zastaveno.", Toast.LENGTH_SHORT).show()
    }

    private fun runPreFlightChecks() {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val networkInfo = connectivityManager.activeNetworkInfo
        val isNetworkConnected = networkInfo != null && networkInfo.isConnected

        val locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

        val errorMessages = mutableListOf<String>()
        if (!isNetworkConnected) {
            errorMessages.add("• Připojení k internetu není k dispozici.")
        }
        if (!isLocationEnabled) {
            errorMessages.add("• Služby pro určování polohy jsou vypnuté.")
        }

        if (errorMessages.isNotEmpty()) {
            showErrorDialog("Požadované služby nejsou aktivní", errorMessages.joinToString("\n"))
        } else {
            // Všechny kontroly prošly, pokračujeme s oprávněními
            checkAndRequestPermissions()
        }
    }

    private fun showErrorDialog(title: String, message: String) {
        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("Rozumím") { dialog, _ ->
                dialog.dismiss()
            }
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