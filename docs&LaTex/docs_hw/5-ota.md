# Servisní (OTA) režim

Tento článek popisuje režim používaný pro servisní zásahy: registraci zařízení, konfiguraci připojení, testy konektivity a nahrávání firmwaru. Hlavní implementace je v `MAIN/FINAL/ota_mode.cpp`.

## Vstup do servisního režimu

- Po zapnutí zařízení držte stisknuté servisní tlačítko na pinu `PIN_BTN` (GPIO32). Držení delší než `BTN_LONG_PRESS_MS` (2 s) přepne zařízení do servisního režimu.
- Krátké stisky vyvolají běžné interakce (probuzení, ruční vypnutí); neaktivují OTA.

Při vstupu do OTA režimu firmware provede pořadí inicializací:
1. Inicializace napájení a bezpečnostních ISR (`power_init()`).
2. Načtení persistovaných konfigurací (`fs_load_configuration()`).
3. Výpočet `deviceID` (posledních 10 hex znaků MAC). 
4. Inicializace modemu a pokus o GPRS připojení s uloženými APN údaji.
5. Spuštění lokálního Wi‑Fi AP a webového rozhraní na `http://192.168.4.1` (výchozí SSID: `lotrTrackerOTA_<DeviceID>`).

## Webové rozhraní – přehled funkcí

- Úvodní stránka (`/`): zobrazení `Device ID`, názvu zařízení, stavu GPRS a odkazů na Settings, Firmware Update a Registration.
- Settings (`/settings`, POST `/savesettings`): formulář pro APN, GPRS uživatele/heslo, hostname serveru/port, název zařízení a OTA SSID/heslo. Změny se ukládají do `Preferences` a na zařízení se projevují okamžitě po načtení konfigurace.
- Test GPRS (`/testgprs`): provede dočasný test připojení s hodnotami z formuláře a vrátí JSON odpověď (`{"success": true|false}`).
- Registrace (`/doregister`): vyžaduje funkční GPRS; POST přeposílá registrační JSON na backend (`/api/devices/register`).
- Firmware Update (`/update`): nahrání binárního souboru (.bin) a spuštění standardního OTA procesu; po nahrání vyžadovat restart podle instrukcí rozhraní.

Poznámka: detailní payloady a vzory JSON jsou uloženy v `docs_hw/schemas/` (pokud je potřeba delší ukázka, vložte ji tam a odkažte).

## Persistovaná nastavení (`Preferences`)

OTA rozhraní zapisuje následující klíče, které používá i tracker režim:

- `apn`, `gprsUser`, `gprsPass`
- `server`, `port`
- `deviceName`
- `ota_ssid`, `ota_password`

Poznámka k `ota_password`: v aktuální implementaci firmwareu se při vstupu do OTA režimu, pokud je v Preferences uložené `ota_password`, toto pole explicitně vymaže (uloží se prázdné heslo). Důvodem je, že webový hotspot bývá často otevřený pro první konfiguraci; pokud chcete mít trvale chráněný AP, je třeba upravit nastavení po prvním startu nebo upravit firmware.

Backend přes handshake nebo konfigurace může také přepisovat provozní klíče jako `sleepTime`, `minSats`, `batch_size`, `registered` nebo `mode`.

## Chování při chybách

- Pokud není dostupné GPRS při pokusu o registraci, vrací rozhraní HTTP 503 a registrace selže.
- Chyby během nahrávání firmwaru zruší proces bez aplikace změn; stav zůstává v režimu servisního rozhraní.
- Po úspěšné registraci nebo konfiguraci doporučujeme provést kontrolovaný restart do běžného režimu.

## Doporučený servisní postup

1. Vstup do OTA režimu pomocí servisního tlačítka (stisk do doby než signální LED začne blikat)
2. Připojení k AP `lotrTrackerOTA_<DeviceID>` a otevření `http://192.168.4.1`.
3. Aktualizace nastavení (APN, server) a ověření pomocí `Test GPRS`.
4. Registrace zařízení přes `Registration` (pouze pokud je potřebné) a kontrola odpovědi backendu.
5. Nahrání firmwaru přes `Firmware Update` (pouze ověřené a podepsané soubory v produkci).
6. Restart zařízení a ověření normálního provozu.

