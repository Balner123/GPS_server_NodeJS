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
import android.app.PendingIntent
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class LocationService : Service() {

    companion object {
        const val ACTION_BROADCAST_STATUS = "com.example.gpsreporterapp.BROADCAST_STATUS"
        const val ACTION_REQUEST_STATUS_UPDATE = "com.example.gpsreporterapp.REQUEST_STATUS_UPDATE"
        const val ACTION_FORCE_LOGOUT = "com.example.gpsreporterapp.FORCE_LOGOUT"
        const val EXTRA_SERVICE_STATE = "extra_service_state"
        const val EXTRA_LOGOUT_MESSAGE = "extra_logout_message"
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
                    ConsoleLogger.log("Poskytovatelé polohy byli deaktivováni. Služba se zastavuje.")
                    SharedPreferencesHelper.setPowerState(applicationContext, PowerState.OFF)
                    HandshakeManager.launchHandshake(applicationContext, reason = "gps_disabled")
                    updateAndBroadcastState(
                        status = StatusMessages.SERVICE_STOPPED_GPS_OFF,
                        connectionStatus = "Kritická chyba",
                        isRunning = false,
                        powerStatus = PowerState.OFF
                    )
                    stopSelf()
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        ConsoleLogger.log("Služba LocationService se vytváří.")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        registerReceiver(locationProviderReceiver, IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION))

        currentServiceState.powerStatus = SharedPreferencesHelper.getPowerState(this).toString()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    ConsoleLogger.log("Nová poloha: lat=${location.latitude}, lon=${location.longitude}")
                    updateAndBroadcastState(status = StatusMessages.NEW_LOCATION_OBTAINED)
                    sendLocationAndProcessResponse(location)
                }
            }
        }
        updateAndBroadcastState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_REQUEST_STATUS_UPDATE) {
            val broadcastIntent = Intent(ACTION_BROADCAST_STATUS).apply {
                putExtra(EXTRA_SERVICE_STATE, gson.toJson(currentServiceState))
            }
            LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent)
            return START_NOT_STICKY // Jen posíláme stav, nechceme restartovat službu
        }

        ConsoleLogger.log("Služba LocationService spuštěna.")
        updateAndBroadcastState(status = StatusMessages.SERVICE_STARTING, isRunning = true, powerStatus = PowerState.ON)

        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        gpsIntervalSeconds = sharedPrefs.getInt("gps_interval_seconds", 60)
        syncIntervalCount = sharedPrefs.getInt("sync_interval_count", 1)
        sendIntervalMillis = TimeUnit.SECONDS.toMillis(gpsIntervalSeconds.toLong())
        ConsoleLogger.log("Nastaven interval GPS: ${gpsIntervalSeconds}s, Odeslání po: ${syncIntervalCount} pozicích.")

        SharedPreferencesHelper.setPowerState(applicationContext, PowerState.ON)
        HandshakeManager.launchHandshake(applicationContext, reason = "service_start")
    HandshakeManager.schedulePeriodicHandshake(applicationContext)

        startForegroundService()
        startLocationUpdates()

        return START_STICKY
    }

    private fun startLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)

        // Okamžité zjištění polohy při startu
        try {
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { location: Location? ->
                    location?.let {
                        ConsoleLogger.log("Získána okamžitá poloha při startu.")
                        sendLocationAndProcessResponse(it)
                    }
                }
                .addOnFailureListener { e ->
                    ConsoleLogger.log("Nepodařilo se získat okamžitou polohu: ${e.message}")
                }
        } catch (e: SecurityException) {
            ConsoleLogger.log("Chyba oprávnění při žádosti o okamžitou polohu: ${e.message}")
        }

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            sendIntervalMillis
        ).build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            ConsoleLogger.log("Sledování polohy spuštěno.")
            updateAndBroadcastState(
                status = StatusMessages.TRACKING_ACTIVE,
                connectionStatus = StatusMessages.WAITING_FOR_GPS,
                nextUpdate = System.currentTimeMillis() + sendIntervalMillis,
                isRunning = true,
                powerStatus = PowerState.ON
            )
        } catch (e: SecurityException) {
            ConsoleLogger.log("Chyba oprávnění při startu sledování polohy.")
            updateAndBroadcastState(
                status = StatusMessages.SERVICE_STOPPED_PERMISSIONS,
                connectionStatus = "Chyba oprávnění",
                isRunning = false
            )
            stopSelf() // Stop the service if permissions are missing
        }
    }

    private fun enqueueSyncWorker() {
        ConsoleLogger.log("Plánování úlohy SyncWorker.")
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val syncWorkRequest = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(constraints).build()
        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
            "sync_locations",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )

        updateAndBroadcastState(connectionStatus = StatusMessages.SYNC_IN_PROGRESS, isRunning = true)

        CoroutineScope(Dispatchers.Main).launch {
            WorkManager.getInstance(applicationContext).getWorkInfoByIdLiveData(syncWorkRequest.id)
                .observeForever { workInfo ->
                    if (workInfo != null) {
                        when (workInfo.state) {
                            WorkInfo.State.SUCCEEDED -> {
                                ConsoleLogger.log("SyncWorker dokončen: Úspěch.")
                                updateAndBroadcastState(status = StatusMessages.TRACKING_ACTIVE, connectionStatus = StatusMessages.SYNC_SUCCESS, isRunning = true)
                            }
                            WorkInfo.State.FAILED -> {
                                ConsoleLogger.log("SyncWorker selhal.")
                                updateAndBroadcastState(status = StatusMessages.TRACKING_ACTIVE, connectionStatus = StatusMessages.SYNC_FAILED, isRunning = true)
                            }
                            WorkInfo.State.CANCELLED -> {
                                ConsoleLogger.log("SyncWorker zrušen.")
                                updateAndBroadcastState(status = StatusMessages.TRACKING_ACTIVE, connectionStatus = StatusMessages.SYNC_CANCELLED, isRunning = true)
                            }
                            else -> {
                                // Stavy ENQUEUED, RUNNING, BLOCKED - necháváme "Probíhá odesílání..."
                            }
                        }
                    }
                }
        }
    }

    private fun sendLocationAndProcessResponse(location: Location) {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(applicationContext)
        val deviceId = sharedPrefs.getString("device_id", null)
        val powerState = SharedPreferencesHelper.getPowerState(applicationContext)

        if (deviceId == null) {
            ConsoleLogger.log(StatusMessages.DEVICE_ID_ERROR)
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
            deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
            powerStatus = powerState.toString()
        )

        CoroutineScope(Dispatchers.IO).launch {
            try {
                dao.insertLocation(cachedLocation)
                locationsCachedCount++
                ConsoleLogger.log("Poloha uložena do mezipaměti (cache=${locationsCachedCount})")

                // Zde se rozhoduje, zda se má spustit synchronizace
                if (locationsCachedCount >= syncIntervalCount) {
                    enqueueSyncWorker()
                    locationsCachedCount = 0 // Reset counter
                }

                updateAndBroadcastState(
                    status = StatusMessages.LOCATION_CACHED,
                    cachedCount = locationsCachedCount,
                    powerStatus = powerState
                )

            } catch (e: Exception) {
                ConsoleLogger.log("Chyba při ukládání polohy do DB: ${e.message}")
                updateAndBroadcastState(status = StatusMessages.DB_SAVE_ERROR)
            }
        }
    }

    private fun startForegroundService() {
        createNotificationChannel()

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("GPS Reportér Aktivní")
            .setContentText("Služba pro sledování polohy běží na pozadí.")
            .setSmallIcon(R.drawable.ic_gps_pin)
            .setContentIntent(pendingIntent)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Location Service Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun updateAndBroadcastState(
        status: String? = null,
        connectionStatus: String? = null,
        nextUpdate: Long? = null,
        isRunning: Boolean? = null,
        cachedCount: Int? = null,
        powerStatus: PowerState? = null
    ) {
        // Update current state
        status?.let { currentServiceState.statusMessage = it }
        connectionStatus?.let { currentServiceState.connectionStatus = it }
        nextUpdate?.let { currentServiceState.nextUpdateTimestamp = it }
        isRunning?.let { currentServiceState.isRunning = it }
        cachedCount?.let { currentServiceState.cachedCount = it }
        val persistedPower = SharedPreferencesHelper.getPowerState(this)
        val resolvedPower = powerStatus ?: persistedPower
        currentServiceState.powerStatus = resolvedPower.toString()
        if (resolvedPower == PowerState.OFF) {
            currentServiceState.isRunning = false
        }


        // Broadcast the updated state
        val intent = Intent(ACTION_BROADCAST_STATUS).apply {
            putExtra(EXTRA_SERVICE_STATE, gson.toJson(currentServiceState))
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        ConsoleLogger.log("Služba LocationService se zastavuje.")
        fusedLocationClient.removeLocationUpdates(locationCallback)
        unregisterReceiver(locationProviderReceiver)
        SharedPreferencesHelper.setPowerState(applicationContext, PowerState.OFF)
        HandshakeManager.launchHandshake(applicationContext, reason = "service_stop")
        HandshakeManager.cancelPeriodicHandshake(applicationContext)
        // Send final state update to ensure UI is correct
        updateAndBroadcastState(
            status = StatusMessages.SERVICE_STOPPED,
            connectionStatus = "Neaktivní",
            nextUpdate = 0,
            isRunning = false,
            powerStatus = PowerState.OFF
        )
        ConsoleLogger.log("Služba LocationService zničena.")
    }

    override fun onBind(intent: Intent): IBinder? {
        return null
    }
}