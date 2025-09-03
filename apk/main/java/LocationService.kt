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
        Thread {
            var afterSendRestarted = false
            try {
                lastConnectionStatusMessage = "Odesílám data na server..."
                broadcastLog("Pokus o odeslání dat...")
                broadcastCurrentState()

                val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                val deviceId = sharedPrefs.getString("device_id", null) // Retrieve device_id

                if (deviceId == null) {
                    Log.e("LocationService", "Device ID not found in SharedPreferences. Stopping service.")
                    broadcastLog("CHYBA: ID zařízení nenalezeno. Služba se ukončuje.")
                    stopSelf()
                }

                // Formátování timestampu do ISO 8601 UTC, aby odpovídal gps_tracker.ino
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val timestamp = sdf.format(Date(location.time))

                // Získání počtu satelitů, pokud je k dispozici
                val satellites = location.extras?.getInt("satellites", 0) ?: 0

                val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

                val jsonPayload = JSONObject().apply {
                    // Použití klíče "device" a uloženého deviceId
                    put("device", deviceId) // Use the stored deviceId
                    put("name", deviceName) // Přidání názvu zařízení
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("speed", if (location.hasSpeed()) location.speed * 3.6 else 0.0) // Převod m/s na km/h
                    put("altitude", if (location.hasAltitude()) location.altitude else 0.0)
                    // Použití klíče "accuracy" pro shodu s .ino souborem
                    put("accuracy", if (location.hasAccuracy()) location.accuracy else -1.0)
                    put("satellites", satellites)
                    put("timestamp", timestamp)
                }

                broadcastLog("Odesílaná data:${jsonPayload.toString(2)}")

                // Použít API endpoint, který server skutečně vystavuje
                val url = URL("https://lotr-system.xyz/api/devices/input")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                // Získání a nastavení session cookie pro tento požadavek (pokud je k dispozici)
                val sessionCookie = sharedPrefs.getString("session_cookie", null)
                if (sessionCookie != null) {
                    connection.setRequestProperty("Cookie", sessionCookie.split(";")[0]) // Posíláme jen název a hodnotu cookie
                }

                // Odeslání dat
                connection.outputStream.use { os ->
                    val input = jsonPayload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                // Zpracování odpovědi ze serveru
                val responseCode = connection.responseCode
                Log.d("LocationService", "Odpověď serveru (sendData): $responseCode")
                broadcastLog("Odpověď serveru: HTTP $responseCode")

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    lastConnectionStatusMessage = "Data úspěšně odeslána."
                    val responseBody = connection.inputStream.bufferedReader().use { it.readText() }

                    if (responseBody.isNullOrBlank()) {
                        // Server may return empty 200 (e.g. device not registered). Handle gracefully.
                        broadcastLog("Server vrátil prázdnou odpověď (pravděpodobně zařízení neregistrováno). HTTP 200 bez těla.")
                    } else {
                        broadcastLog("Přijatá data:\n$responseBody")
                        try {
                            val jsonResponse = JSONObject(responseBody)
                            // Zkusíme z odpovědi vytáhnout nový interval
                            val newIntervalSeconds = jsonResponse.optLong("sleep_interval", -1)
                            if (newIntervalSeconds > 0) {
                                val newIntervalMillis = TimeUnit.SECONDS.toMillis(newIntervalSeconds)
                                if (newIntervalMillis != sendIntervalMillis) {
                                    sendIntervalMillis = newIntervalMillis
                                    lastStatusMessage = "Server poslal nový interval: $newIntervalSeconds s."
                                    // Restartujeme sledování s novým intervalem
                                    stopLocationUpdates()
                                    startLocationUpdates()
                                    afterSendRestarted = true // Označíme, že proběhl restart
                                }
                            }
                        } catch (e: Exception) {
                            // Pokud odpověď není JSON nebo nelze parsovat, jen to zalogujeme a nepřerušujeme službu
                            broadcastLog("Chyba parsování JSON odpovědi: ${e.message}")
                        }
                    }
                } else {
                    lastConnectionStatusMessage = "Chyba serveru: Kód $responseCode"
                }
            } catch (e: Exception) {
                Log.e("LocationService", "Chyba při síťové komunikaci.", e)
                lastConnectionStatusMessage = "Chyba sítě: ${e.message?.take(30)}" // Zkrátíme případnou dlouhou chybovou hlášku
                broadcastLog("CHYBA SÍTĚ: ${e.message}")
            } finally {
                // Pokud nebyla služba restartována (běžný případ), musíme ručně
                // aktualizovat stav a naplánovat další odpočet v UI.
                if (!afterSendRestarted) {
                    if (lastStatusMessage.startsWith("Nová poloha:")) { // Nepřepíšeme zprávu o změně intervalu
                        lastStatusMessage = "Čeká na další odeslání."
                    }
                    nextUpdateTimestamp = System.currentTimeMillis() + sendIntervalMillis
                    broadcastCurrentState()
                }
            }
        }.start()
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