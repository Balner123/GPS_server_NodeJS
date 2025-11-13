package com.example.gpsreporterapp

data class ServiceState(
    var isRunning: Boolean = false,
    var statusMessage: String = "Inicializace...",
    var connectionStatus: String = "Čekání na akci",
    var nextUpdateTimestamp: Long = 0,
    var cachedCount: Int = 0,
    var powerStatus: String = PowerState.OFF.toString(),
    var ackPending: Boolean = false,
    var powerInstructionSource: String? = null
)