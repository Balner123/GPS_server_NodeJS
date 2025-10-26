# Služby a synchronizace

## LocationService
- Foreground služba s notifikací (kanál `LocationServiceChannel`)
- Akce broadcastů:
  - `com.example.gpsreporterapp.BROADCAST_STATUS` (stav služby)
  - `com.example.gpsreporterapp.REQUEST_STATUS_UPDATE` (pošle aktuální stav UI)
  - `com.example.gpsreporterapp.FORCE_LOGOUT` (vynucené odhlášení – přijímá MainActivity)
- Na startu:
  - Načte `gps_interval_seconds` a `sync_interval_count` ze SharedPrefs
  - Získá 1× okamžitou polohu, poté požádá o periodické aktualizace
- Ukládání polohy:
  - Každý fix se ukládá do Room a zvyšuje se `locationsCachedCount`
  - Pokud `locationsCachedCount >= sync_interval_count`, naplánuje se `SyncWorker` a čítač se resetuje
- Reakce na vypnutí GPS: zastavení služby a vyslání stavu

## SyncWorker
- Pracuje jen na připojené síti (CONNECTION REQUIRED)
- Dávkuje data z DB po např. 50 záznamech a odesílá na `${API_BASE_URL}/api/devices/input`
- Hlavičky: `Content-Type: application/json; charset=utf-8`, `Cookie: <session>`
- Při HTTP 200:
  - U větších dávek (>10) volitelně aplikuje hodnoty `interval_gps`, `interval_send` z odpovědi do SharedPrefs a restartuje službu
  - Smaže úspěšně odeslané záznamy
- Při HTTP 403: vyšle `FORCE_LOGOUT` broadcast (uživatel je odhlášen)
- Při jiných chybách: `Result.retry()`
