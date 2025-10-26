# Servisní (OTA) režim

Servisní režim slouží k registraci zařízení, změně nastavení a nahrání nového firmwaru.

## Vstup do OTA

- Přiveďte GPIO23 (otaPin) na 3.3V a zapněte zařízení.
- Firmware nejprve inicializuje modem a pokusí se připojit k GPRS (kvůli registraci a testům).
- Založí Wi‑Fi AP s SSID podle nastavení (výchozí `lotrTrackerOTA_<DeviceID>`) a heslem (výchozí `password`).
- Web běží na `http://192.168.4.1`.

## Stránky a funkce

- Úvodní stránka
  - Zobrazuje `Device ID` (posledních 10 znaků MAC) a stav `GPRS Connected/Failed`.
  - Odkazy na `Settings` (nastavení) a `Firmware Update` (OTA update).

- Register Device (`/doregister` – POST)
  - Formulář s uživatelským jménem a heslem k vašemu účtu na serveru.
  - Odesílá JSON na `/api/hw/register-device`: `{username, password, deviceId, name}`.
  - Po úspěchu restartujte do normálního režimu.

- Settings (`/settings`)
  - APN, GPRS user/pass
  - Server hostname a port (port je využit jak pro odesílání dat trackerem, tak pro test v této stránce)
  - Device Name (odesílá se v payloadu)
  - OTA SSID a heslo (platí od dalšího zapnutí do OTA)
  - Test GPRS (`/testgprs?apn=...&user=...&pass=...`) – krátké připojení a odpojení
  - Test serveru (`/testserver?host=...&port=...`) – TCP connect na host:port

- Firmware Update (`/update`)
  - Nahrání `.bin` souboru a provedení OTA aktualizace
  - Po úspěchu je potřeba ručně restartovat a přepnout zpět do běžného režimu

## Perzistence nastavení

Nastavení se ukládá do `Preferences` pod jménem `gps-tracker`:

- `apn`, `gprsUser`, `gprsPass`
- `server` (hostname), `port` (zatím jen pro test serveru)
- `deviceName`
- `ota_ssid`, `ota_password`
- `batch_size` (nastavuje server)

Po uložení nastavení v OTA režimu se okamžitě načte (pro testy), ale změny SSID/hesla Wi‑Fi AP se projeví až při příštím startu do OTA.
