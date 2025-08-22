package com.example.gpsreporterapp

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
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
import java.util.concurrent.Executors

class LoginActivity : AppCompatActivity() {

    private lateinit var usernameEditText: EditText
    private lateinit var passwordEditText: EditText
    private lateinit var loginButton: Button
    private lateinit var progressBar: ProgressBar

    // Použijeme jeden ExecutorService pro všechny síťové operace
    private val executorService = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        usernameEditText = findViewById(R.id.usernameEditText)
        passwordEditText = findViewById(R.id.passwordEditText)
        loginButton = findViewById(R.id.loginButton)
        progressBar = findViewById(R.id.progressBar)

        loginButton.setOnClickListener {
            performLogin()
        }
    }

    private fun performLogin() {
        val username = usernameEditText.text.toString()
        val password = passwordEditText.text.toString()

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Prosím, zadejte uživatelské jméno a heslo.", Toast.LENGTH_SHORT).show()
            return
        }

        runOnUiThread { // UI změny musí být na hlavním vlákně
            progressBar.visibility = ProgressBar.VISIBLE
            loginButton.isEnabled = false
        }

        executorService.execute { // Spustíme síťovou operaci na pozadí
            try {
                val url = URL("https://lotr-system.xyz/api/apk/login") // Nový API endpoint
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                val jsonInputString = JSONObject().apply {
                    put("identifier", username)
                    put("password", password)
                }.toString()

                OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                    writer.write(jsonInputString)
                }

                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream, "UTF-8"))
                    val response = reader.readText()
                    val jsonResponse = JSONObject(response)

                    if (jsonResponse.optBoolean("success", false)) {
                        // Získání a uložení session cookie
                        val cookies = connection.headerFields["Set-Cookie"]
                        cookies?.forEach { cookie ->
                            // Zde by se měla cookie uložit do SharedPreferences nebo jiného úložiště
                            // pro pozdější použití v LocationService a dalších API voláních.
                            // Pro jednoduchost ji nyní jen vypíšeme a budeme předpokládat, že systém HttpURLConnection
                            // si ji pro další volání v rámci stejné instance udrží, což ale není spolehlivé pro celou aplikaci.
                            // Pro robustní řešení by bylo potřeba implementovat CookieManager.
                            Log.d("LoginActivity", "Received Cookie: $cookie")
                            // Příklad uložení do SharedPreferences (zjednodušeno, pro produkci složitější)
                            val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                            sharedPrefs.edit().putString("session_cookie", cookie).apply()
                        }

                        runOnUiThread { Toast.makeText(this, "Přihlášení úspěšné!", Toast.LENGTH_SHORT).show() }
                        registerDevice(username) // Pokračujeme registrací zařízení
                    } else {
                        val error = jsonResponse.optString("error", "Neznámá chyba přihlášení.")
                        runOnUiThread { Toast.makeText(this, "Chyba přihlášení: $error", Toast.LENGTH_LONG).show() }
                    }
                } else {
                    val errorStream = connection.errorStream
                    val errorResponse = if (errorStream != null) BufferedReader(InputStreamReader(errorStream, "UTF-8")).readText() else ""
                    val errorMessage = try { JSONObject(errorResponse).optString("error", "") } catch (e: Exception) { errorResponse }
                    runOnUiThread { Toast.makeText(this, "Chyba serveru (${responseCode}): $errorMessage", Toast.LENGTH_LONG).show() }
                }
            } catch (e: Exception) {
                Log.e("LoginActivity", "Chyba při síťové komunikaci: ", e)
                runOnUiThread { Toast.makeText(this, "Chyba sítě: ${e.message}", Toast.LENGTH_LONG).show() }
            } finally {
                runOnUiThread {
                    progressBar.visibility = ProgressBar.GONE
                    loginButton.isEnabled = true
                }
            }
        }
    }

    private fun registerDevice(username: String) {
        executorService.execute { // Spustíme síťovou operaci na pozadí
            try {
                val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

                val url = URL("https://lotr-system.xyz/api/apk/register-device") // Nový API endpoint
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.doOutput = true
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                // Získání a nastavení session cookie pro tento požadavek
                val sharedPrefs = getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
                val sessionCookie = sharedPrefs.getString("session_cookie", null)
                if (sessionCookie != null) {
                    connection.setRequestProperty("Cookie", sessionCookie.split(";")[0]) // Posíláme jen název a hodnotu cookie
                }

                val jsonInputString = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("deviceName", deviceName)
                }.toString()

                OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                    writer.write(jsonInputString)
                }

                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_CREATED || responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream, "UTF-8"))
                    val response = reader.readText()
                    val jsonResponse = JSONObject(response)

                    if (jsonResponse.optBoolean("success", false)) {
                        // Uložíme deviceId do SharedPreferences pro LocationService
                        sharedPrefs.edit().putString("device_id", deviceId).apply()
                        sharedPrefs.edit().putBoolean("isAuthenticated", true).apply()

                        runOnUiThread { Toast.makeText(this, "Zařízení registrováno!", Toast.LENGTH_SHORT).show() }
                        val intent = Intent(this, MainActivity::class.java)
                        startActivity(intent)
                        finish() // Ukončí LoginActivity
                    } else {
                        val error = jsonResponse.optString("error", "Neznámá chyba registrace.")
                        runOnUiThread { Toast.makeText(this, "Chyba registrace: $error", Toast.LENGTH_LONG).show() }
                    }
                } else {
                    val errorStream = connection.errorStream
                    val errorResponse = if (errorStream != null) BufferedReader(InputStreamReader(errorStream, "UTF-8")).readText() else ""
                    val errorMessage = try { JSONObject(errorResponse).optString("error", "") } catch (e: Exception) { errorResponse }
                    runOnUiThread { Toast.makeText(this, "Chyba serveru (${responseCode}): $errorMessage", Toast.LENGTH_LONG).show() }
                }
            } catch (e: Exception) {
                Log.e("LoginActivity", "Chyba při registraci zařízení: ", e)
                runOnUiThread { Toast.makeText(this, "Chyba sítě při registraci: ${e.message}", Toast.LENGTH_LONG).show() }
            } finally {
                runOnUiThread {
                    progressBar.visibility = ProgressBar.GONE
                    loginButton.isEnabled = true
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        executorService.shutdown()
    }
}

