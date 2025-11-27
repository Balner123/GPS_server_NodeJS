package com.example.gpsreporterapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class LocationService : Service() {

    companion object {
        const val ACTION_FORCE_LOGOUT = "com.example.gpsreporterapp.FORCE_LOGOUT"
        const val EXTRA_LOGOUT_MESSAGE = "extra_logout_message"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var locationManager: LocationManager
    private lateinit var connectivityManager: ConnectivityManager

    private var gpsIntervalSeconds: Int = 60 
    private var syncIntervalCount: Int = 1 

    private var sendIntervalMillis: Long = 0
    private var isNetworkAvailable: Boolean = true
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    
    private var isStopping: Boolean = false

    private var currentServiceState: ServiceState = ServiceState()
    private var lastProcessedLocationTime: Long = 0
    
    // Flag to force immediate upload for the first location after startup
    private var isFirstLocationAfterStart: Boolean = true

    private val NOTIFICATION_CHANNEL_ID = "LocationServiceChannel"
    private val NOTIFICATION_ID = 12345

    private val locationProviderReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (LocationManager.PROVIDERS_CHANGED_ACTION == intent?.action) {
                val isLocationEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                        locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
                if (!isLocationEnabled) {
                    ConsoleLogger.warn("Location providers disabled. Stopping service.")
                    SharedPreferencesHelper.setPowerState(
                        applicationContext,
                        PowerState.OFF,
                        pendingAck = false,
                        reason = "gps_disabled"
                    )
                    NotificationHelper.showGpsDisabledNotification(
                        applicationContext,
                        "GPS is turned off. Enable location and restart tracking."
                    )
                    HandshakeManager.launchHandshake(applicationContext, reason = "gps_disabled")
                    updateAndBroadcastState(
                        status = StatusMessages.SERVICE_STOPPED_GPS_OFF,
                        connectionStatus = "Critical error",
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
        ConsoleLogger.info("LocationService: Creating.")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        isNetworkAvailable = connectivityManager.activeNetworkInfo?.isConnectedOrConnecting == true
        if (!isNetworkAvailable) {
            handleNetworkStatusChange(false, force = true)
        }
        registerNetworkCallback()
        val providerFilter = IntentFilter(LocationManager.PROVIDERS_CHANGED_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(locationProviderReceiver, providerFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(locationProviderReceiver, providerFilter)
        }

        currentServiceState.powerStatus = SharedPreferencesHelper.getPowerState(this).toString()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                if (isStopping) return 
                locationResult.lastLocation?.let { location ->
                    ConsoleLogger.debug("New location: lat=${location.latitude}, lon=${location.longitude}")
                    val nextUpdate = System.currentTimeMillis() + sendIntervalMillis
                    updateAndBroadcastState(
                        status = StatusMessages.NEW_LOCATION_OBTAINED,
                        nextUpdate = nextUpdate
                    )
                    sendLocationAndProcessResponse(location)
                }
            }
        }
        updateAndBroadcastState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // FIX: Idempotency check. If already running and ON, ignore the restart request.
        if (currentServiceState.isRunning && currentServiceState.powerStatus == PowerState.ON.toString()) {
            ConsoleLogger.debug("LocationService: Already running. Ignoring start request.")
            startForegroundService() 
            return START_STICKY
        }

        val ackPending = SharedPreferencesHelper.isTurnOffAckPending(this)
        if (ackPending) {
            ConsoleLogger.warn("LocationService: Start denied (TURN_OFF confirmation pending).")
            updateAndBroadcastState(
                status = StatusMessages.SERVICE_STOPPED,
                connectionStatus = "Waiting for TURN_OFF confirmation",
                isRunning = false,
                powerStatus = PowerState.OFF,
                ackPending = true,
                instructionSource = SharedPreferencesHelper.getPowerTransitionReason(this)
            )
            stopSelf()
            return START_NOT_STICKY
        }

        val persistedPower = SharedPreferencesHelper.getPowerState(this)
        if (persistedPower == PowerState.OFF) {
            ConsoleLogger.warn("LocationService: Start ignored (power state is OFF).")
            stopSelf()
            return START_NOT_STICKY
        }

        ConsoleLogger.info("LocationService: Started. Initializing sequence...")
        NotificationHelper.cancelGpsDisabledNotification(this)
        if (isNetworkAvailable) {
            NotificationHelper.cancelNetworkUnavailableNotification(this)
        }
        SharedPreferencesHelper.setPowerState(
            applicationContext,
            PowerState.ON,
            pendingAck = false,
            reason = "service_start"
        )
        
        // Reset stopping flag to ensure we are ready to run
        isStopping = false
        
        // 1. Start Foreground immediately (requirement)
        startForegroundService()
        
        // 2. Launch sequential initialization
        CoroutineScope(Dispatchers.Main).launch {
            initializeAndStart()
        }

        return START_STICKY
    }

    private suspend fun initializeAndStart() {
        try {
            // Step A: Fetch Configuration
            updateAndBroadcastState(status = "Syncing configuration...", isRunning = true)
            
            withContext(Dispatchers.IO) {
                try {
                    HandshakeManager.performHandshake(applicationContext, reason = "service_start")
                    HandshakeManager.schedulePeriodicHandshake(applicationContext)
                } catch (e: Exception) {
                    ConsoleLogger.warn("LocationService: Initial handshake failed (${e.message}). Using cached config.")
                }
            }

            // Step B: Load Configuration
            val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
            gpsIntervalSeconds = sharedPrefs.getInt("gps_interval_seconds", 60)
            syncIntervalCount = sharedPrefs.getInt("sync_interval_count", 1)
            sendIntervalMillis = TimeUnit.SECONDS.toMillis(gpsIntervalSeconds.toLong())
            
            ConsoleLogger.info("LocationService: Config loaded (GPS=${gpsIntervalSeconds}s, Batch=${syncIntervalCount}). Starting tracking.")

            // Step C: Start Tracking
            startLocationUpdates()
            
        } catch (e: Exception) {
            ConsoleLogger.error("LocationService: Fatal error during initialization: ${e.message}")
            // Fallback: Try to start tracking anyway with defaults if config load failed
            startLocationUpdates()
        }
    }

    private fun startLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        isFirstLocationAfterStart = true 

        // We rely solely on periodic updates. The first one will come immediately upon fix.
        // Removing explicit getCurrentLocation to prevent duplicate "first" points.
        
        // Start periodic updates
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            sendIntervalMillis
        ).build()

        try {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            ConsoleLogger.info("LocationService: Location tracking started.")
            updateAndBroadcastState(
                status = StatusMessages.TRACKING_ACTIVE,
                connectionStatus = StatusMessages.WAITING_FOR_GPS,
                nextUpdate = System.currentTimeMillis() + sendIntervalMillis,
                isRunning = true,
                powerStatus = PowerState.ON
            )
        } catch (e: SecurityException) {
            ConsoleLogger.error("LocationService: Permission error on starting location tracking.")
            updateAndBroadcastState(
                status = StatusMessages.SERVICE_STOPPED_PERMISSIONS,
                connectionStatus = "Permission error",
                isRunning = false
            )
            stopSelf()
        }
    }

    private fun enqueueSyncWorker(expedited: Boolean = false) {
        ConsoleLogger.debug("LocationService: Scheduling SyncWorker job (expedited=$expedited).")
        val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        
        val builder = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
        
        if (expedited) {
            builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        }
            
        val syncWorkRequest = builder.build()
        
        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
            "sync_locations",
            ExistingWorkPolicy.REPLACE,
            syncWorkRequest
        )

        val connectionLabel = if (isNetworkAvailable) StatusMessages.SYNC_IN_PROGRESS else StatusMessages.NETWORK_UNAVAILABLE
        updateAndBroadcastState(connectionStatus = connectionLabel, isRunning = true)
    }

    private suspend fun persistLocationToDb(location: Location): Int {
        val dao = AppDatabase.getDatabase(applicationContext).locationDao()
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(applicationContext)
        val deviceId = sharedPrefs.getString("device_id", "unknown")
        val powerState = SharedPreferencesHelper.getPowerState(applicationContext)

        val cachedLocation = CachedLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            speed = if (location.hasSpeed()) location.speed * 3.6f else 0.0f,
            altitude = if (location.hasAltitude()) location.altitude else 0.0,
            accuracy = if (location.hasAccuracy()) location.accuracy else -1.0f,
            satellites = location.extras?.getInt("satellites", 0) ?: 0,
            timestamp = location.time,
            deviceId = deviceId!!,
            deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
            powerStatus = powerState.toString()
        )
        
        dao.insertLocation(cachedLocation)
        return dao.getCachedCount()
    }

    private fun sendLocationAndProcessResponse(location: Location) {
        if (location.time <= lastProcessedLocationTime || Math.abs(location.time - lastProcessedLocationTime) < 500) {
            ConsoleLogger.debug("LocationService: Duplicate or rapid-fire location ignored (dt=${location.time - lastProcessedLocationTime}ms).")
            return
        }
        lastProcessedLocationTime = location.time

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val cachedCount = persistLocationToDb(location)
                ConsoleLogger.debug("Location cached (cache=$cachedCount)")

                var syncTriggered = false
                if (cachedCount >= syncIntervalCount || isFirstLocationAfterStart) {
                    var isExpedited = false
                    if (isFirstLocationAfterStart) {
                         ConsoleLogger.debug("LocationService: FIRST LOCATION - Forcing immediate expedited sync.")
                         isFirstLocationAfterStart = false
                         isExpedited = true
                    } else {
                         ConsoleLogger.debug("LocationService: Batch full ($cachedCount >= $syncIntervalCount) - Triggering sync.")
                    }
                    enqueueSyncWorker(expedited = isExpedited)
                    syncTriggered = true
                }

                if (!isStopping) {
                    val nextUpdate = System.currentTimeMillis() + sendIntervalMillis
                    val powerState = SharedPreferencesHelper.getPowerState(applicationContext)
                    
                    val statusMsg = if (syncTriggered) StatusMessages.SYNC_IN_PROGRESS else StatusMessages.LOCATION_CACHED
                    
                    updateAndBroadcastState(
                        status = statusMsg,
                        cachedCount = cachedCount,
                        powerStatus = powerState,
                        nextUpdate = nextUpdate
                    )
                }

                if (!isNetworkAvailable) {
                    NotificationHelper.showNetworkUnavailableNotification(applicationContext, cachedCount)
                }

            } catch (e: Exception) {
                ConsoleLogger.error("Failed to store location in DB: ${e.message}")
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
            .setContentTitle("GPS Reporter Active")
            .setContentText("Location tracking is running in the background.")
            .setSmallIcon(R.drawable.ic_gps_pin)
            .setContentIntent(pendingIntent)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        val serviceChannel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "Location Service Channel",
            NotificationManager.IMPORTANCE_DEFAULT
        )
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(serviceChannel)
    }

    private fun updateAndBroadcastState(
        status: String? = null,
        connectionStatus: String? = null,
        nextUpdate: Long? = null,
        isRunning: Boolean? = null,
        cachedCount: Int? = null,
        powerStatus: PowerState? = null,
        ackPending: Boolean? = null,
        instructionSource: String? = null
    ) {
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

        val resolvedAck = ackPending ?: SharedPreferencesHelper.isTurnOffAckPending(this)
        currentServiceState.ackPending = resolvedAck
        val resolvedSource = instructionSource ?: SharedPreferencesHelper.getPowerTransitionReason(this)
        currentServiceState.powerInstructionSource = resolvedSource

        ServiceStateRepository.updateState(currentServiceState.copy())
    }

    private fun registerNetworkCallback() {
        if (networkCallback != null) return
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                handleNetworkStatusChange(true)
            }

            override fun onLost(network: Network) {
                handleNetworkStatusChange(false)
            }
        }
        try {
            connectivityManager.registerDefaultNetworkCallback(networkCallback!!)
        } catch (ex: Exception) {
            ConsoleLogger.error("LocationService: Network callback registration failed: ${ex.message}")
            networkCallback = null
        }
    }

    private fun unregisterNetworkCallback() {
        networkCallback?.let {
            try {
                connectivityManager.unregisterNetworkCallback(it)
            } catch (_: Exception) {
            }
        }
        networkCallback = null
    }

    private fun handleNetworkStatusChange(available: Boolean, force: Boolean = false) {
        if (!force && isNetworkAvailable == available) return
        isNetworkAvailable = available
        if (available) {
            ConsoleLogger.info("LocationService: Network available, triggering sync.")
            NotificationHelper.cancelNetworkUnavailableNotification(this)
            updateAndBroadcastState(connectionStatus = StatusMessages.TRACKING_ACTIVE)
            enqueueSyncWorker()
        } else {
            ConsoleLogger.warn("LocationService: Network unavailable, caching locations.")
            CoroutineScope(Dispatchers.IO).launch {
                val cached = AppDatabase.getDatabase(applicationContext).locationDao().getCachedCount()
                NotificationHelper.showNetworkUnavailableNotification(applicationContext, cached)
                updateAndBroadcastState(connectionStatus = StatusMessages.NETWORK_UNAVAILABLE, cachedCount = cached)
            }
        }
    }

    override fun onDestroy() {
        isStopping = true 
        super.onDestroy()
        ConsoleLogger.info("LocationService: Stopping.")
        fusedLocationClient.removeLocationUpdates(locationCallback)

        fun triggerFinalFlush() {
            if (!isNetworkAvailable) return
            ConsoleLogger.debug("LocationService: Triggering final sync flush.")
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            val syncWorkRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                "sync_locations_flush",
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                syncWorkRequest
            )
        }

        try {
            fusedLocationClient.lastLocation.addOnCompleteListener { task ->
                val location = if (task.isSuccessful) task.result else null
                
                if (location != null) {
                    ConsoleLogger.debug("LocationService: Captured final location. Saving...")
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            persistLocationToDb(location)
                            ConsoleLogger.debug("LocationService: Final location saved. NOW flushing.")
                        } catch (e: Exception) {
                            ConsoleLogger.error("LocationService: Failed to save final location: ${e.message}")
                        } finally {
                            triggerFinalFlush()
                        }
                    }
                } else {
                    ConsoleLogger.debug("LocationService: No final location available. Flushing immediately.")
                    triggerFinalFlush()
                }
            }
        } catch (e: Exception) {
            ConsoleLogger.warn("LocationService: Error getting final location: ${e.message}")
            triggerFinalFlush()
        }

        unregisterReceiver(locationProviderReceiver)
        unregisterNetworkCallback()
        NotificationHelper.cancelNetworkUnavailableNotification(this)
        val ackPending = SharedPreferencesHelper.isTurnOffAckPending(applicationContext)
        val transitionReason = if (ackPending) {
            SharedPreferencesHelper.getPowerTransitionReason(applicationContext) ?: "service_destroy"
        } else {
            "service_destroy"
        }
        
        if (!ackPending) {
            HandshakeManager.launchHandshake(applicationContext, reason = "service_stop")
        }
        HandshakeManager.cancelPeriodicHandshake(applicationContext)
        updateAndBroadcastState(
            status = StatusMessages.SERVICE_STOPPED,
            connectionStatus = "Inactive",
            nextUpdate = 0,
            isRunning = false,
            powerStatus = PowerState.OFF,
            ackPending = ackPending,
            instructionSource = transitionReason
        )
        ConsoleLogger.info("LocationService: Destroyed.")
    }

    private fun stopForegroundSafely() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onBind(intent: Intent): IBinder? {
        return null
    }
}