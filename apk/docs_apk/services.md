# Služby a synchronizace

## LocationService
- Foreground služba s notifikací (kanál `LocationServiceChannel`)
- Pokud je uložený `power_status=OFF`, jakýkoli pokus o start služby je ignorován a služba se sama ukončí
- Akce broadcastů:
  - `com.example.gpsreporterapp.BROADCAST_STATUS` (stav služby)
  - `com.example.gpsreporterapp.REQUEST_STATUS_UPDATE` (pošle aktuální stav UI)
  - `com.example.gpsreporterapp.FORCE_LOGOUT` (vynucené odhlášení – přijímá MainActivity)
- Na startu:
  - Načte `gps_interval_seconds` a `sync_interval_count` ze SharedPrefs
  - Nastaví `power_status="ON"` a spustí handshake (`/api/devices/handshake`) pro získání konfigurace a instrukcí
  - Získá 1× okamžitou polohu, poté požádá o periodické aktualizace
- Ukládání polohy:
  - Každý fix se ukládá do Room a zvyšuje se `locationsCachedCount`
  - Pokud `locationsCachedCount >= sync_interval_count`, naplánuje se `SyncWorker` a čítač se resetuje
- Reakce na vypnutí GPS: zastavení služby, handshake s `power_status="OFF"` a vyslání stavu
- Instrukce `TURN_OFF` ze serveru (z handshake odpovědi) zastaví službu, přepne `power_status="OFF"`, aktualizuje UI a okamžitě odešle potvrzovací handshake, aby server mohl instrukci odstranit
- `ServiceState` se skládá z perzistentního `power_status`, takže UI zůstává v režimu OFF i při opožděných broadcastech
- Při odhlášení aplikace provede `POST /api/apk/logout` a teprve poté lokálně zneplatní session

## HandshakeManager / HandshakeWorker
- `HandshakeManager` zabalí volání `/api/devices/handshake`, aplikuje konfiguraci a interpretuje `power_instruction`
- Pokud se konfigurace změní, restartuje `LocationService` jen tehdy, když je zařízení v režimu ON a server současně nepožaduje `TURN_OFF`
- `PowerController` centralizuje reakce na `TURN_OFF` – zastaví službu, vyhlásí stav `OFF`, zruší periodický handshake a naplánuje jediné potvrzení vůči serveru
- `HandshakeWorker` umožňuje naplánované/opožděné handshake (WorkManager)
- Při startu služby se plánuje periodický handshake (aktuálně každých 60 minut), při zastavení služby se plán ruší
- SyncWorker interpretuje `power_instruction` i ze `/api/devices/input` odpovědí (např. serverem vyžádané vypnutí)

## SyncWorker
- Pracuje jen na připojené síti (CONNECTION REQUIRED)
- Dávkuje data z DB po max. 50 záznamech a odesílá na `${API_BASE_URL}/api/devices/input`
- Hlavičky: `Content-Type: application/json; charset=utf-8`, `Cookie: <session>`
- Po úspěchu smaže odeslané záznamy z Room (žádné opakované odeslání)
- Aplikuje `interval_gps` / `interval_send` podle serveru a pokud je služba aktivní, provede kontrolovaný restart pro načtení nové konfigurace
- Instrukce `TURN_OFF` ze synchronizace:
  - Okamžitě nastaví `power_status="OFF"`, stopne `LocationService` a odešle broadcast pro UI
  - Spustí potvrzovací handshake asynchronně (`launchHandshake`) + naplánuje `HandshakeWorker`, aby server získal potvrzení i při krátkém výpadku
- Při HTTP 403 vyšle `FORCE_LOGOUT` broadcast (uživatel je odhlášen)
- Při jiných chybách vrací `Result.retry()` a odeslání se pokusí znovu
