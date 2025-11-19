# Use Case Diagram - Funkčnost zařízení SIMPLE

```mermaid
stateDiagram
    %% Definice aktérů mimo stavy jen jako poznámka, nebo vstup
    [*] --> Boot : Uživatel připojí napájení / Timer

    state "GPS Tracker (Firmware)" as System {
        state "Studený start" as Boot
        state "Kontrola tlačítka" as CheckBtn
        state "OTA / Servisní režim" as OTA
        state "Webová konfigurace" as WebConfig
        state "Pracovní cyklus" as Work
        state "Deep Sleep" as Sleep
        state "Vypnuto" as Off
        state "Vypnuto" as Off2

        Boot --> CheckBtn
        
        CheckBtn --> OTA : Dlouhý stisk (>2s)
        CheckBtn --> Work : Tlačítko uvolněno
        
        OTA --> WebConfig
        
        Work --> Sleep : Dokončeno
        Work --> Off : Krátký stisk (User)
        OTA --> Off2  : Krátký stisk (User)
        
        %% Interní akce v rámci pracovního cyklu
        state Work {
            [*] --> GPS : Získat polohu
            GPS --> Cache : Uložit data
            Cache --> Upload : Odeslat (GPRS)
        }

        Sleep --> Boot : Časovač / Probuzení
    }
```


## Detailní popis scénářů

### 1. Start a Servisní režim (OTA)
- **Start:** Po připojení napájení (`PIN_EN`) se provede inicializace.
- **Detekce módu:** Firmware okamžitě kontroluje stav tlačítka (`GPIO32`).
    - Pokud je tlačítko drženo **déle než 2 sekundy**, zařízení startuje Wi-Fi AP (SSID: `lotrTrackerOTA_...`).
    - Uživatel se může připojit a přes webové rozhraní nastavit APN, server nebo nahrát nový firmware.

### 2. Běžný provoz (Work Cycle)
Pokud není detekován servisní režim, zařízení vstupuje do smyčky:
1.  **GPS:** Zapne modul, čeká na fix (max 5 min), získá souřadnice.
2.  **Cache:** Data uloží do interní paměti (`LittleFS`).
3.  **GPRS:** Zapne modem, připojí se k síti.
4.  **Upload:**
    - Provede **Handshake** (ověření registrace).
    - Odesílá data v dávkách (max 15 záznamů).
    - Přijímá příkazy ze serveru (např. změna intervalu nebo příkaz k vypnutí).
5.  **Spánek:** Po dokončení přejde do `Deep Sleep` na nastavenou dobu (default 60s).

### 3. Vypnutí (Graceful Shutdown)
- Uživatel může kdykoliv za běhu krátce stisknout tlačítko.
- Zařízení dokončí kritické operace (zápis na disk), korektně odpojí síť a vypne se.
