package com.example.gpsreporterapp

data class ServerResponse(
    val success: Boolean,
    val message: String,
    val interval_gps: Int?,
    val interval_send: Int?
)
