# Analýza Funkčnosti Firmwaru (gps_tracker.ino)

Tento dokument popisuje detailní funkční analýzu firmwaru `gps_tracker.ino` pro zařízení LilyGO T-A76XX.

## Hlavní princip: Cyklus Hlubokého Spánku

Klíčovým rysem firmwaru je design zaměřený na maximální úsporu energie. Zařízení neběží v nepřetržité smyčce (`loop()`), ale funguje v cyklech probuzení a spánku.

- **Funkce `loop()` je prázdná a nikdy se nevykoná.**
- Veškerá logika se odehrává ve funkci `setup()`, která se spustí pokaždé, když se zařízení probudí z hlubokého spánku.

## Provozní Režimy

Zařízení má dva vzájemně se vylučující režimy, které jsou určeny stavem jednoho hardwarového přepínače při startu.

### 1. Režim GPS Tracker (Výchozí)

Toto je standardní provozní režim, pokud není aktivován OTA režim.

**Pracovní cyklus:**
1.  **Probuzení:** Zařízení se probudí z hlubokého spánku (nebo je čerstvě zapnuto).
2.  **Zapnutí GPS:** Aktivuje napájení pro externí GPS modul.
3.  **Získání polohy:** Pokouší se získat platný GPS fix. Tento proces má časový limit (timeout) 5 minut.
4.  **Vypnutí GPS:** Okamžitě po pokusu o fix (úspěšném i neúspěšném) vypne GPS modul, aby se šetřila energie.
5.  **Zapnutí Modemu:** Aktivuje a inicializuje mobilní modem A7670E.
6.  **Připojení k síti:** Připojí se k mobilní síti GPRS.
7.  **Odeslání dat:** Pokud je připojení úspěšné, sestaví JSON zprávu s poslední známou polohou (nebo chybovou hláškou, pokud nebyl fix) a odešle ji na server pomocí HTTP POST.
8.  **Odpojení a vypnutí Modemu:** Odpojí se od GPRS a zcela vypne modem.
9.  **Hluboký spánek:** Zařízení se uloží do režimu hlubokého spánku na předem definovaný interval (např. 60 sekund). Po uplynutí intervalu se cyklus opakuje od bodu 1.

### 2. Režim OTA (Over-the-Air) Aktualizace

Tento režim slouží výhradně k nahrání nové verze firmwaru do zařízení.

- **Aktivace:** Režim se aktivuje, pokud je při startu zařízení **GPIO pin 23** (`otaPin`) spojen s 3.3V (logická úroveň HIGH). Toto je funkce přepínače označovaného jako `OVA`.
- **Funkčnost:**
  - Zařízení vytvoří Wi-Fi Access Point (AP) s názvem `GPS_Tracker_OTA`.
  - Spustí webový server na adrese `192.168.4.1`.
  - Na serveru běží jednoduchá webová stránka s formulářem pro nahrání souboru.
  - Uživatel se může připojit k této Wi-Fi, otevřít stránku v prohlížeči a nahrát nový firmware (`.bin` soubor).
  - V tomto režimu zařízení zůstává aktivní a neusíná, dokud není manuálně restartováno.

## Přepínače ON/OFF

V analyzovaném kódu **neexistuje žádná logika pro čtení stavu `ON` nebo `OFF` přepínačů**. Tyto termíny se pravděpodobně vztahují k hlavnímu fyzickému vypínači napájení celého zařízení, který je mimo kontrolu samotného firmwaru. Provozní stav (krátce aktivní / hluboký spánek) je řízen interně časovačem probuzení.
