package com.example.gpsreporterapp

data class LoginResponse(
    val success: Boolean,
    val message: String? = null,
    val device_is_registered: Boolean? = null,
    val gps_interval: Int? = null,
    val interval_send: Int? = null
)
