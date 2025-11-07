# Analýza funkčnosti firmwaru (FINAL)

Tento dokument shrnuje architekturu zdrojů v `MAIN/FINAL` a navazuje na soubory `main.ino`, `power_management.*`, `gps_control.*`, `modem_control.*`, `file_system.*` a `ota_mode.*`.

## Základní režim: probuzení → práce → spánek/vypnutí

- Logika probíhá v `setup()`. `loop()` zůstává prázdná.
- Po bootu firmware drží napájení (`power_on()`), nastaví UART a kontroluje dlouhé podržení tlačítka (`PIN_BTN`, GPIO32). Dlouhý stisk (≥2 s) aktivuje OTA, jinak pokračuje tracker.
- Aktivuje se `power_init()` – nastaví LED, ISR pro tlačítko a RTOS úlohu pro ruční shutdown.
- `work_cycle()` vždy proběhne jednou; na konci se rozhodne o deep-sleepu nebo vypnutí.

## Moduly a jejich role

- **`power_management`**
  - Řídí vypínání: stavový automat ON/OFF, potvrzení serveru, reakci na tlačítko.
  - `graceful_shutdown()` koordinuje vypnutí modemu, GPS a FS a následně stáhne `PIN_EN`.
  - Evidence power-statusu se propisuje do serveru (součást handshake a batch uploadu).

- **`file_system`**
  - Montuje LittleFS, obsluhuje cache (`/gps_cache.log`) a Preferences (`gps-tracker`).
  - Sdílí globální konfigurační proměnné (APN, server, zařízení registrované/nergistrované, interval spánku atd.).
  - `send_cached_data()` odesílá data v dávkách, reaguje na HTTP kódy 404/409/5xx a ukládá konfiguraci z odpovědi.

- **`gps_control`**
  - Spravuje napájení a komunikaci s externím GPS (GPIO5 + SoftwareSerial na GPIO34/33).
  - `gps_get_fix()` běží do timeoutu 5 minut a validuje satelity ≥ `minSatellitesForFix` (výchozí 1, server může zvýšit).
  - Ukládané údaje: pozice, rychlost, výška, HDOP, počet satelitů a UTC datum/čas.

- **`modem_control`**
  - Operace s SIMCOM A76xx (TinyGSM). Zahrnuje sekvence PWRKEY/RESET, GPRS připojení a HTTPS volání.
  - `modem_perform_handshake()` volá `/api/devices/handshake`, předává `power_status` a přijímá `config`, `registered`, `power_instruction`.
  - `modem_send_post_request()` dynamicky staví URL podle portu (HTTP pro 80, jinak HTTPS; port ≠443 se přidá do cesty).

- **`ota_mode`**
  - WebServer na portu 80 v režimu AP (`lotrTrackerOTA_<DeviceID>` + heslo).
  - Uchovává přístup k Preferences a sdílí globální stav (APN, server, `deviceName`).
  - Umožňuje registraci (POST `/api/devices/register`), test GPRS, editaci konfigurace a nahrání firmware.

## Tracker cyklus – detail

1. **FS + konfigurace**: mount LittleFS, načti Preferences, spočítej `deviceID`.
2. **GPS**: pokud není aktivní `PowerInstruction::TurnOff`, zapni GPS, čekej na fix, ulož data do cache.
3. **Power status**: potřebuje-li server potvrdit vypnutí, přidá se stavový záznam do cache.
4. **Handshake + upload**: modem session zahrnuje handshake a případný upload. Handshake může změnit interval spánku, batch size, min satelity nebo vyžádat vypnutí.
5. **Reakce**: pokud server požádal o vypnutí a potvrdil ho (`power_instruction_should_shutdown()`), provede se `graceful_shutdown()`.
6. **Sleep**: registrované zařízení nastaví timer na `sleepTimeSeconds` a usne (`enter_deep_sleep`). Neregistrované se vypne a čeká na OTA registraci.

## OTA režim (souhrn)

- Aktivace dlouhým podržením tlačítka během bootu.
- LED bliká, běží WebServer s endpoints `/`, `/settings`, `/savesettings`, `/testgprs`, `/testserver` (zatím simulace), `/doregister`, `/update`.
- Připojení ke GPRS se pokouší ihned po startu; výsledek se zobrazuje na webu.

## Shrnutí hlavních změn oproti starší dokumentaci

- OTA se spouští tlačítkem, nikoliv externím pinem 23.
- Nejprve probíhá handshake (`/api/devices/handshake`), který může zařízení vypnout a přepisuje konfiguraci.
- Upload přidává záznamy `power_status` a podporuje potvrzení serverových instrukcí.
- `port` z Preferences se používá jak pro handshake, tak pro upload (HTTP vs. HTTPS je určeno hodnotou portu).
- Výchozí minimum satelitů je 1 (dříve 7).
