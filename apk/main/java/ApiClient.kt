package com.example.gpsreporterapp

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

object ApiClient {

    private val gson = Gson()
    private const val CONNECT_TIMEOUT = 15000
    private const val READ_TIMEOUT = 15000

    // Generic request function
    private suspend fun <T> makeRequest(
        urlString: String,
        method: String = "POST",
        body: String? = null,
        sessionCookie: String? = null,
        responseClass: Class<T>
    ): Pair<T, String?> {
        return withContext(Dispatchers.IO) {
            val url = URL(urlString)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = CONNECT_TIMEOUT
                readTimeout = READ_TIMEOUT
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
                sessionCookie?.takeIf { it.isNotBlank() }?.let {
                    setRequestProperty("Cookie", it.split(";").firstOrNull())
                }
            }

            if (method == "POST" && body != null) {
                connection.doOutput = true
                BufferedWriter(OutputStreamWriter(connection.outputStream, Charsets.UTF_8)).use { writer ->
                    writer.write(body)
                }
            }

            val responseCode = connection.responseCode
            val responseHeaders = connection.headerFields
            val responseBody: String
            val errorStream = connection.errorStream

            responseBody = if (errorStream != null) {
                BufferedReader(InputStreamReader(errorStream, Charsets.UTF_8)).use { it.readText() }
            } else {
                BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8)).use { it.readText() }
            }
            
            ConsoleLogger.debug("ApiClient: Response code=$responseCode, url=$urlString, body=${responseBody.take(260)}")

            when (responseCode) {
                HttpURLConnection.HTTP_OK, HttpURLConnection.HTTP_CREATED -> {
                    try {
                        val responseObject = gson.fromJson(responseBody, responseClass)
                        val newCookie = responseHeaders["Set-Cookie"]?.firstOrNull()
                        Pair(responseObject, newCookie)
                    } catch (e: JsonSyntaxException) {
                        throw ApiException("Failed to parse JSON response: ${e.message}", e)
                    }
                }
                HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN ->
                    throw UnauthorizedException("Unauthorized access (HTTP $responseCode) to $urlString")
                in 400..499 ->
                    throw ClientException("Client error (HTTP $responseCode) to $urlString: $responseBody")
                in 500..599 ->
                    throw ServerException("Server error (HTTP $responseCode) to $urlString: $responseBody")
                else ->
                    throw ApiException("Unexpected HTTP response code: $responseCode")
            }
        }
    }

    suspend fun login(baseUrl: String, payload: Map<String, String>): Pair<LoginResponse, String?> {
        val url = "$baseUrl/api/apk/login"
        val body = gson.toJson(payload)
        return makeRequest(url, "POST", body, null, LoginResponse::class.java)
    }

    suspend fun registerDevice(baseUrl: String, sessionCookie: String, payload: Map<String, String>): Pair<DeviceRegistrationResponse, String?> {
        val url = "$baseUrl/api/devices/register"
        val body = gson.toJson(payload)
        return makeRequest(url, "POST", body, sessionCookie, DeviceRegistrationResponse::class.java)
    }

    suspend fun performHandshake(baseUrl: String, sessionCookie: String?, payload: Map<String, Any>): HandshakeResponse {
        val url = "$baseUrl/api/devices/handshake"
        val body = gson.toJson(payload)
        val (response, _) = makeRequest(url, "POST", body, sessionCookie, HandshakeResponse::class.java)
        return response
    }
    
    suspend fun logout(baseUrl: String, sessionCookie: String) {
        val url = "$baseUrl/api/apk/logout"
        try {
            // Logout doesn't have a meaningful response body to parse, so we handle it more directly
            withContext(Dispatchers.IO) {
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = CONNECT_TIMEOUT
                    readTimeout = READ_TIMEOUT
                    setRequestProperty("Cookie", sessionCookie.split(";").firstOrNull())
                }
                val responseCode = connection.responseCode
                if (responseCode >= 400) {
                     ConsoleLogger.error("Logout failed with response code: $responseCode")
                } else {
                     ConsoleLogger.info("Logout successful.")
                }
            }
        } catch (e: Exception) {
            // We don't rethrow here as logout failure is not critical
            ConsoleLogger.error("Logout error: ${e.message}")
        }
    }

    suspend fun sendBatch(baseUrl: String, sessionCookie: String?, payload: JSONArray): ServerResponse {
        val url = "$baseUrl/api/devices/input"
        val body = payload.toString()
        val (response, _) = makeRequest(url, "POST", body, sessionCookie, ServerResponse::class.java)
        return response
    }
}
