package com.example.gpsreporterapp

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import java.text.SimpleDateFormat
import java.util.*

object ConsoleLogger {

    private const val MAX_LOG_LINES = 100

    private val _logs = MutableLiveData<List<String>>().apply {
        value = emptyList()
    }
    val logs: LiveData<List<String>> = _logs

    fun log(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val logMessage = "[$timestamp] $message"

        val currentLogs = _logs.value ?: emptyList()
        val newLogs = (currentLogs + logMessage).takeLast(MAX_LOG_LINES)
        _logs.postValue(newLogs)
    }

    fun clear() {
        _logs.postValue(emptyList())
    }
}
