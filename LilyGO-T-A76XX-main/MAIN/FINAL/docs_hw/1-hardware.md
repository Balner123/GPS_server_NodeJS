# Hardware a zapojení

Tento dokument popisuje hardwarové rozhraní zařízení založeného na desce LilyGO T‑Call (ESP32 + SIMCOM A7670). Obsahuje přehled periferií, mapování pinů a doporučení pro napájení a antény.

## Hlavní komponenty

- MCU: `ESP32`.
- Modem: `SIMCOM A7670` (TinyGSM profil `TINY_GSM_MODEM_A7670`).
- GPS: externí modul (např. `NEO‑6M`) připojený přes UART.
- Ovládací tlačítko: GPIO32 (servisní/OTA vstup a ruční vypnutí).
- Status LED: GPIO19 (`STATUS_LED_PIN`), oddělená od hlavního power latch obvodu.

Mapování pinů a varianty desek vycházejí z hlavičkových souborů (např. `utilities.h`). Při použití jiné varianty desky ověřte definice makra (např. `LILYGO_T_CALL_A7670_V1_0`) a případně upravte konfiguraci v `config.h`.

## GPIO a signály (stručně)

- Napájení a řízení
	- `PIN_EN` — GPIO23: power latch (držení napájení).
	- `PIN_BTN` — GPIO32: vstup tlačítka; krátký stisk spouští `graceful_shutdown()`, dlouhý stisk při bootu aktivuje servisní režim (OTA).
	- `STATUS_LED_PIN` — GPIO19: indikační LED (řadič přes rezistor).
	- `BOARD_POWERON_PIN` — GPIO12: kontrola napájení modemu.

- Externí GPS
	- GPS TX → GPIO34 (ESP32 RX)
	- GPS RX ← GPIO33 (ESP32 TX)
	- Řízení napájení GPS → GPIO5 (přes tranzistor/enable pin)

- Modem (UART)
	- `BOARD_PWRKEY_PIN` — GPIO4
	- `MODEM_TX_PIN` — GPIO26
	- `MODEM_RX_PIN` — GPIO25
	- `MODEM_RESET_PIN` — GPIO27 (aktivní LOW)
	- `MODEM_DTR_PIN` — GPIO14

	{dle modelu modemu => reference/READMElily.md}

## Napájení a úspora energie

- Firmware využívá režimy deep‑sleep mezi aktivačními cykly; parametr `sleepTimeSeconds` je konfigurovatelný.
- Modem a GPS jsou napájeny pouze po dobu nezbytnou pro akvizici a komunikaci; doporučuje se řízení napájení periferií.
- `graceful_shutdown()` provede sekvenční odpojení periferií, uloží stav a uvolní power latch.

## Schémata

- Schémata a výkresy: `schemas/` (PDF/obrázky).
- Seznam součástek: `schemas/PARTS_links.txt`(odkazy do eshopů a jejich výběr)