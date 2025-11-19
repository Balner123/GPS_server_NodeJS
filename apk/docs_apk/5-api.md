# API a síťová komunikace

Základní URL je dáno `BuildConfig.API_BASE_URL` (výchozí z build.gradle) a lze je přepsat v aplikaci uložením `server_url` v EncryptedSharedPreferences (nastavitelně v `LoginActivity`{login screen}).

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

### Handshake zařízení

- **Endpoint**: `POST {BASE_URL}/api/devices/handshake`
- **Hlavičky**: `Cookie: <session>`
- **Tělo (JSON)**: `device_id`, `client_type`, `power_status`, `app_version`, `platform`, `reason`
- **Odpověď (HTTP 200, JSON)**:
  - `registered` (bool)
  - `config.interval_gps` (int, volitelně)
  - `config.interval_send` (int, volitelně)
  - `power_instruction` (`"NONE"` | `"TURN_OFF"`)

**Chování klienta**:
- Pokud `registered == false`, klient provede bezpečné odhlášení (`FORCE_LOGOUT`).
- Při změně `config`, klient uloží hodnoty a restartuje `LocationService`, pokud je aktivní.
- Při obdržení `power_instruction`:
  - **`TURN_OFF`**: Klient zavolá `PowerController.requestTurnOff()`. Tím se nastaví `pending_turn_off_ack = true`, zastaví se `LocationService` a zablokuje její opětovné spuštění.
  - **`NONE`**: Klient zavolá `PowerController.markTurnOffAcknowledged()`. Tím se resetuje `pending_turn_off_ack` na `false` a službu je opět možné spustit.

### Odhlášení

- **Endpoint**: `POST {BASE_URL}/api/apk/logout`
- **Hlavičky**: `Cookie: <session>`
- **Tělo**: Prázdný JSON `{}`
- **Odpověď**: HTTP 200. Po úspěšném volání klient zneplatní lokální session.

### Odesílání poloh (dávky)

- **Endpoint**: `POST {BASE_URL}/api/devices/input`
- **Hlavičky**: `Content-Type: application/json; charset=utf-8`, `Cookie: <session>`
- **Tělo**: Pole JSON objektů (viz `4-data.md`).
- **Odpověď (HTTP 200, JSON)**: `success` (bool) a volitelně `interval_gps`, `interval_send` nebo `power_instruction`.

**Chování klienta při zpracování odpovědi**:
- **Chyba autorizace (HTTP 401/403)**: Klient iniciuje bezpečné odhlášení (`FORCE_LOGOUT`).
- **Změna konfigurace**: Aplikuje nové hodnoty a v případě potřeby restartuje `LocationService`.
- **Instrukce `power_instruction`**: Zpracuje se identicky jako v případě `handshake` endpointu (viz výše), tj. řízení přebírá `PowerController`.