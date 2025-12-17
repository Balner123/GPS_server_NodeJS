## Knihovny
*   **TinyGSM:** Hlavní knihovna pro komunikaci s GSM modemem (A7670). Zajišťuje GPRS připojení a TCP/IP stack.
*   **TinyGPSPlus:** Parsování NMEA vět z GPS modulu. Poskytuje pohodlné rozhraní pro získání souřadnic, času a metadat.
*   **ArduinoJson:** Serializace a deserializace dat. Používá se pro formátování dat odesílaných na server (JSON payload) a pro práci s konfiguračními soubory.
*   **Preferences:** Ukládání trvalé konfigurace do NVS (Non-Volatile Storage). Používá se pro uchování počtu bootů, stavu a nastavení, která musí přežít restart.
*   **WebServer & Update:** Použity v OTA režimu pro vytvoření konfiguračního portálu a nahrávání nového firmware přes WiFi.
*   **LittleFS:** Souborový systém pro SPI Flash paměť. Slouží k ukládání offline cache dat z GPS, pokud není dostupné GSM připojení.
*   **FreeRTOS:** Knihovna pro implementaci přerušovacího systemu (GPIO přerušování | ISR)

*   **Deep Sleep:** Hlavní stav zařízení. CPU je vypnuto, běží pouze ULP (Ultra Low Power) koprocesor nebo RTC časovač.
*   **Wakeup Sources:** Probuzení je řízeno časovačem (pravidelný interval odesílání) nebo externím přerušením (tlačítko).

### Multitasking a FreeRTOS
Ačkoliv je kód psán v Arduino stylu, využívá prvky RTOS pro asynchronní události:
*   **Tasks:** Použití FreeRTOS tasků (např. `ShutdownTask`) pro operace, které nesmí blokovat hlavní smyčku nebo vyžadují paralelní běh (např. dlouhý stisk tlačítka).
*   **ISR (Interrupt Service Routines):** Obsluha hardwarových přerušení, zejména pro tlačítko (`on_button_isr`).