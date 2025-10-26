# Architektura a komponenty

Aplikace používá tyto klíčové komponenty:

- LoginActivity
  - Přihlášení na `/api/apk/login` a volitelná registrace `/api/apk/register-device`
  - Generuje `installationId` (prvních 10 hex znaků SHA-256 z UUID)
  - Ukládá `session_cookie`, `device_id`, intervaly do EncryptedSharedPreferences
  - Skryté pole pro URL serveru lze zobrazit dlouhým stiskem názvu aplikace

- MainActivity
  - Start/stop `LocationService` (foreground)
  - Zobrazuje stav služby, poslední zprávy, odpočet do další aktualizace a počet pozic v cache
  - Konzole logů (`ConsoleLogger`) s limitem ~100 řádků a možností mazání delším stiskem
  - Dlouhý stisk přepínače ON/OFF vyvolá odhlášení
  - Příjem broadcastů o stavu a vynuceném odhlášení (403)

- LocationService (Foreground Service)
  - Využívá FusedLocationProviderClient
  - Při startu získá 1× okamžitou polohu a poté běží podle intervalu
  - Každou polohu ukládá do Room DB
  - Po dosažení prahu `sync_interval_count` plánuje `SyncWorker`
  - Vysílá stav přes LocalBroadcastManager

- SyncWorker (WorkManager)
  - Odesílá dávky (po krocích, např. 50) na `${API_BASE_URL}/api/devices/input`
  - Při HTTP 200 maže odeslané záznamy; při 403 vyvolá vynucené odhlášení
  - Při velké dávce (>10) může aktualizovat `gps_interval_seconds` a `sync_interval_count` a restartovat službu

- Room DB
  - Entity: `CachedLocation(table = location_cache)`
  - DAO: `LocationDao` (vkládání, výběr dávky, mazání podle ID)
  - DB: `AppDatabase` (singleton, název `gps_reporter_database`)

- SharedPreferencesHelper
  - Zabaluje `EncryptedSharedPreferences` (AES256)

- Další: `ConsoleLogger`, `ServiceState`, `StatusMessages`

Knihovny:
- Google Play Services Location, Room, WorkManager, EncryptedSharedPreferences, Gson, LocalBroadcastManager, Coroutines, Material
