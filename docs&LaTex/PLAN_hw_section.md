# Plán pro dokončení 1. kapitoly: Fyzické zařízení (HW)

Tento dokument slouží jako roadmapa pro doplnění obsahu do souboru `chapter_1_hw.tex` na základě analýzy podkladů ve složce `docs_hw`.

## Struktura kapitoly

### 1.1 Teoretická východiska a použité technologie (Hotovo)
- [x] Mikrokontroléry a SoC (ESP32)
- [x] Mobilní komunikace v IoT a AT příkazy
- [x] Globální navigační systémy (GPS)
- [x] Operační systémy reálného času (FreeRTOS)
- [x] Souborový systém LittleFS

### 1.2 Návrh hardware a elektroniky (K doplnění)
*Zdroj: `docs_hw/1-hardware.md`, `docs_hw/schemas/`*
- [ ] **1.2.1 Výběr klíčových komponent**
    - Zdůvodnění volby LilyGO T-SIM7000G (integrované řešení).
    - Popis modemu SIM7000G (LTE/GPRS/GPS).
    - Antény (aktivní GPS vs. pasivní GSM).
- [ ] **1.2.2 Schéma zapojení a periferie**
    - Popis blokového schématu (již vloženo, doplnit text).
    - Připojení periferií (LED, tlačítka, baterie).
- [ ] **1.2.3 Řízení napájení a spotřeby (Power Management)**
    - Detailní popis Power Latch obvodu (princip funkce).
    - Měření napětí baterie (ADC).
- [ ] **1.2.4 Návrh plošného spoje (PCB) a konstrukce**
    - Pokud existuje, popsat návrh desky pro Power Latch.
    - Fyzická montáž / krabička.

### 1.3 Implementace firmware (K doplnění)
*Zdroj: `docs_hw/2-firmware.md`, `docs_hw/schemas/life_cycle_...`*
- [ ] **1.3.1 Architektura a struktura projektu**
    - PlatformIO, rozdělení do modulů (.cpp/.h).
- [ ] **1.3.2 Životní cyklus zařízení (Stavový automat)**
    - Detailní popis stavů: INIT -> ACQUIRE_GPS -> SAVE_DATA -> TRANSMIT -> SLEEP.
    - Odkaz na diagram `life_cycle_states_dia.md`.
- [ ] **1.3.3 Správa paměti a souborový systém**
    - Ukládání do LittleFS (struktura souborů).
    - FIFO fronta pro offline data.

### 1.4 Komunikace a datový protokol (K doplnění)
*Zdroj: `docs_hw/4-data-format.md`*
- [ ] **1.4.1 Formát přenášených dat**
    - JSON struktura (timestamp, lat, lon, bat, signal...).
- [ ] **1.4.2 Handshake a synchronizace se serverem**
    - Výměna konfigurace při startu.

### 1.5 Konfigurace a správa zařízení (K doplnění)
*Zdroj: `docs_hw/3-configuration.md`, `docs_hw/5-ota.md`*
- [ ] **1.5.1 Konfigurační parametry**
    - APN, URL serveru, intervaly.
- [ ] **1.5.2 Vzdálená aktualizace (OTA)**
    - Princip stahování firmware z URL.
