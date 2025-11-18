# Architektura firmware (FINAL build)

Firmware je rozdělen do modulů: `main.ino`, `power_management`, `gps_control`, `modem_control`, `file_system`, `ota_mode`. Níže je stručný, formální popis pracovního cyklu a jednotlivých modulů, určený pro dokumentaci a integraci do finálního textu.

## Start a inicializace

- `setup()` provede inicializaci napájení (`power_on()`), sériové linky a kontrolu tlačítka (`PIN_BTN`).
- Držení tlačítka (`BTN_LONG_PRESS_MS`, ~2 s) při bootu aktivuje servisní režim (`start_ota_mode()`); krátké stisky jsou vynechány obsluhou v RTOS úloze.
- Po inicializaci se spouští hlavní pracovní cyklus `work_cycle()`.

## Hlavní pracovní cyklus (`work_cycle`)

1. Souborový systém a konfigurace
   - Montáž `LittleFS` a načtení perzistentních hodnot (`fs_load_configuration()`): APN, server, `sleepTimeSeconds`, `minSatellitesForFix`, OTA parametry apod.
   - Device identifikace generovaná z MAC adresy (zkrácená forma `deviceID`).

2. GPS akvizice
   - Pokud není přítomna instrukce k vypnutí, dojde k aktivaci GPS (`gps_power_up()`) a vyžádání fixu (`gps_get_fix()` s timeoutem).
   - Validace fixu podle datumu, času a hodnoty satelitů (minimální počet konfigurovatelný parametrem).
   - Po pokusu o akvizici se GPS obvykle vypne pro úsporu energie.

3. Persistování záznamů
   - Úspěšné fixy se serializují a přidávají do lokálního cache souboru (`/gps_cache.log`) nebo struktury v LittleFS.
   - Pokud není fix k dispozici, může být zaznamenán pouze stav (`power_status`) pro pozdější synchronizaci.

4. Modem session: handshake a upload
   - Inicializace modemu, připojení GPRS a provedení handshake (`POST /api/devices/handshake`) s předáním `device_id`, `client_type` a `power_status`.
   - Aplikace obdržené konfigurace (`config.interval_gps`, `config.interval_send`, `power_instruction`).
   - V případě přítomnosti uložených dat provést dávkové odeslání (aktuální implementace firmware má limit 15 záznamů na dávku) na `/api/devices/input`; po úspěchu odstranit potvrzené záznamy. Poznámka: serverem zaslané `interval_send`/`batch_size` je sice ukládáno do Preferences, ale stávající firmware používá interní limit (viz `MAIN/FINAL/file_system.cpp`). Backend je navržen tak, aby bezpečně zpracoval až 15 záznamů; odeslání větších dávek může způsobit HTTP 500 (server error).
   - Ukončit GPRS session a vypnout modem.

5. Ukončení cyklu
   - Uložit stav a případně vstoupit do `deep_sleep(sleepTimeSeconds)`.

## Moduly (stručně)

- `gps_control`: akvizice fixů (TinyGPS++ + SoftwareSerial), správa timeoutů a validace.
- `file_system`: správa LittleFS, perzistence konfigurací a cache; synchronizace přes mutex.
- `modem_control`: řízení modemu (TinyGsm), GPRS session, HTTPS volání pro handshake a upload.
- `power_management`: reakce na tlačítko, řízení latch obvodu, `graceful_shutdown()`.

## Bezpečnost a robustnost

- Transakční odesílání: data z cache se odstraňují pouze po potvrzení serveru.
- Pokud server požaduje `TURN_OFF`, zařízení provede řízené ukončení po odeslání potvrzení.
- Všechny síťové přenosy by měly používat HTTPS a validaci certifikátů.

## Shrnutí API volání

- `POST /api/devices/handshake` – handshake + konfigurace.
- `POST /api/devices/input` – dávkové odesílání dat.
- `POST /api/devices/register` – registrace zařízení (OTA).

---
Poslední aktualizace: 2025-11-18
- `gps_get_fix()` běží s podporou přerušení: ISR z tlačítka může vyžádat předčasné ukončení (`gps_request_abort()`), aby bylo možné bezpečně vypnout při ručním zásahu.
