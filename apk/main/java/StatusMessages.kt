package com.example.gpsreporterapp

object StatusMessages {
    const val SERVICE_STARTING = "Služba se spouští..."
    const val SERVICE_STOPPED = "Služba zastavena"
    const val SERVICE_STOPPED_GPS_OFF = "Služba zastavena (GPS vypnuto)"
    const val SERVICE_STOPPED_PERMISSIONS = "Služba zastavena (chyba oprávnění)"
    const val TRACKING_ACTIVE = "Sledování polohy aktivní"
    const val WAITING_FOR_GPS = "Čekání na signál GPS"
    const val NEW_LOCATION_OBTAINED = "Získána nová poloha"
    const val LOCATION_CACHED = "Poloha uložena v mezipaměti"
    const val SYNC_IN_PROGRESS = "Probíhá odesílání..."
    const val SYNC_SUCCESS = "Synchronizace úspěšná"
    const val SYNC_FAILED = "Chyba synchronizace"
    const val SYNC_CANCELLED = "Synchronizace zrušena"
    const val DB_SAVE_ERROR = "Chyba ukládání do DB"
    const val DEVICE_ID_ERROR = "Chyba: Device ID není k dispozici."
}
