package com.example.gpsreporterapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.os.Build
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.edit // Added for SharedPreferences KTX
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.android.material.appbar.MaterialToolbar

class MainActivity : AppCompatActivity() {

    // --- UI Elements ---
    private lateinit var statusTextView: TextView
    private lateinit var deviceNameTextView: TextView
    private lateinit var statusIcon: ImageView
    private lateinit var topAppBar: MaterialToolbar

    // Receiver for updates from LocationService
    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                if (it.action == LocationService.ACTION_BROADCAST_STATUS) {
                    val statusMessage = it.getStringExtra(LocationService.EXTRA_STATUS_MESSAGE)
                    val isServiceRunning = statusMessage?.contains("zastavena") == false
                    updateStatusUI(isServiceRunning, statusMessage)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // --- Check if user is authenticated ---
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val isAuthenticated = sharedPrefs.getBoolean("isAuthenticated", false)
        if (!isAuthenticated) {
            navigateToLogin()
            return // Stop further execution
        }

        // --- Initialize UI elements ---
        statusTextView = findViewById(R.id.statusTextView)
        deviceNameTextView = findViewById(R.id.deviceNameTextView)
        statusIcon = findViewById(R.id.statusIcon)
        topAppBar = findViewById(R.id.topAppBar)

        // --- Set up the Toolbar ---
        setSupportActionBar(topAppBar)

        // Display the device name
        val deviceId = sharedPrefs.getString("device_id", "Unknown Device")
        deviceNameTextView.text = getString(R.string.registered_as, deviceId)

        // Start the location service if it's not already running
        // (This is a simplified approach. In a real app, you'd check permissions first)
        startLocationService()
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(LocationService.ACTION_BROADCAST_STATUS)
        LocalBroadcastManager.getInstance(this).registerReceiver(statusReceiver, filter)

        // Request a status update from the service to refresh the UI
        val intent = Intent(this, LocationService::class.java).apply {
            action = LocationService.ACTION_REQUEST_STATUS_UPDATE
        }
        startService(intent)
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
    }

    /**
     * Inflates the menu for the toolbar.
     */
    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    /**
     * Handles clicks on menu items, like Logout.
     */
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_logout -> {
                showLogoutConfirmationDialog()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    /**
     * Updates the UI based on the service status.
     */
    private fun updateStatusUI(isRunning: Boolean, message: String?) {
        if (isRunning) {
            statusTextView.text = message ?: "Service is active"
            statusIcon.setImageResource(R.drawable.ic_status_connected)
            // Use a helper to resolve theme attributes for robust color handling
            statusIcon.setColorFilter(getThemeColor(com.google.android.material.R.attr.colorPrimary))
        } else {
            statusTextView.text = message ?: "Service is stopped"
            // Use the explicit android.R reference for system drawables to avoid resolution issues
            statusIcon.setImageResource(android.R.drawable.ic_dialog_alert)
            statusIcon.setColorFilter(getThemeColor(com.google.android.material.R.attr.colorError))
        }
    }

    /**
     * Helper function to resolve a color attribute from the current theme.
     */
    @androidx.annotation.ColorInt
    private fun getThemeColor(@androidx.annotation.AttrRes attrRes: Int): Int {
        val typedValue = android.util.TypedValue()
        theme.resolveAttribute(attrRes, typedValue, true)
        return typedValue.data
    }

    private fun startLocationService() {
        // Check for location permissions before starting the service
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            val intent = Intent(this, LocationService::class.java)
            ContextCompat.startForegroundService(this, intent)
        } else {
            // Request permissions if not granted
            val permissionsToRequest = mutableListOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // Q is API 29
                permissionsToRequest.add(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            }

            androidx.core.app.ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        }
    }

    companion object {
        private const val LOCATION_PERMISSION_REQUEST_CODE = 1001
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationService::class.java)
        stopService(intent)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                // Permission granted, start the service
                startLocationService()
            } else {
                // Permission denied, inform the user
                Toast.makeText(this, "Location permission denied. Cannot start tracking.", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showLogoutConfirmationDialog() {
        AlertDialog.Builder(this)
            .setTitle("Logout")
            .setMessage("Are you sure you want to logout? This will stop location tracking.")
            .setPositiveButton("Logout") { _, _ -> performLogout() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun performLogout() {
        stopLocationService()

        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit {
            remove("session_cookie")
            putBoolean("isAuthenticated", false)
        }

        Toast.makeText(this, "You have been logged out.", Toast.LENGTH_SHORT).show()
        navigateToLogin()
    }

    private fun navigateToLogin() {
        val intent = Intent(this, LoginActivity::class.java)
        startActivity(intent)
        finish() // Finish MainActivity so the user can't return with the back button
    }
}
