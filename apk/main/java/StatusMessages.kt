package com.example.gpsreporterapp

object StatusMessages {
    const val SERVICE_STARTING = "Service is starting..."
    const val SERVICE_STOPPED = "Service stopped"
    const val SERVICE_STOPPED_GPS_OFF = "Service stopped (GPS disabled)"
    const val SERVICE_STOPPED_PERMISSIONS = "Service stopped (permission error)"
    const val TRACKING_ACTIVE = "Location tracking active"
    const val WAITING_FOR_GPS = "Waiting for GPS signal"
    const val NEW_LOCATION_OBTAINED = "New location obtained"
    const val LOCATION_CACHED = "Location cached"
    const val SYNC_IN_PROGRESS = "Uploading..."
    const val SYNC_SUCCESS = "Sync successful"
    const val SYNC_FAILED = "Sync failed"
    const val SYNC_CANCELLED = "Sync cancelled"
    const val DB_SAVE_ERROR = "Failed to save location"
    const val DEVICE_ID_ERROR = "Error: Device ID unavailable."
    const val NETWORK_UNAVAILABLE = "Data waiting for internet connection"
    const val SERVICE_FINALIZING = "Finalizing..."
}
