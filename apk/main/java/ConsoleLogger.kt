package com.example.gpsreporterapp

import android.content.Context
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import java.text.SimpleDateFormat
import java.util.*

object ConsoleLogger {

    enum class LogLevel {
        DEBUG, INFO, WARN, ERROR
    }

    private const val MAX_LOG_LINES = 200
    private const val PREFS_NAME = "ConsoleLoggerPrefs"
    private const val KEY_LOG_LEVELS = "logLevels"

    // Store logs as structured data
    private data class LogEntry(val timestamp: Long, val level: LogLevel, val message: String)
    private val allLogs = mutableListOf<LogEntry>()

    // LiveData for the UI
    private val _logs = MutableLiveData<List<String>>().apply {
        postValue(emptyList())
    }
    val logs: LiveData<List<String>> = _logs

    // Active log levels
    private var displayedLogLevels: Set<LogLevel> = setOf(LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR)

    fun initialize(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedLevels = prefs.getStringSet(KEY_LOG_LEVELS, null)
        if (savedLevels != null) {
            displayedLogLevels = savedLevels.mapNotNull {
                try {
                    LogLevel.valueOf(it)
                } catch (e: IllegalArgumentException) {
                    null
                }
            }.toSet()
        } else {
            // Default levels
            displayedLogLevels = setOf(LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR)
        }
        updateLiveData()
    }

    private fun log(level: LogLevel, message: String) {
        val androidLogLevel = when (level) {
            LogLevel.DEBUG -> Log.DEBUG
            LogLevel.INFO -> Log.INFO
            LogLevel.WARN -> Log.WARN
            LogLevel.ERROR -> Log.ERROR
        }
        Log.println(androidLogLevel, "GPS_App", message)

        val entry = LogEntry(System.currentTimeMillis(), level, message)

        synchronized(allLogs) {
            allLogs.add(entry)
            if (allLogs.size > MAX_LOG_LINES * 2) { // Keep a larger buffer in memory
                allLogs.removeAt(0)
            }
        }

        if (displayedLogLevels.contains(level)) {
            updateLiveData()
        }
    }

    fun debug(message: String) = log(LogLevel.DEBUG, message)
    fun info(message: String) = log(LogLevel.INFO, message)
    fun warn(message: String) = log(LogLevel.WARN, message)
    fun error(message: String) = log(LogLevel.ERROR, message)

    fun setDisplayedLogLevels(context: Context, levels: Set<LogLevel>) {
        displayedLogLevels = levels
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putStringSet(KEY_LOG_LEVELS, levels.map { it.name }.toSet()).apply()
        info("Log levels updated")
        updateLiveData()
    }

    fun getDisplayedLogLevels(): Set<LogLevel> = displayedLogLevels

    private fun updateLiveData() {
        val formatter = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val filteredLogs = synchronized(allLogs) {
            allLogs.filter { displayedLogLevels.contains(it.level) }
                .takeLast(MAX_LOG_LINES)
                .map { "[${formatter.format(Date(it.timestamp))}] [${it.level.name}] ${it.message}" }
        }
        _logs.postValue(filteredLogs)
    }

    fun clear() {
        synchronized(allLogs) {
            allLogs.clear()
        }
        _logs.postValue(emptyList())
        info("Console cleared.")
    }
}