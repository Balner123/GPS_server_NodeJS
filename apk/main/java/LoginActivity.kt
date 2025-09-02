package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import androidx.core.content.edit // Added for SharedPreferences KTX

class LoginActivity : AppCompatActivity() {

    // --- UI Elements ---
    private lateinit var usernameTextInputLayout: TextInputLayout
    private lateinit var usernameEditText: TextInputEditText
    private lateinit var passwordTextInputLayout: TextInputLayout
    private lateinit var passwordEditText: TextInputEditText
    private lateinit var loginButton: Button
    private lateinit var loadingProgressBar: ProgressBar

    private val executorService = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // --- Initialize UI elements with new IDs ---
        usernameTextInputLayout = findViewById(R.id.usernameTextInputLayout)
        usernameEditText = findViewById(R.id.usernameEditText)
        passwordTextInputLayout = findViewById(R.id.passwordTextInputLayout)
        passwordEditText = findViewById(R.id.passwordEditText)
        loginButton = findViewById(R.id.loginButton)
        loadingProgressBar = findViewById(R.id.loadingProgressBar)

        // Ensure we have a unique installation ID
        getInstallationId()

        loginButton.setOnClickListener {
            performLogin()
        }
    }

    /**
     * Gets or creates a unique ID for this app installation.
     */
    private fun getInstallationId(): String {
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        var installationId = sharedPrefs.getString("installation_id", null)
        if (installationId == null) {
            val fullUuid = UUID.randomUUID().toString()
            val bytes = fullUuid.toByteArray(Charsets.UTF_8)
            val md = MessageDigest.getInstance("SHA-256")
            val digest = md.digest(bytes)
            val hexString = digest.fold("", { str, it -> str + "%02x".format(it) })
            installationId = hexString.take(10)
            sharedPrefs.edit { putString("installation_id", installationId) }
            Log.i("LoginActivity", "Generated new 10-char installation ID: $installationId")
        }
        return installationId
    }

    /**
     * Main function to handle the login process.
     */
    private fun performLogin() {
        val username = usernameEditText.text.toString().trim()
        val password = passwordEditText.text.toString()
        val installationId = getInstallationId()

        // --- Clear previous errors ---
        usernameTextInputLayout.error = null
        passwordTextInputLayout.error = null

        // --- Modern validation ---
        if (username.isEmpty()) {
            usernameTextInputLayout.error = "Please enter a username or email."
            return
        }
        if (password.isEmpty()) {
            passwordTextInputLayout.error = "Please enter a password."
            return
        }

        setLoadingState(true)

        executorService.execute {
            try {
                val url = URL("https://lotr-system.xyz/api/apk/login")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                val jsonInputString = JSONObject().apply {
                    put("identifier", username)
                    put("password", password)
                    put("installationId", installationId)
                }.toString()

                OutputStreamWriter(connection.outputStream, "UTF-8").use { it.write(jsonInputString) }

                val responseCode = connection.responseCode
                val responseBody = if (responseCode < 400) connection.inputStream else connection.errorStream
                val responseString = BufferedReader(InputStreamReader(responseBody, "UTF-8")).readText()

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val jsonResponse = JSONObject(responseString)
                    if (jsonResponse.optBoolean("success", false)) {
                        val cookie = connection.headerFields["Set-Cookie"]?.firstOrNull()
                        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                        sharedPrefs.edit { putString("session_cookie", cookie) }

                        val isDeviceRegistered = jsonResponse.optBoolean("device_is_registered", false)
                        if (isDeviceRegistered) {
                            sharedPrefs.edit { putBoolean("isAuthenticated", true) }
                            runOnUiThread { Toast.makeText(this, "Login Successful!", Toast.LENGTH_SHORT).show() }
                            navigateToMain()
                        } else {
                            // For simplicity, we'll now use the device's model as a name.
                            // A dedicated screen could be added here in the future.
                            registerDevice(installationId)
                        }
                    } else {
                        val error = jsonResponse.optString("error", "Unknown login error.")
                        showError(error)
                    }
                } else {
                    val error = try { JSONObject(responseString).optString("error", "Server error") } catch (e: Exception) { responseString }
                    showError("Server Error ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Network Error: ", e)
                showError("Network Error: ${e.message}")
            } finally {
                setLoadingState(false)
            }
        }
    }

    /**
     * Registers this app instance on the server.
     */
    private fun registerDevice(installationId: String) {
        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
        val sessionCookie = sharedPrefs.getString("session_cookie", null)

        executorService.execute {
            try {
                val url = URL("https://lotr-system.xyz/api/apk/register-device")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                sessionCookie?.let { connection.setRequestProperty("Cookie", it.split(";")[0]) }
                connection.doOutput = true
                connection.connectTimeout = 15000
                connection.readTimeout = 15000

                val jsonInputString = JSONObject().apply {
                    put("installationId", installationId)
                    put("deviceName", deviceName)
                }.toString()

                OutputStreamWriter(connection.outputStream, "UTF-8").use { it.write(jsonInputString) }

                val responseCode = connection.responseCode
                val responseBody = if (responseCode < 400) connection.inputStream else connection.errorStream
                val responseString = BufferedReader(InputStreamReader(responseBody, "UTF-8")).readText()

                if (responseCode == HttpURLConnection.HTTP_CREATED || responseCode == HttpURLConnection.HTTP_OK) {
                    val jsonResponse = JSONObject(responseString)
                    if (jsonResponse.optBoolean("success", false)) {
                        sharedPrefs.edit { putBoolean("isAuthenticated", true) }
                        runOnUiThread { Toast.makeText(this, "Device registered successfully!", Toast.LENGTH_SHORT).show() }
                        navigateToMain()
                    } else {
                        val error = jsonResponse.optString("error", "Unknown registration error.")
                        showError(error)
                    }
                } else {
                     val error = try { JSONObject(responseString).optString("error", "Server error") } catch (e: Exception) { responseString }
                    showError("Registration Error ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Device registration error: ", e)
                showError("Network Error during registration: ${e.message}")
            } finally {
                setLoadingState(false)
            }
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
    }

    private fun setLoadingState(isLoading: Boolean) {
        runOnUiThread {
            loadingProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            loginButton.isEnabled = !isLoading
            usernameEditText.isEnabled = !isLoading
            passwordEditText.isEnabled = !isLoading
        }
    }

    private fun showError(message: String) {
        runOnUiThread {
            // Show general errors in the password field for better UX than a Toast
            passwordTextInputLayout.error = message
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        executorService.shutdown()
    }
}
