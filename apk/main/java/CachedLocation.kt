package com.example.gpsreporterapp

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "location_cache")
data class CachedLocation(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val latitude: Double,
    val longitude: Double,
    val speed: Float,
    val altitude: Double,
    val accuracy: Float,
    val satellites: Int,
    val timestamp: Long, // Store timestamp as milliseconds
    val deviceId: String,
    val deviceName: String
)
