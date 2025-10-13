package com.example.gpsreporterapp

data class ServiceState(
    var isRunning: Boolean = false,
    var statusMessage: String = "Inicializace...",
    var connectionStatus: String = "Čekání na akci",
    var nextUpdateTimestamp: Long = 0,
    var cachedCount: Int = 0
)