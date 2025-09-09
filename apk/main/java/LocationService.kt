package com.example.gpsreporterapp // Zde bude tvůj package name

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.android.gms.location.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class LocationService : Service() {

    companion object {
        const val ACTION_BROADCAST_STATUS = "com.example.gpsreporterapp.BROADCAST_STATUS"
        const val ACTION_REQUEST_STATUS_UPDATE = "com.example.gpsreporterapp.REQUEST_STATUS_UPDATE"
        const val EXTRA_STATUS_MESSAGE = "extra_status_message"
        const val EXTRA_IS_CONNECTION_EVENT = "extra_is_connection_event"
        const val EXTRA_NEXT_UPDATE_TIMESTAMP = "extra_next_update_timestamp"
        const val EXTRA_INTERVAL_MILLIS = "extra_interval_millis"
        const val EXTRA_CONSOLE_LOG = "extra_console_log"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var locationManager: LocationManager

    // Přijímač pro změnu stavu polohových služeb
    private val locationProviderReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (LocationManager.PROVIDERS_CHANGED_ACTION == intent?.action) {
                val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                        locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                if (!isLocationEnabled) {
                    Log.w("LocationService", "Location providers were disabled. Stopping service.")
                    broadcastLog("CHYBA: Polohové služby byly vypnuty. Služba se ukončuje.")
                    lastStatusMessage = "Poloha byla vypnuta. Služba zastavena."
                    lastConnectionStatusMessage = "Kritická chyba"
                    stopSelf() // Spustí onDestroy a korektně vše ukončí
                }
            }
        }
    }

    // Proměnné pro držení stavu služby
    private var lastStatusMessage: String = "Služba zastavena."
    private var lastConnectionStatusMessage: String = "-"
    private var nextUpdateTimestamp: Long = 0L

    // Výchozí interval, pokud server nepošle jiný
    private var sendIntervalMillis = TimeUnit.MINUTES.toMillis(1)

    private val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
    private val NOTIFICATION_ID = 12345

    override fun onCreate() {
        super.onCreate()
        broadcastLog("Služba vytvářena...")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager

        // Registrace přijímače pro sledování změn v poloze
        registerReceiver(locationProviderReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    Log.d("LocationService", "Nová poloha: ${location.latitude}, ${location.longitude}")
                    lastStatusMessage = "Nová poloha: ${String.format("%.4f, %.4f", location.latitude, location.longitude)}"
                    sendLocationAndProcessResponse(location)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_REQUEST_STATUS_UPDATE) {
            // Aktivita si žádá aktuální stav, tak jí ho pošleme
            broadcastCurrentState()
        } else {
            // Běžný start služby
        startForegroundService()
        startLocationUpdates()
        }
        return START_STICKY
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            sendIntervalMillis
        ).build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            val message = "Sledování spuštěno s intervalem ${sendIntervalMillis / 1000}s."
            Log.i("LocationService", message)
            broadcastLog(message)
            
            lastStatusMessage = message
            nextUpdateTimestamp = System.currentTimeMillis() + sendIntervalMillis
            broadcastCurrentState()
        } catch (e: SecurityException) {
            Log.e("LocationService", "Chybí oprávnění k poloze.", e)
            lastConnectionStatusMessage = "Chyba: Chybí oprávnění k poloze."
            lastStatusMessage = "Služba nemůže běžet."
            broadcastCurrentState()
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        Log.i("LocationService", "Sledování polohy zastaveno.")
    }

    private fun sendLocationAndProcessResponse(location: android.location.Location) {
        // Získání instance DAO
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()

        // Získání potřebných dat
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val deviceId = sharedPrefs.getString("device_id", null)

        if (deviceId == null) {
            Log.e("LocationService", "Device ID not found, cannot cache location.")
            broadcastLog("CHYBA: ID zařízení nenalezeno. Data nelze uložit.")
            return
        }
        
        val satellites = location.extras?.getInt("satellites", 0) ?: 0
        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

        // Vytvoření objektu pro uložení do databáze
        val cachedLocation = CachedLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            speed = if (location.hasSpeed()) location.speed * 3.6f else 0.0f, // m/s na km/h
            altitude = if (location.hasAltitude()) location.altitude else 0.0,
            accuracy = if (location.hasAccuracy()) location.accuracy else -1.0f,
            satellites = satellites,
            timestamp = location.time,
            deviceId = deviceId,
            deviceName = deviceName
        )

        // Uložení do databáze na pozadí pomocí coroutine
        // a naplánování odeslání pomocí WorkManageru
        CoroutineScope(Dispatchers.IO).launch {
            try {
                dao.insertLocation(cachedLocation)
                Log.d("LocationService", "Location cached successfully.")
                broadcastLog("Nová poloha uložena do cache.")

                // Vytvoření a naplánování jednorázové úlohy pro synchronizaci
                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
                
                val syncWorkRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(constraints)
                    .build()
                
                WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                    "sync_locations",
                    ExistingWorkPolicy.REPLACE,
                    syncWorkRequest
                )

            } catch (e: Exception) {
                Log.e("LocationService", "Failed to cache location", e)
                broadcastLog("CHYBA: Nepodařilo se uložit polohu do cache.")
            }
        }

        // Aktualizace UI, aby uživatel věděl, že se čeká na synchronizaci
        lastStatusMessage = "Čeká na synchronizaci..."
        nextUpdateTimestamp = System.currentTimeMillis() + sendIntervalMillis
        broadcastCurrentState()
    }

    private fun broadcastStatus(message: String, nextUpdateTimestamp: Long? = null, intervalMillis: Long? = null, isConnectionEvent: Boolean = false) {
        val intent = Intent(ACTION_BROADCAST_STATUS).apply {
            putExtra(EXTRA_STATUS_MESSAGE, message)
            putExtra(EXTRA_IS_CONNECTION_EVENT, isConnectionEvent)
            nextUpdateTimestamp?.let { putExtra(EXTRA_NEXT_UPDATE_TIMESTAMP, it) }
            intervalMillis?.let { putExtra(EXTRA_INTERVAL_MILLIS, it) }
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun broadcastCurrentState() {
        val intent = Intent(ACTION_BROADCAST_STATUS).apply {
            putExtra(EXTRA_STATUS_MESSAGE, lastStatusMessage)
            // Posíláme i specifickou zprávu o stavu spojení
            putExtra(EXTRA_IS_CONNECTION_EVENT, lastConnectionStatusMessage)
            putExtra(EXTRA_NEXT_UPDATE_TIMESTAMP, nextUpdateTimestamp)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun broadcastLog(message: String) {
        val intent = Intent(ACTION_BROADCAST_STATUS).apply {
            putExtra(EXTRA_CONSOLE_LOG, message)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Location Service Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val notification: Notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Sledování polohy aktivní")
            .setContentText("Aplikace zjišťuje vaši polohu na pozadí.")
            .setSmallIcon(R.drawable.ic_gps_pin)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(locationProviderReceiver)
        broadcastLog("Služba zničena.")
        stopLocationUpdates()
        lastStatusMessage = "Služba je zastavena."
        lastConnectionStatusMessage = "-"
        nextUpdateTimestamp = 0
        broadcastCurrentState()
        Log.d("LocationService", "Služba zastavena.")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}