# Hardware a zapojení

Tento dokument popisuje klíčové piny a periferie pro firmware v `MAIN/FINAL` (cílová deska: LilyGO T‑Call A7670 V1.0, viz `platformio.ini`).

## Deska a periferie

- **MCU:** ESP32 (integrovaný na T‑Call A7670)
- **Modem:** SIMCOM A7670 (TinyGSM profil `TINY_GSM_MODEM_A7670`)
- **GPS:** externí modul (např. NEO‑6M) napájený a řízený přes ESP32
- **Tlačítko:** sdílené pro ruční shutdown i vstup do OTA režimu (GPIO32)
- **Status LED:** GPIO19 (`STATUS_LED_PIN`) s napájením na běžný GND – samostatná indikační LED, aby indikace neovlivňovala napájení modemu.

Mapování pinů vychází z `utilities.h` (`#define LILYGO_T_CALL_A7670_V1_0`). Pokud použijete jinou variantu, upravte makro a zkontrolujte nové mapování.

## Použité GPIO

### Napájení a ovládání
- `PIN_EN` – GPIO23: drží hlavní napájení HIGH (latch).
- `PIN_BTN` – GPIO32: tlačítko se pull-upem k 3V3. Krátký stisk v běžném režimu spustí `graceful_shutdown()`, dlouhý stisk při bootu aktivuje OTA.
- `STATUS_LED_PIN` – GPIO19: LED řízená firmwarem (svítí při běžném režimu, bliká v OTA). Připojte přes rezistor na běžnou zem.
- `BOARD_POWERON_PIN` – GPIO12: musí zůstat v logické 1, aby byl modem napájen (už není používán pro blikání).

### Externí GPS (SoftwareSerial)
- GPIO34 (ESP32 RX) ← GPS TX (`SerialGPS`)
- GPIO33 (ESP32 TX) → GPS RX
- GPIO5 → spínání napájení GPS (tranzistor / enable pin)

### Modem A7670 (UART1)
- `BOARD_PWRKEY_PIN` – GPIO4
- `MODEM_TX_PIN` – GPIO26 (ESP32 → modem)
- `MODEM_RX_PIN` – GPIO25 (modem → ESP32)
- `MODEM_RESET_PIN` – GPIO27 (aktivní LOW)
- `MODEM_DTR_PIN` – GPIO14
- `BOARD_POWERON_PIN` – GPIO12 (sdíleno se status LED u V1.0)

> **Poznámka:** Zkompilovaný firmware očekává výchozí hodnoty z `utilities.h`. Pokud deska používá odlišné zapojení (např. V1.1, A7670E S3), je nutné předefinovat makro v `config.h` (sekce „Hardware Variant Selection“).

## Napájení a úspora energie

- Firmware využívá deep-sleep mezi cykly. `sleepTimeSeconds` je konfigurovatelné (default 60 s, může změnit server).
- Modem i GPS jsou zapínány pouze na dobu nezbytnou pro handshake / upload / akvizici polohy.
- `graceful_shutdown()` přepne LED, odpojí periferie, uloží stav a stáhne EN pin. V případě, že latch nezabere, ESP32 vstoupí do nekonečného deep-sleepu.

## Antény

- **LTE:** připojte hlavní anténu na konektor „MAIN“ (doporučeno přidat i AUX pro diverzitu).
- **GPS:** aktivní GPS anténa do konektoru označeného „GPS“ na modemu.

## Další zdroje

- Přehled požadovaných signálů: `docs_hw/schemas/ZAPOJENI.txt`
- Schémata v PDF/obrázcích: složka `docs_hw/schemas/`
