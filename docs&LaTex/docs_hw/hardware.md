# Hardware a zapojení

Tento dokument popisuje praktické piny, zapojení a poznámky k napájení pro aktuální firmware (`MAIN/gps_tracker.ino`).

## Deska a periferie

- MCU: ESP32 (LilyGO T‑Call A7670X V1.0 – viz `platformio.ini`)
- Modem: SIMCOM A76xx (ovládání přes `Serial1` + piny dle `utilities.h`)
- Externí GPS: NEO‑6M (nebo kompatibilní), připojená přes SoftwareSerial

## Piny používané firmwarem

Externí GPS modul (z `gps_tracker.ino`):

- ESP32 GPIO33 (RX ESP32) ← GPS TX
- ESP32 GPIO32 (TX ESP32) → GPS RX
- ESP32 GPIO5  → řízení napájení GPS (přes tranzistor)

Servisní/OTA přepínač:

- ESP32 GPIO23 (otaPin) → připojit na 3.3V pro vstup do OTA režimu při startu

Modem A76xx (výběr podle desky – zde T‑Call A7670 V1.0; z `utilities.h`):

- BOARD_PWRKEY_PIN: GPIO4 (sekvence zapnutí modemu)
- MODEM_TX_PIN: GPIO26, MODEM_RX_PIN: GPIO25 (UART do modemu)
- MODEM_RESET_PIN: GPIO27 (aktivní LOW)
- MODEM_DTR_PIN: GPIO14
- BOARD_POWERON_PIN: GPIO12 (indikace napájení – u V1.0 slouží jako LED)

Pozn.: Pokud používáte jinou variantu desky, zvolte správné `default_envs` v `platformio.ini` a zkontrolujte mapování pinů v `MAIN/utilities.h`.

## Napájení a spotřeba

- Firmware je navržen pro nízkou spotřebu: mimo pracovní okno spí v hlubokém spánku.
- GPS i modem jsou aktivní pouze po nezbytně nutnou dobu.
- Hlavní vypínač baterie je mimo kontrolu firmwaru – chová se podle hardwaru.

## Antény

- GPS: aktivní GPS anténa do konektoru „GPS“ na desce modemu.
- LTE: „MAIN/SIM“ – hlavní anténa; „AUX“ – diverzitní anténa (posiluje signál).

## Schémata

- Viz `docs/schemas/schema.png` nebo `easyeda_schema.pdf`.
- Souhrn signálů: `docs/schemas/ZAPOJENI.txt`.
