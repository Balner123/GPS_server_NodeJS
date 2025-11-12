# Konfigurace a perzistence

Firmware ukládá konfiguraci do `Preferences` (jméno prostoru: `gps-tracker`). Hodnoty lze měnit primárně v OTA režimu, některé přepisuje server během handshake a uploadu.

## Co může nastavit uživatel (OTA → Settings)

- `apn`, `gprsUser`, `gprsPass`
- `server` (hostname), `port`
- `deviceName`
- `ota_ssid`, `ota_password`

Změny se ukládají okamžitě a jsou načítány v každém běžném cyklu (`fs_load_configuration`).

## Co může přepsat server

Server posílá konfiguraci ve dvou typech odpovědí:

1. **Handshake (`POST /api/devices/handshake`)** – vždy na začátku modem session. Může vrátit:
	- `config.interval_gps` → ukládá se jako `sleepTime` (`uint64_t`, sekundy), používá se pro `enter_deep_sleep()`.
	- `config.interval_send` → ukládá se jako `batch_size` (`uint8_t`, 1–50), řídí velikost upload batchů.
	- `config.satellites` → ukládá se jako `minSats` (int), minimální počet satelitů pro fix.
	- `config.mode` → ukládá se jako `mode` (String), rezervováno pro budoucí logiku.
	- `registered` → ukládá se jako `registered` (bool). Pokud je `false`, tracker po cyklu přejde do vypnutí.
	- `power_instruction` → hodnoty `TURN_OFF` / `NONE`; ukládá se do RAM (`power_instruction_apply`). Preference se nemění, ale stav se loguje.

2. **Upload dat (`POST /api/devices/input`)** – odpověď může obsahovat stejná pole jako handshake a navíc `success`. Při obsahu `power_status` v dávce se zde potvrzuje (`power_instruction_acknowledged`, `power_status_report_acknowledged`).

## Další uložené klíče

- `sleepTime` – poslední platná hodnota pro deep-sleep (sekundy, výchozí 60).
- `minSats` – minimum satelitů pro uznání fixu (výchozí 1).
- `batch_size` – velikost dávky, defaultně není uložena (řeší se serverem).
- `registered` – boolean, zda backend považuje zařízení za registrované.
- `mode` – textová hodnota, zatím pouze předávána serverem (např. `batch`).

## Device ID

- `deviceID` se neukládá do Preferences; počítá se při každém startu z MAC adresy ESP32 (posledních 10 znaků bez dvojteček).
- Výchozí OTA SSID je `lotrTrackerOTA_<DeviceID>`.
- ID se posílá v každé komunikaci (data, handshake, registrace) a je zobrazeno ve webovém rozhraní OTA.
