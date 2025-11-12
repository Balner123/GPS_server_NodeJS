# API a síťová komunikace

Základní URL je dáno `BuildConfig.API_BASE_URL` (výchozí z build.gradle) a lze je přepsat v aplikaci uložením `server_url` v EncryptedSharedPreferences (nastavitelně v `LoginActivity`).

## Přihlášení
- Endpoint: `POST {BASE_URL}/api/apk/login`
- Tělo (JSON):
  - `identifier` (string)
  - `password` (string)
  - `installationId` (string)
- Odpověď (HTTP 200, JSON):
  - `success` (bool)
  - `device_is_registered` (bool)
  - `gps_interval` (int, sekund) – může být přítomen
  - `interval_send` (int, počet pozic) – může být přítomen
  - Set-Cookie hlavička se session cookie (aplikace si uloží první část před `;`)

- Endpoint: `POST {BASE_URL}/api/devices/register`
- Hlavičky: `Cookie: <session>`
- Tělo (JSON):
  - `client_type` = `"APK"`
  - `device_id` (string, např. installationId)
  - `name` (string, alias zařízení)
- Odpověď (HTTP 201/200, JSON):
  - `success` (bool)
  - `already_registered` (bool) – pokud bylo zařízení už zapsané
  - `interval_gps` (int) – volitelně
  - `interval_send` (int) – volitelně

## Handshake zařízení
- Endpoint: `POST {BASE_URL}/api/devices/handshake`
- Hlavičky: `Cookie: <session>`
- Tělo (JSON):
  - `device_id` (string)
  - `client_type` = `"APK"`
  - `power_status` = `"ON" | "OFF"`
  - `app_version` (string)
  - `platform` (string, např. `Android 34`)
  - `reason` (string, telemetrie klienta – např. `service_start`)
- Odpověď (HTTP 200, JSON):
  - `registered` (bool)
  - `config.interval_gps` (int) – volitelně
  - `config.interval_send` (int) – volitelně
  - `config.mode`, `config.satellites` – volitelně, pro budoucí rozšíření
  - `power_instruction` (`"NONE" | "TURN_OFF"`)

Chování klienta:
- Pokud `registered=false`, vyvolá se vynucené odhlášení s žádostí o novou registraci.
- Při změně konfigurace se hodnoty uloží do SharedPreferences a restartuje se `LocationService`.
- Instrukce `TURN_OFF` zastaví službu, nastaví `power_status="OFF"`, aktualizuje UI a klient odešle potvrzovací handshake (reason např. `turn_off_ack`), aby server mohl instrukci zneplatnit.

## Odhlášení
- Endpoint: `POST {BASE_URL}/api/apk/logout`
- Hlavičky: `Cookie: <session>`
- Tělo: `{}` (prázdný JSON)
- Odpověď: HTTP 200 na úspěch, chyby se logují do konzole APK.
- APK volá endpoint při uživatelském odhlášení a následně zneplatní lokální session.

## Odesílání poloh (dávky)
- Endpoint: `POST {BASE_URL}/api/devices/input`
- Hlavičky: `Content-Type: application/json; charset=utf-8`, `Cookie: <session>`
- Tělo: pole objektů se strukturou viz `data.md`
- Odpověď (HTTP 200, JSON):
  - `success` (bool)
  - `message` (string)
  - `interval_gps` (int, sekund) – volitelně
  - `interval_send` (int, počet pozic) – volitelně
  - `power_instruction` (`"NONE" | "TURN_OFF"`)

Poznámky:
- Při HTTP 403 aplikace vyvolá vynucené odhlášení.
- Pokud dorazí nové intervaly a odeslaná dávka byla větší (vyčištění backlogu), aplikace uloží nové hodnoty a restartuje `LocationService` pro jejich aplikaci.
- Instrukce `power_instruction="TURN_OFF"` z odpovědí handshake i input znamenají okamžité zastavení služby a hlášení `power_status="OFF"`.
- Po vynuceném vypnutí se ihned spouští handshake potvrzení (inline + naplánovaný `HandshakeWorker`), aby server mohl instrukci zrušit.