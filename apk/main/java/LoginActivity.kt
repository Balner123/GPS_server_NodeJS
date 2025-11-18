package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputLayout
import java.security.MessageDigest
import java.util.*
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class LoginActivity : AppCompatActivity() {

    private lateinit var usernameEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var serverUrlEditText: EditText
    private lateinit var loginButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var appNameTextView: TextView
    private lateinit var serverUrlInputLayout: TextInputLayout
    private lateinit var serverUrlLabel: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // Initialize UI components
        usernameEditText = findViewById(R.id.usernameEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        serverUrlEditText = findViewById(R.id.serverUrlEditText)
        loginButton = findViewById(R.id.loginButton)
        progressBar = findViewById(R.id.progressBar)
        appNameTextView = findViewById(R.id.app_name)
        serverUrlInputLayout = findViewById(R.id.serverUrlInputLayout)
        serverUrlLabel = findViewById(R.id.serverUrlLabel)

        // Load the persisted server URL
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        val savedUrl = sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL)
        serverUrlEditText.setText(savedUrl)

        // Toggle server URL field visibility via long press on the title
        appNameTextView.setOnLongClickListener {
            val isVisible = serverUrlInputLayout.visibility == View.VISIBLE
            serverUrlInputLayout.visibility = if (isVisible) View.GONE else View.VISIBLE
            serverUrlLabel.visibility = if (isVisible) View.GONE else View.VISIBLE
            true
        }

        // Ensure we have a unique installation ID
        getInstallationId()

        loginButton.setOnClickListener {
            performLogin()
        }
    }

    private fun getApiBaseUrl(): String {
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        val urlFromField = serverUrlEditText.text.toString().trim()
        if (urlFromField.isNotEmpty() && urlFromField != sharedPrefs.getString("server_url", null)) {
            sharedPrefs.edit().putString("server_url", urlFromField).apply()
            Log.i("LoginActivity", "Server URL updated to: $urlFromField")
        }
        return sharedPrefs.getString("server_url", BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
    }

    private fun getInstallationId(): String {
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        var installationId = sharedPrefs.getString("installation_id", null)
        if (installationId == null) {
            val fullUuid = UUID.randomUUID().toString()
            // Hash the UUID to SHA-256 and take the first 10 characters
            val bytes = fullUuid.toByteArray(Charsets.UTF_8)
            val md = MessageDigest.getInstance("SHA-256")
            val digest = md.digest(bytes)
            val hexString = digest.fold("", { str, it -> str + "%02x".format(it) })
            installationId = hexString.take(10) // Take first 10 characters

            sharedPrefs.edit().putString("installation_id", installationId).apply()
            Log.i("LoginActivity", "Generated new 10-char installation ID: $installationId from UUID: $fullUuid")
        }
        return installationId
    }

    /**
     * Main function for handling the login flow.
     */
    private fun performLogin() {
        val username = usernameEditText.text.toString()
        val password = passwordEditText.text.toString()
        val installationId = getInstallationId()
        val apiBaseUrl = getApiBaseUrl()

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please enter username and password.", Toast.LENGTH_SHORT).show()
            return
        }

        if (!NetworkUtils.isOnline(this)) {
            Toast.makeText(this, "Connect to the internet to sign in.", Toast.LENGTH_LONG).show()
            return
        }

        setLoadingState(true)

        lifecycleScope.launch {
            try {
                val payload = mapOf(
                    "identifier" to username,
                    "password" to password,
                    "installationId" to installationId
                )
                val (response, cookie) = ApiClient.login(apiBaseUrl, payload)

                if (response.success) {
                    val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this@LoginActivity)
                    sharedPrefs.edit().putString("session_cookie", cookie).apply()

                    if (response.device_is_registered == true) {
                        val gpsInterval = response.gps_interval ?: 60
                        val intervalSend = response.interval_send ?: 1
                        sharedPrefs.edit()
                            .putString("device_id", installationId)
                            .putString("client_type", "APK")
                            .putBoolean("isAuthenticated", true)
                            .putInt("gps_interval_seconds", gpsInterval)
                            .putInt("sync_interval_count", intervalSend)
                            .apply()
                        try {
                            HandshakeManager.performHandshake(applicationContext, reason = "post_login")
                        } catch (e: Exception) {
                            Log.w("LoginActivity", "Handshake after login failed: ${e.message}")
                        }
                        Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                        Toast.makeText(this@LoginActivity, "Login successful!", Toast.LENGTH_SHORT).show()
                        navigateToMain()
                    } else {
                        // Registrace bude zpracována v samostatné suspend funkci
                        withContext(Dispatchers.Main) {
                            registerDevice(installationId)
                        }
                    }
                } else {
                    showError(response.message ?: "Unknown login error.")
                }
            } catch (e: ApiException) {
                Log.e("LoginActivity", "Login error: ", e)
                showError(e.message ?: "An unknown API error occurred.")
            } finally {
                setLoadingState(false)
            }
        }
    }

    /**
     * Register this application instance on the server.
     */
    // This is now a suspend function called from within the login coroutine
    private suspend fun registerDevice(installationId: String) {
        if (!NetworkUtils.isOnline(this)) {
            showError("Registration requires an internet connection.")
            setLoadingState(false)
            return
        }

        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        val sessionCookie = sharedPrefs.getString("session_cookie", null)
        val apiBaseUrl = getApiBaseUrl()

        if (sessionCookie == null) {
            showError("Cannot register device without a session.")
            setLoadingState(false)
            return
        }
        
        try {
            val payload = mapOf(
                "client_type" to "APK",
                "device_id" to installationId,
                "name" to deviceName
            )
            val (response, _) = ApiClient.registerDevice(apiBaseUrl, sessionCookie, payload)

            if (response.success) {
                val alreadyRegistered = response.already_registered == true
                val gpsInterval = response.interval_gps ?: 60
                val intervalSend = response.interval_send ?: 1
                
                sharedPrefs.edit()
                    .putString("device_id", installationId)
                    .putString("client_type", "APK")
                    .putBoolean("isAuthenticated", true)
                    .putInt("gps_interval_seconds", gpsInterval)
                    .putInt("sync_interval_count", intervalSend)
                    .apply()

                try {
                    HandshakeManager.performHandshake(applicationContext, reason = "post_register")
                } catch (e: Exception) {
                    Log.w("LoginActivity", "Handshake after registration failed: ${e.message}")
                }
                
                val infoMessage = if (alreadyRegistered) {
                    "Device was already registered; continuing."
                } else {
                    "Device registered successfully."
                }
                Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                Toast.makeText(this, infoMessage, Toast.LENGTH_SHORT).show()
                navigateToMain()

            } else {
                showError(response.message ?: "Unknown registration error.")
            }
        } catch (e: ApiException) {
            Log.e("LoginActivity", "Device registration error: ", e)
            showError(e.message ?: "Network error during registration.")
        } finally {
            // setLoadingState(false) is handled by the calling performLogin function
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish() // Finish LoginActivity so the back button cannot return here
    }

    private fun setLoadingState(isLoading: Boolean) {
        runOnUiThread {
            progressBar.visibility = if (isLoading) ProgressBar.VISIBLE else ProgressBar.GONE
            loginButton.isEnabled = !isLoading
        }
    }

    private fun showError(message: String) {
        runOnUiThread { Toast.makeText(this, message, Toast.LENGTH_LONG).show() }
    }

    override fun onDestroy() {
        super.onDestroy()
        // No need to shutdown executorService, lifecycleScope is handled automatically
    }
}
