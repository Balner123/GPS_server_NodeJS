package com.example.gpsreporterapp

data class DeviceRegistrationResponse(
    val success: Boolean,
    val message: String? = null,
    val already_registered: Boolean? = null,
    val interval_gps: Int? = null,
    val interval_send: Int? = null
)
