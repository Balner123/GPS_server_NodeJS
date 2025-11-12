# Architektura firmware (FINAL build)

Firmware v `MAIN/FINAL` je rozdělen do několika modulů (`main.ino`, `power_management`, `gps_control`, `modem_control`, `file_system`, `ota_mode`). Níže je popsáno chování běžného „tracker“ režimu, který běží po bootu, pokud uživatel nevyvolá servisní OTA režim.

## Start a příprava

- `setup()` začne vždy voláním `power_on()` a inicializací sériové linky.
- V prvních sekundách se kontroluje tlačítko na pinu `PIN_BTN` (GPIO32). Držení tlačítka po dobu `BTN_LONG_PRESS_MS` (2 s) vyvolá přechod do OTA režimu (`start_ota_mode()`). Krátké stisky se ignorují.
- Pokud OTA není aktivováno, spustí se `power_init()`: ISR + FreeRTOS úloha pro další krátké stisky (graceful shutdown), nastavení LED a evidence power-statusu.
- Následně se zavolá `work_cycle()` – vlastní pracovní cyklus.

## Pracovní cyklus (`work_cycle`)

1. **Souborový systém a konfigurace**
	- `fs_init()` montuje LittleFS a otevírá `Preferences` (`gps-tracker`).
	- `fs_load_configuration()` načte perzistentní hodnoty (APN, server, jméno zařízení, `sleepTimeSeconds`, `minSatellitesForFix`, OTA SSID/heslo atd.).
	- MAC adresa se převádí na `deviceID` (posledních 10 znaků bez dvojteček).

2. **GPS akvizice**
	- Pokud server neposlal instrukci k vypnutí (`power_instruction_get()`), zapne se externí GPS (`gps_power_up()`), inicializuje se SoftwareSerial a běží `gps_get_fix()` s limitem `GPS_ACQUISITION_TIMEOUT_MS` (5 minut).
	- Fix je uznán pouze při validní poloze, datu, čase a počtu satelitů ≥ `minSatellitesForFix` (výchozí 1; server může navýšit).
	- Po ukončení pokusu se GPS okamžitě vypne a rozhraní se uvolní.

3. **Uložení dat**
	- Úspěšné fixy se ukládají do `LittleFS` souboru `/gps_cache.log` jako samostatné JSON řádky (`append_to_cache`).
	- Přidává se i `power_status`, pokud čeká na potvrzení.
	- Počet úspěšných cyklů (`cycleCounter`) slouží k rozhodnutí, zda už nastal čas na upload (logika serveru rozhoduje podle dávky).

4. **Zpracování bez fixu**
	- Pokud fix neproběhne, ale je potřeba odeslat stav napájení (`power_status_report_pending()`), vznikne čistě stavový záznam bez GPS dat.

5. **Handshake + upload v jedné modem session**
	- `modem_initialize()` pošle sekvenci PWRKEY/RESET dle pinů v `utilities.h` a testuje AT komunikaci.
	- `modem_connect_gprs()` používá uložené APN a povolí datové přenosy.
	- Proběhne handshake (`modem_perform_handshake()` → POST na `/api/devices/handshake`): posílá `device_id`, `client_type` a aktuální `power_status`.
	- Server může vrátit:
	  - `registered` – stav registrace (uloží se pomocí `fs_set_registered`).
	  - `config` objekt s `interval_gps`, `interval_send`, `satellites`, `mode` (uloženo do Preferences).
	  - `power_instruction` – aktuálně `TURN_OFF` nebo `NONE`. TURN_OFF nastaví příznak pro pozdější vypnutí po doručení dat na server.
	- Pokud handshake potvrdí registraci a jsou data v cache, `send_cached_data()` odešle batche (max 50 záznamů) na `/api/devices/input`. Úspěch = odstranění z cache, případně potvrzení power-statusu a instrukce.
	- GPRS spojení i modem se po session vypnou (`modem_disconnect_gprs`, `modem_power_off`).

6. **Reakce na instrukce napájení**
	- Pokud server požadoval vypnutí (`power_instruction_should_shutdown()`), provede se `graceful_shutdown()` už po odeslání potvrzení.
	- Jinak se uvolní FS (`fs_end()`) a po návratu ze `work_cycle()` se volí další režim podle `isRegistered`.

7. **Spánek nebo trvalé vypnutí**
	- Registrované zařízení použije `enter_deep_sleep(sleepTimeSeconds)`.
	- Pokud registrace selhala, zařízení se vypne (`graceful_shutdown()`) a čeká na servisní zásah.

`loop()` zůstává prázdné – ESP32 přechází do spánku nebo vypnutí už v `setup()`.

## GPS modul (`gps_control`)

- Používá `TinyGPS++` + `SoftwareSerial` (GPIO34 jako RX, GPIO33 jako TX) s rychlostí 9600 bps.
- `gps_get_fix()` běží s podporou přerušení: ISR z tlačítka může vyžádat předčasné ukončení (`gps_request_abort()`), aby bylo možné bezpečně vypnout při ručním zásahu.
- Ukládá kompletní informace: lat/lon, rychlost, výšku, HDOP (dvojtřídná přesnost), počet satelitů a UTC datum+čas.

## File systém a konfigurace (`file_system`)

- Sdílí globální stav (APN, server, jméno zařízení, registrace). Synchronizace přes rekurzivní mutex.
- Persistované klíče: `apn`, `gprsUser`, `gprsPass`, `server`, `port`, `deviceName`, `mode`, `ota_ssid`, `ota_password`, `sleepTime`, `minSats`, `registered`, `batch_size`.
- `send_cached_data()` řeší dávkové odesílání a čtivé logování stavu.

## Modem (`modem_control`)

- Využívá `TinyGsm` (profil A7670). Všechny operace jsou chráněné mutexem, aby se vyhnuly kolizím.
- Vestavěná HTTPS implementace se používá pro handshake, registraci a upload. URL se skládá dynamicky – port 80 = HTTP, jinak HTTPS (`https://host`, port ≠ 443 se přidává v URL).
- Handshake pracuje s globálními proměnnými z `file_system` a informuje `power_management` o instrukcích.

## Power management (`power_management`)

- Řeší LED, hlavní napájení (`PIN_EN`), reakci na tlačítko a bezpečné vypnutí.
- ISR pouze notifikuje RTOS úlohu (`ShutdownTask`), která po verifikaci stisku spustí `graceful_shutdown()`.
- `graceful_shutdown()` vypne modem, GPS, zavře FS, stáhne `PIN_EN` a pro jistotu přejde do nekonečného deep-sleepu.
- Sleduje `power_status` (ON → OFF) a zda už server přijal potvrzení.

## Shrnutí komunikace se serverem

- **Handshake:** `POST /api/devices/handshake` – posílá ID, typ klienta a power status; přijímá změny konfigurace, registrace a instrukce vypnutí.
- **Upload dat:** `POST /api/devices/input` – JSON pole s datovými záznamy a případně také záznamem `power_status`.
- **Registrace (pouze OTA):** `POST /api/devices/register`.

Tento dokument nahrazuje starší popis, který vycházel z předchozí verze firmwaru a neobsahoval handshake, power management ani button-based OTA aktivaci.
