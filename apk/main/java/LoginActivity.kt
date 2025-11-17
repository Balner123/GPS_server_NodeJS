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
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.*
import java.util.concurrent.Executors
import kotlinx.coroutines.runBlocking

class LoginActivity : AppCompatActivity() {

    private lateinit var usernameEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var serverUrlEditText: EditText
    private lateinit var loginButton: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var appNameTextView: TextView
    private lateinit var serverUrlInputLayout: TextInputLayout
    private lateinit var serverUrlLabel: TextView


    private val executorService = Executors.newSingleThreadExecutor()

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

        executorService.execute {
            try {
                val url = URL("$apiBaseUrl/api/apk/login")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                // Build JSON payload containing credentials and installation ID
                val jsonInputString = JSONObject().apply {
                    put("identifier", username)
                    put("password", password)
                    put("installationId", installationId)
                }.toString()

                // Send request body
                OutputStreamWriter(connection.outputStream, "UTF-8").use { it.write(jsonInputString) }

                // Process API response
                val responseCode = connection.responseCode
                val responseBody = if (responseCode < 400) connection.inputStream else connection.errorStream
                val responseString = BufferedReader(InputStreamReader(responseBody, "UTF-8")).readText()

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val jsonResponse = JSONObject(responseString)
                    if (jsonResponse.optBoolean("success", false)) {
                        // Persist session cookie
                        val cookie = connection.headerFields["Set-Cookie"]?.firstOrNull()
                        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
                        sharedPrefs.edit().putString("session_cookie", cookie).apply()

                        // Check if the device is already registered
                        val isDeviceRegistered = jsonResponse.optBoolean("device_is_registered", false)
                        if (isDeviceRegistered) {
                            // When it is, store intervals and continue to the main screen
                            val gpsInterval = jsonResponse.optInt("gps_interval", 60) // Default to 60 seconds
                            val intervalSend = jsonResponse.optInt("interval_send", 1) // Default to 1 location before sending
                            sharedPrefs.edit()
                                .putString("device_id", installationId)
                                .putString("client_type", "APK")
                                .putBoolean("isAuthenticated", true)
                                .putInt("gps_interval_seconds", gpsInterval)
                                .putInt("sync_interval_count", intervalSend)
                                .apply()
                            try {
                                runBlocking {
                                    HandshakeManager.performHandshake(applicationContext, reason = "post_login")
                                }
                            } catch (e: Exception) {
                                Log.w("LoginActivity", "Handshake after login failed: ${e.message}")
                            }
                            Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                            runOnUiThread {
                                Toast.makeText(this, "Login successful!", Toast.LENGTH_SHORT).show()
                                navigateToMain()
                            }
                        } else {
                            // Otherwise start the registration process
                            registerDevice(installationId)
                        }
                    } else {
                        val error = jsonResponse.optString("error", "Unknown login error.")
                        showError(error)
                    }
                } else {
                    val error = try { JSONObject(responseString).optString("error", "Server error") } catch (e: Exception) { responseString }
                    showError("Server error ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Network communication error: ", e)
                showError("Network error: ${e.message}")
            } finally {
                setLoadingState(false)
            }
        }
    }

    /**
     * Register this application instance on the server.
     */
    private fun registerDevice(installationId: String) {
        if (!NetworkUtils.isOnline(this)) {
            Toast.makeText(this, "Registration requires an internet connection.", Toast.LENGTH_LONG).show()
            setLoadingState(false)
            return
        }

        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
        val sharedPrefs = SharedPreferencesHelper.getEncryptedSharedPreferences(this)
        val sessionCookie = sharedPrefs.getString("session_cookie", null)
        val apiBaseUrl = getApiBaseUrl()

        executorService.execute {
            try {
                val url = URL("$apiBaseUrl/api/devices/register")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                sessionCookie?.let { connection.setRequestProperty("Cookie", it.split(";")[0]) }
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                val jsonInputString = JSONObject().apply {
                    put("client_type", "APK")
                    put("device_id", installationId)
                    put("name", deviceName)
                }.toString()

                OutputStreamWriter(connection.outputStream, "UTF-8").use { it.write(jsonInputString) }

                val responseCode = connection.responseCode
                val responseBody = if (responseCode < 400) connection.inputStream else connection.errorStream
                val responseString = BufferedReader(InputStreamReader(responseBody, "UTF-8")).readText()

                if (responseCode == HttpURLConnection.HTTP_CREATED || responseCode == HttpURLConnection.HTTP_OK) {
                    val jsonResponse = JSONObject(responseString)
                    if (jsonResponse.optBoolean("success", false)) {
                        val alreadyRegistered = jsonResponse.optBoolean("already_registered", false)
                        val gpsInterval = jsonResponse.optInt("interval_gps", jsonResponse.optInt("gps_interval", 60))
                        val intervalSend = jsonResponse.optInt("interval_send", 1)
                        sharedPrefs.edit()
                            .putString("device_id", installationId)
                            .putString("client_type", "APK")
                            .putBoolean("isAuthenticated", true)
                            .putInt("gps_interval_seconds", gpsInterval)
                            .putInt("sync_interval_count", intervalSend)
                            .apply()
                        try {
                            runBlocking {
                                HandshakeManager.performHandshake(applicationContext, reason = "post_register")
                            }
                        } catch (e: Exception) {
                            Log.w("LoginActivity", "Handshake after registration failed: ${e.message}")
                        }
                        val infoMessage = if (alreadyRegistered) {
                            "Device was already registered; continuing."
                        } else {
                            "Device registered successfully."
                        }
                        Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                        runOnUiThread {
                            Toast.makeText(this, infoMessage, Toast.LENGTH_SHORT).show()
                            navigateToMain()
                        }
                    } else {
                        val error = jsonResponse.optString("error", "Unknown registration error.")
                        showError(error)
                    }
                } else {
                    val error = try { JSONObject(responseString).optString("error", "Server error") } catch (e: Exception) { responseString }
                    showError("Registration error ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Device registration error: ", e)
                showError("Network error during registration: ${e.message}")
            } finally {
                setLoadingState(false)
            }
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
        executorService.shutdown()
    }
}
