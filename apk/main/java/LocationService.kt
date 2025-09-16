package com.example.gpsreporterapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.work.*
import com.google.android.gms.location.*
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class LocationService : Service() {

    companion object {
        const val ACTION_BROADCAST_STATUS = "com.example.gpsreporterapp.BROADCAST_STATUS"
        const val ACTION_REQUEST_STATUS_UPDATE = "com.example.gpsreporterapp.REQUEST_STATUS_UPDATE"
        const val EXTRA_SERVICE_STATE = "extra_service_state"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var locationManager: LocationManager

    private var gpsIntervalSeconds: Int = 60 // Default to 60 seconds
    private var syncIntervalCount: Int = 1 // Default to 1 location before sending
    private var locationsCachedCount: Int = 0

    private var sendIntervalMillis: Long = 0

    private var currentServiceState: ServiceState = ServiceState()
    private val gson = Gson()

    private val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
    private val NOTIFICATION_ID = 12345

    private val locationProviderReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (LocationManager.PROVIDERS_CHANGED_ACTION == intent?.action) {
                val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                        locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                if (!isLocationEnabled) {
                    updateAndBroadcastState(
                        status = "Služba zastavena (GPS vypnuto)",
                        connectionStatus = "Kritická chyba",
                        isRunning = false
                    )
                    stopSelf()
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        registerReceiver(locationProviderReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    updateAndBroadcastState(status = "Získána nová poloha")
                    sendLocationAndProcessResponse(location)
                }
            }
        }
        updateAndBroadcastState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_REQUEST_STATUS_UPDATE) {
            // Send current state immediately
            val intent = Intent(ACTION_BROADCAST_STATUS).apply {
                putExtra(EXTRA_SERVICE_STATE, gson.toJson(currentServiceState))
            }
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
        } else {
            val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
            gpsIntervalSeconds = sharedPrefs.getInt("gps_interval_seconds", 60)
            syncIntervalCount = sharedPrefs.getInt("sync_interval_count", 1)
            sendIntervalMillis = TimeUnit.SECONDS.toMillis(gpsIntervalSeconds.toLong())

            startForegroundService()
            startLocationUpdates()
        }
        return START_STICKY
    }

    private fun startLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            sendIntervalMillis
        ).build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            updateAndBroadcastState(
                status = "Sledování polohy aktivní",
                connectionStatus = "Čekání na signál GPS",
                nextUpdate = System.currentTimeMillis() + sendIntervalMillis,
                isRunning = true
            )
        } catch (e: SecurityException) {
            updateAndBroadcastState(
                status = "Služba zastavena (chyba oprávnění)",
                connectionStatus = "Chyba oprávnění",
                isRunning = false
            )
        }
    }

    private fun enqueueSyncWorker() {
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val syncWorkRequest = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).build()
        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
            "sync_locations",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )

        CoroutineScope(Dispatchers.Main).launch {
            WorkManager.getInstance(applicationContext).getWorkInfoByIdLiveData(syncWorkRequest.id)
                .observeForever { workInfo ->
                    if (workInfo != null) {
                        when (workInfo.state) {
                            WorkInfo.State.SUCCEEDED -> {
                                updateAndBroadcastState(connectionStatus = "Synchronizace úspěšná", isRunning = true)
                            }
                            WorkInfo.State.FAILED -> {
                                updateAndBroadcastState(connectionStatus = "Chyba synchronizace", isRunning = true)
                            }
                            WorkInfo.State.CANCELLED -> {
                                updateAndBroadcastState(connectionStatus = "Synchronizace zrušena", isRunning = true)
                            }
                            else -> {
                                // Do nothing for other states like ENQUEUED, RUNNING, BLOCKED
                            }
                        }
                    }
                }
        }
        updateAndBroadcastState(connectionStatus = "Synchronizace s serverem", isRunning = true)
    }

    private fun sendLocationAndProcessResponse(location: Location) {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val deviceId = sharedPrefs.getString("device_id", null)

        if (deviceId == null) {
            updateAndBroadcastState()
            return
        }

        val cachedLocation = CachedLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            speed = if (location.hasSpeed()) location.speed * 3.6f else 0.0f,
            altitude = if (location.hasAltitude()) location.altitude else 0.0,
            accuracy = if (location.hasAccuracy()) location.accuracy else -1.0f,
            satellites = location.extras?.getInt("satellites", 0) ?: 0,
            timestamp = location.time,
            deviceId = deviceId,
            deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
        )

        CoroutineScope(Dispatchers.IO).launch {
            try {
                dao.insertLocation(cachedLocation)

                launch(Dispatchers.Main) {
                    updateAndBroadcastState(
                        status = "Poloha uložena do mezipaměti",
                        connectionStatus = "Čekání na synchronizaci",
                        nextUpdate = System.currentTimeMillis() + sendIntervalMillis,
                        isRunning = true
                    )
                }

                locationsCachedCount++

                if (locationsCachedCount >= syncIntervalCount) {
                    val currentCachedLocations = dao.getAllCachedLocations()
                    if (currentCachedLocations.isNotEmpty()) {
                        enqueueSyncWorker()
                        locationsCachedCount = 0
                    } else {
                        locationsCachedCount = 0 // Reset count even if not enqueuing
                    }
                }

            } catch (e: Exception) {
                launch(Dispatchers.Main) {
                    updateAndBroadcastState()
                }
            }
        }
    }

    private fun updateAndBroadcastState(
        status: String? = null,
        connectionStatus: String? = null,
        nextUpdate: Long? = null,
        isRunning: Boolean? = null,
        resetLocationsCachedCount: Boolean = false
    ) {
        if (resetLocationsCachedCount) {
            locationsCachedCount = 0
        }

        currentServiceState = currentServiceState.copy(
            isRunning = isRunning ?: currentServiceState.isRunning,
            statusMessage = status ?: currentServiceState.statusMessage,
            connectionStatus = connectionStatus ?: currentServiceState.connectionStatus,
            nextUpdateTimestamp = nextUpdate ?: currentServiceState.nextUpdateTimestamp
        )

        val intent = Intent(ACTION_BROADCAST_STATUS).apply {
            putExtra(EXTRA_SERVICE_STATE, gson.toJson(currentServiceState))
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    private fun startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, "Location Service Channel", NotificationManager.IMPORTANCE_DEFAULT)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        val notification: Notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Sledování polohy aktivní")
            .setContentText("Aplikace sleduje vaši polohu na pozadí.")
            .setSmallIcon(R.drawable.ic_gps_pin)
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(locationProviderReceiver)
        fusedLocationClient.removeLocationUpdates(locationCallback)
        updateAndBroadcastState(
            status = "Služba zastavena",
            connectionStatus = "-",
            nextUpdate = 0,
            isRunning = false,
            resetLocationsCachedCount = true
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null
}