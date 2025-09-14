package com.example.gpsreporterapp

data class ServiceState(
    val isRunning: Boolean = false,
    val statusMessage: String = "Služba zastavena.",
    val connectionStatus: String = "-",
    val nextUpdateTimestamp: Long = 0L,
    val consoleLog: String? = null
)