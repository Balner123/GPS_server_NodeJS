package com.example.gpsreporterapp // Zde bude tvůj package name

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
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.work.*
import com.google.android.gms.location.*
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
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

    private var sendIntervalMillis: Long = TimeUnit.SECONDS.toMillis(gpsIntervalSeconds.tolong())

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
                    Log.w("LocationService", "Location providers were disabled.")
                    updateAndBroadcastState(
                        log = "FATAL: Location providers disabled. Service stopping.",
                        status = "Service stopped (location disabled)",
                        connectionStatus = "Critical Error",
                        isRunning = false
                    )
                    stopSelf()
                }
            }
        }
    }

    override fun onCreate() {
        Log.d("LocationService", "onCreate called.")
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        registerReceiver(locationProviderReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    val status = "New location: ${location.latitude}, ${location.longitude}"
                    Log.d("LocationService", status)
                    updateAndBroadcastState(status = status, log = "New location received: (lat: ${location.latitude}, lon: ${location.longitude}, acc: ${location.accuracy}m)")
                    sendLocationAndProcessResponse(location)
                }
            }
        }
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        gpsIntervalSeconds = sharedPrefs.getInt("gps_interval_seconds", 60)
        syncIntervalCount = sharedPrefs.getInt("sync_interval_count", 1)
        sendIntervalMillis = TimeUnit.SECONDS.toMillis(gpsIntervalSeconds.toLong())

        updateAndBroadcastState(log = "Service created and ready. GPS Interval: ${gpsIntervalSeconds}s, Sync Every: ${syncIntervalCount} locations.")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("LocationService", "onStartCommand called with action: ${intent?.action}")
        if (intent?.action == ACTION_REQUEST_STATUS_UPDATE) {
            // Send current state immediately
            val intent = Intent(ACTION_BROADCAST_STATUS).apply {
                putExtra(EXTRA_SERVICE_STATE, gson.toJson(currentServiceState))
            }
            LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
        } else {
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
            val message = "Location tracking started. Interval: ${sendIntervalMillis / 1000}s."
            Log.i("LocationService", message)
            updateAndBroadcastState(
                log = message,
                status = "Tracking active",
                connectionStatus = "Awaiting location fix...",
                nextUpdate = System.currentTimeMillis() + sendIntervalMillis
            )
        } catch (e: SecurityException) {
            Log.e("LocationService", "Missing location permission.", e)
            updateAndBroadcastState(
                log = "ERROR: Missing location permission.",
                status = "Service stopped (permission error)",
                connectionStatus = "Permission Error",
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
                                Log.d("LocationService", "SyncWorker SUCCEEDED.")
                                updateAndBroadcastState(log = "SyncWorker finished: SUCCESS", connectionStatus = "Synced", isRunning = true)
                            }
                            WorkInfo.State.FAILED -> {
                                Log.e("LocationService", "SyncWorker FAILED.")
                                updateAndBroadcastState(log = "SyncWorker finished: FAILED", connectionStatus = "Sync Failed", isRunning = true)
                            }
                            WorkInfo.State.CANCELLED -> {
                                Log.w("LocationService", "SyncWorker CANCELLED.")
                                updateAndBroadcastState(log = "SyncWorker finished: CANCELLED", connectionStatus = "Sync Cancelled", isRunning = true)
                            }
                            else -> {
                                // Do nothing for other states like ENQUEUED, RUNNING, BLOCKED
                            }
                        }
                    }
                }
        }
        updateAndBroadcastState(log = "SyncWorker enqueued.", connectionStatus = "Syncing...", isRunning = true)
    }

    private fun sendLocationAndProcessResponse(location: Location) {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val deviceId = sharedPrefs.getString("device_id", null)

        if (deviceId == null) {
            Log.e("LocationService", "Device ID not found, cannot cache location.")
            updateAndBroadcastState(log = "ERROR: Device ID not found. Cannot cache location.")
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
                Log.d("LocationService", "Location cached successfully.")

                launch(Dispatchers.Main) {
                    updateAndBroadcastState(
                        log = "Location cached. Locations until sync: ${syncIntervalCount - (locationsCachedCount + 1)}",
                        status = "Location cached",
                        connectionStatus = "Awaiting sync...",
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
                        Log.d("LocationService", "No cached locations to sync, skipping SyncWorker enqueue.")
                        locationsCachedCount = 0 // Reset count even if not enqueuing
                    }
                }

            } catch (e: Exception) {
                Log.e("LocationService", "Failed to cache location", e)
                launch(Dispatchers.Main) {
                    updateAndBroadcastState(log = "ERROR: Failed to cache location: ${e.message}")
                }
            }
        }
    }

    private fun updateAndBroadcastState(
        log: String? = null,
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
            nextUpdateTimestamp = nextUpdate ?: currentServiceState.nextUpdateTimestamp,
            consoleLog = log
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
            .setContentTitle("Location Tracking Active")
            .setContentText("The app is tracking your location in the background.")
            .setSmallIcon(R.drawable.ic_gps_pin)
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onDestroy() {
        Log.d("LocationService", "onDestroy called.")
        super.onDestroy()
        unregisterReceiver(locationProviderReceiver)
        fusedLocationClient.removeLocationUpdates(locationCallback)
        Log.d("LocationService", "Service destroyed.")
        updateAndBroadcastState(
            log = "Service stopped.",
            status = "Service is stopped.",
            connectionStatus = "-",
            nextUpdate = 0,
            isRunning = false,
            resetLocationsCachedCount = true
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null
}nt: Intent?): IBinder? = null
}ll
}