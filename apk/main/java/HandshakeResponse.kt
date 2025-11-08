package com.example.gpsreporterapp

data class HandshakeResponse(
    val registered: Boolean = true,
    val config: HandshakeConfig? = null,
    val power_instruction: String? = null
)

data class HandshakeConfig(
    val interval_gps: Int? = null,
    val interval_send: Int? = null,
    val satellites: Int? = null,
    val mode: String? = null
)
