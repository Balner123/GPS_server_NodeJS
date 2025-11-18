# Konfigurace a nastavení

Dokument shrnuje klíčová nastavení aplikace, požadovaná oprávnění a doporučené praktiky pro bezpečné uložení citlivých údajů.

## Build a prostředí

- `compileSdk = 35`, `targetSdk = 35`, `minSdk = 26`.
- `BuildConfig.API_BASE_URL` — výchozí URL serveru (definováno v `main/build.gradle.kts`).
- Bezpečnost: `usesCleartextTraffic=false` (vyžaduje HTTPS).

## Šifrované nastavení (EncryptedSharedPreferences)

Preferujte `EncryptedSharedPreferences` pro ukládání citlivých hodnot. Hlavní klíče a jejich význam:
- `server_url`: Volitelně přepíše `API_BASE_URL`.
- `installation_id`: Interní identifikátor zařízení.
- `session_cookie`: Session cookie extrahovaná z `Set-Cookie` hlavičky po přihlášení.
- `isAuthenticated`: Boolean příznak stavu přihlášení.
- `device_id`: Kopie `installation_id` pro kompatibilitu s API.
- `gps_interval_seconds`: Interval akvizice polohy v sekundách, konfigurovaný serverem.
- `sync_interval_count`: Počet záznamů v dávce před synchronizací, konfigurovaný serverem.
- `power_status`: Poslední známý stav napájení (`ON`/`OFF`), spravovaný `PowerController`.
- `pending_turn_off_ack`: Boolean příznak, který je `true`, pokud aplikace čeká na potvrzení instrukce `TURN_OFF` od serveru.
- `power_transition_reason`: Řetězec ukládající důvod poslední změny stavu napájení (např. `manual_stop`, `handshake`).

Bezpečnostní doporučení:
- Nikdy neukládejte plné uživatelské heslo v prostém textu.
- Session cookie skladujte pouze ve šifrovaném úložišti.

## Oprávnění (manifest)

- INTERNET
- ACCESS_NETWORK_STATE
- ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION (pouze pokud je vyžadováno)
- FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION

Upozornění: na Android 10+ je potřeba explicitně žádat o oprávnění pro pozadí (`ACCESS_BACKGROUND_LOCATION`) a respektovat zásady Play Store.

## Notifikace

- Kanál: `LocationServiceChannel` (konfigurace kanálu s odpovídající prioritou a popisem).
- Doporučené ID notifikace: konfigurovatelné; příklad v implementaci používá `12345`.

## Broadcast akce

- `com.example.gpsreporterapp.BROADCAST_STATUS` — stav služby.
- `com.example.gpsreporterapp.REQUEST_STATUS_UPDATE` — požadavek na okamžité zaslání stavu.
- `com.example.gpsreporterapp.FORCE_LOGOUT` — vynucené odhlášení klienta.

---
Poslední aktualizace: 2025-11-18
