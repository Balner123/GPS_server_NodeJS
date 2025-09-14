package com.example.gpsreporterapp

import java.security.MessageDigest

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

class LoginActivity : AppCompatActivity() {

    private lateinit var usernameEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var loginButton: Button
    private lateinit var progressBar: ProgressBar

    private val executorService = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // Inicializace UI prvků
        usernameEditText = findViewById(R.id.usernameEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        loginButton = findViewById(R.id.loginButton)
        progressBar = findViewById(R.id.progressBar)

        // Zajistíme, že máme unikátní ID instalace
        getInstallationId()

        loginButton.setOnClickListener {
            performLogin()
        }
    }

    /**
     * Získá nebo vytvoří unikátní ID pro tuto instalaci aplikace.
     */
    private fun getInstallationId(): String {
        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
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
     * Hlavní funkce pro zpracování přihlášení.
     */
    private fun performLogin() {
        val username = usernameEditText.text.toString()
        val password = passwordEditText.text.toString()
        val installationId = getInstallationId()

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Prosím, zadejte uživatelské jméno a heslo.", Toast.LENGTH_SHORT).show()
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

                // Sestavení JSON s přihlašovacími údaji a ID instalace
                val jsonInputString = JSONObject().apply {
                    put("identifier", username)
                    put("password", password)
                    put("installationId", installationId)
                }.toString()

                // Odeslání dat
                OutputStreamWriter(connection.outputStream, "UTF-8").use { it.write(jsonInputString) }

                // Zpracování odpovědi
                val responseCode = connection.responseCode
                val responseBody = if (responseCode < 400) connection.inputStream else connection.errorStream
                val responseString = BufferedReader(InputStreamReader(responseBody, "UTF-8")).readText()

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val jsonResponse = JSONObject(responseString)
                    if (jsonResponse.optBoolean("success", false)) {
                        // Uložíme session cookie
                        val cookie = connection.headerFields["Set-Cookie"]?.firstOrNull()
                        val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                        sharedPrefs.edit().putString("session_cookie", cookie).apply()

                        // Zkontrolujeme, zda je zařízení již registrováno
                        val isDeviceRegistered = jsonResponse.optBoolean("device_is_registered", false)
                        if (isDeviceRegistered) {
                            // Pokud ano, uložíme potřebná data a jdeme na hlavní obrazovku
                                                        val gpsInterval = jsonResponse.optInt("gps_interval", 60) // Default to 60 seconds
                            val intervalSend = jsonResponse.optInt("interval_send", 1) // Default to 1 location before sending
                            sharedPrefs.edit()
                                .putString("device_id", installationId)
                                .putBoolean("isAuthenticated", true)
                                .putInt("gps_interval_seconds", gpsInterval)
                                .putInt("sync_interval_count", intervalSend)
                                .apply()
                            Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                            runOnUiThread { Toast.makeText(this, "Přihlášení úspěšné!", Toast.LENGTH_SHORT).show() }
                            navigateToMain()
                        } else {
                            // Pokud ne, spustíme proces registrace
                            registerDevice(installationId)
                        }
                    } else {
                        val error = jsonResponse.optString("error", "Neznámá chyba přihlášení.")
                        showError(error)
                    }
                } else {
                    val error = try { JSONObject(responseString).optString("error", "Chyba serveru") } catch (e: Exception) { responseString }
                    showError("Chyba serveru ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Chyba při síťové komunikaci: ", e)
                showError("Chyba sítě: ${e.message}")
            } finally {
                setLoadingState(false)
            }
        }
    }

    /**
     * Zaregistruje tuto instanci aplikace na serveru.
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
                        // Uložíme potřebná data a jdeme na hlavní obrazovku
                                                val gpsInterval = jsonResponse.optInt("gps_interval", 60) // Default to 60 seconds
                        val intervalSend = jsonResponse.optInt("interval_send", 1) // Default to 1 location before sending
                        sharedPrefs.edit()
                            .putString("device_id", installationId)
                            .putBoolean("isAuthenticated", true)
                            .putInt("gps_interval_seconds", gpsInterval)
                            .putInt("sync_interval_count", intervalSend)
                            .apply()
                        Log.i("LoginActivity", "Server intervals updated: GPS Interval = ${gpsInterval}s, Sync Every = ${intervalSend} locations.")
                        runOnUiThread { Toast.makeText(this, "Zařízení úspěšně registrováno!", Toast.LENGTH_SHORT).show() }
                        navigateToMain()
                    } else {
                        val error = jsonResponse.optString("error", "Neznámá chyba registrace.")
                        showError(error)
                    }
                } else {
                     val error = try { JSONObject(responseString).optString("error", "Chyba serveru") } catch (e: Exception) { responseString }
                    showError("Chyba registrace ($responseCode): $error")
                }

            } catch (e: Exception) {
                Log.e("LoginActivity", "Chyba při registraci zařízení: ", e)
                showError("Chyba sítě při registraci: ${e.message}")
            } finally {
                setLoadingState(false)
            }
        }
    }

    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish() // Ukončí LoginActivity, aby se na ni nedalo vrátit tlačítkem zpět
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