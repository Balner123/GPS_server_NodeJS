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

## Registrace zařízení
- Endpoint: `POST {BASE_URL}/api/apk/register-device`
- Hlavičky: `Cookie: <session>`
- Tělo (JSON):
  - `installationId` (string)
  - `deviceName` (string)
- Odpověď (HTTP 201/200, JSON):
  - `success` (bool)
  - `gps_interval` (int) – volitelně
  - `interval_send` (int) – volitelně

## Odesílání poloh (dávky)
- Endpoint: `POST {BASE_URL}/api/devices/input`
- Hlavičky: `Content-Type: application/json; charset=utf-8`, `Cookie: <session>`
- Tělo: pole objektů se strukturou viz `data.md`
- Odpověď (HTTP 200, JSON):
  - `success` (bool)
  - `message` (string)
  - `interval_gps` (int, sekund) – volitelně
  - `interval_send` (int, počet pozic) – volitelně

Poznámky:
- Při HTTP 403 aplikace vyvolá vynucené odhlášení.
- Pokud dorazí nové intervaly a odeslaná dávka byla větší (vyčištění backlogu), aplikace uloží nové hodnoty a restartuje `LocationService` pro jejich aplikaci.