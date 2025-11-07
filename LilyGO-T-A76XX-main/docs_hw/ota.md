# Servisní (OTA) režim

Servisní režim slouží k registraci zařízení, změně nastavení, testu konektivity a nahrání nového firmwaru. Odpovídající kód je v `MAIN/FINAL/ota_mode.cpp`.

## Jak vstoupit do OTA režimu

- Připojte napájení a hned po resetu **držte tlačítko na pinu `PIN_BTN` (GPIO32)**.
- Pokud tlačítko zůstane stisknuté po dobu `BTN_LONG_PRESS_MS` (2 s), firmware přepne do servisního režimu.
- Krátké stisky pouze probudí zařízení nebo vyvolají ruční shutdown v běžném režimu, k OTA nedojde.

Po úspěšném vstupu OTA provede:

1. `power_init()` – aktivuje ISR a RTOS úlohu pro bezpečné vypnutí v případě potřeby.
2. `fs_load_configuration()` – natáhne posledně uložené nastavení (APN, SSID atd.).
3. Znovu spočítá `deviceID` (posledních 10 znaků MAC).
4. Inicializuje modem (`modem_initialize()`) a pokusí se o GPRS připojení s uloženými údaji. Výsledek je zobrazen na titulní stránce.
5. Spustí Wi‑Fi AP s SSID z konfigurace (výchozí `lotrTrackerOTA_<DeviceID>`) a heslem (výchozí `password`). Web rozhraní běží na `http://192.168.4.1`.

## Webové rozhraní

- **Úvodní stránka (`/`)**
  - Zobrazuje `Device ID`, název zařízení a aktuální stav GPRS (`Connected` / `Connection Failed`).
  - Poskytuje odkazy na Settings, Firmware Update a Registration.
  - LED v OTA režimu bliká (250 ms) jako vizuální indikace.

- **Settings (`/settings`, POST `/savesettings`)**
  - Formulář pro uložení APN, GPRS user/pass, server hostname a port, název zařízení, OTA SSID/heslo.
  - Data se ukládají do `Preferences` a okamžitě se načítají zpět (`fs_load_configuration()`), takže změny jsou vidět bez restartu.
  - `Test GPRS` → endpoint `/testgprs`: provozně odpojí aktuální GPRS, otestuje připojení s hodnotami z formuláře a vrátí JSON (`{"success":true|false}`). Poté se zkusí vrátit k původní konfiguraci.
  - `Test server` → endpoint `/testserver`: aktuálně vrací pouze simulovaný výsledek; slouží jako šablona pro budoucí implementaci TCP testu.

- **Registrace (`/doregister`)**
  - Vyžaduje aktivní GPRS připojení, jinak vrací HTTP 503.
  - POST formulář odesílá JSON na endpoint `RESOURCE_REGISTER` (`/api/devices/register`). Payload obsahuje `client_type`, `username`, `password`, `device_id` a `name`.
  - Odpověď se zobrazí jako stylovaná stránka – úspěch nebo důvod neúspěchu ze serveru.

- **Firmware Update (`/update`)**
  - Upload `.bin` souboru přes standardní OTA mechaniku (`Update` API).
  - Po dokončení se zobrazí informační stránka; restart a návrat do běžného režimu provádí uživatel.

## Co se ukládá do `Preferences`

OTA rozhraní zapisuje stejné klíče, které se používají i v tracker režimu:

- `apn`, `gprsUser`, `gprsPass`
- `server`, `port`
- `deviceName`
- `ota_ssid`, `ota_password`

Další klíče (`sleepTime`, `minSats`, `batch_size`, `registered`, `mode`) nastavuje převážně backend během handshaku nebo uploadu; OTA je pouze zobrazuje.

> **Tip:** Po změně SSID/hesla pro OTA zůstane původní AP aktivní až do restartu. Při příštím vstupu do servisního režimu už bude použita nová hodnota.
