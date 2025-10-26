# Konfigurace a nastavení

## Build a prostředí
- `compileSdk = 35`, `targetSdk = 35`, `minSdk = 26`
- `BuildConfig.API_BASE_URL` – výchozí základ URL serveru (definováno v `main/build.gradle.kts`)
- Manifest: `usesCleartextTraffic=true` (povoluje HTTP; pro produkci doporučeno vypnout a používat HTTPS)

## SharedPreferences (Encrypted)
Klíče používané aplikací:
- `server_url` – pokud je nastavena, přepíše `API_BASE_URL` (nastavitelné v `LoginActivity`, dlouhý stisk názvu aplikace odhalí pole)
- `installation_id` – 10 znaků SHA-256 z UUID, generuje se automaticky
- `session_cookie` – hodnota z `Set-Cookie` (při odesílání se používá část před `;`)
- `isAuthenticated` – bool
- `device_id` – kopie `installation_id`
- `gps_interval_seconds` – interval získávání polohy (s)
- `sync_interval_count` – po kolika záznamech spustit synchronizaci

## Oprávnění (Manifest)
- INTERNET, ACCESS_NETWORK_STATE
- ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION (Android 10+)
- FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION

## Notifikace
- Kanál: `LocationServiceChannel`
- ID notifikace: 12345

## Broadcast akce
- `com.example.gpsreporterapp.BROADCAST_STATUS`
- `com.example.gpsreporterapp.REQUEST_STATUS_UPDATE`
- `com.example.gpsreporterapp.FORCE_LOGOUT`
