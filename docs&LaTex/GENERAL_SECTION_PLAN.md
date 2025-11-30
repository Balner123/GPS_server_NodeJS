# Detailní plán struktury kapitol pro LaTeX dokumentaci

Tento dokument slouží jako roadmapa pro psaní kapitol 1–3. U každé sekce je definován obsah a **požadovaná grafika/screenshoty**.

---

## Kapitola 1: Fyzické zařízení "tracker" (Hardware)

### 1.1 Teoretická východiska a použité technologie
*   **Obsah:** Úvod do problematiky IoT, SoC ESP32 (výkon vs. spotřeba), principy GNSS/GPS (NMEA), mobilní sítě (LTE Cat-1, AT příkazy), RTOS (FreeRTOS úlohy), Power Latch obvod (teorie).
*   **Grafika:**
    *   *Volitelné:* Blokové schéma ESP32 (pokud bude místo).

### 1.2 Návrh hardware
*   **Obsah:** Zdůvodnění volby LilyGO T-Call (A7670) + NEO-6M. Popis elektrického zapojení (UART, GPIO pro Power Latch, ADC pro baterii). Řešení napájení (LiPo baterie, nabíjení).
*   **Grafika:**
    *   **[IMG_HW_1] Blokové schéma zapojení:** (`docs_hw/schemas/schema_GENERAL.png` nebo `schema_POWER_modul.png`). Ukazuje propojení MCU, Modemu, GPS a Baterie.
    *   **[IMG_HW_2] Fotografie zařízení:** (`docs_hw/schemas/foto_progres#ACTUAL.jpg`). Reálná podoba trackeru (v krabičce nebo "střeva").

### 1.3 Implementace firmware
*   **Obsah:** Architektura kódu (rozdělení na moduly `gps`, `modem`, `fs`). Pracovní cyklus (Wake -> Measure -> Send -> Sleep). Využití LittleFS pro cache. Stavový automat.
*   **Grafika:**
    *   **[IMG_HW_3] Diagram životního cyklu:** (`docs_hw/schemas/life_cycle_states_dia.md` -> převést na obrázek). Stavový diagram ukazující přechody mezi Sleep, Wake, Error stavy.

### 1.4 Komunikace a data
*   **Obsah:** Popis JSON payloadu (ukázka kódu). HTTPS (SSL) zabezpečení. Handshake protokol (synchronizace configu).
*   **Grafika:**
    *   **[IMG_HW_4] Sekvenční diagram komunikace:** (`docs_server/schemas/sequence_dia_registration_hw.md` nebo podobný). Ukázka toku dat Tracker -> Server -> Tracker.

### 1.5 Konfigurace a servisní režim
*   **Obsah:** OTA režim (AP + Webserver). Postup konfigurace (připojení k AP, zadání APN).

---

## Kapitola 2: Serverová část (Backend)

### 2.1 Úvod a koncepce systému
*   **Obsah:** Role serveru (centrála). Monolitická architektura. MVC vzor.

### 2.2 Použité technologie
*   **Obsah:** Node.js + Express (event loop). MySQL + Sequelize (ORM výhody). Passport.js (OAuth).
*   **Grafika:**
    *   *Volitelné:* Schéma technologického stacku (Node.js loga atd. - spíše ne).

### 2.3 Návrh a architektura backendu
*   **Obsah:** Databázové schéma (User, Device, Location, Alert). API struktura (Endpointy). Security (Rate limit, Sanitizace).
*   **Grafika:**
    *   **[IMG_SRV_1] ER Diagram databáze:** (`docs_server/db_diagrams/Untitled Diagram...pdf` -> převést na PNG). Vztahy mezi tabulkami.
    *   **[IMG_SRV_2] Use Case Diagram serveru:** (`docs_server/schemas/use_case_diagram.md` -> převést na obrázek). Role uživatele vs. administrátora.

### 2.4 Implementace klíčových funkcí
*   **Obsah:** Příjem dat (Batch processing, transakce). Algoritmy: Geofencing (Ray Casting), Clustering (Haversine).
*   **Grafika:**
    *   **[IMG_SRV_3] Vizualizace Clusteringu:** (Screenshot z mapy nebo schéma principu shlukování bodů).
    *   **[IMG_SRV_4] Sekvenční diagram Trackingu:** (`docs_server/schemas/sequence_diagram_tracking.md` -> převést na obrázek). Tok dat od příjmu po uložení.

### 2.5 Prezentační vrstva (Frontend)
*   **Obsah:** EJS šablony. Leaflet mapa. Chart.js grafy.

---

## Kapitola 3: Aplikace pro Android (Klient)

### 3.1 Koncept a cíle aplikace
*   **Obsah:** Náhrada HW trackeru. Offline-first přístup. Spolehlivost na pozadí.
*   **Grafika:**
    *   **[IMG_APK_1] Use Case Diagram aplikace:** (`docs_apk/schemas/use_case_diagram.md` -> převést na obrázek). Co uživatel s aplikací dělá.

### 3.2 Použité technologie a platforma
*   **Obsah:** Kotlin, Coroutines, Room, WorkManager, EncryptedSharedPreferences.

### 3.3 Architektura aplikace
*   **Obsah:** Vrstvená architektura (UI, Domain, Data). Repository pattern. Vlastní ApiClient.
*   **Grafika:**
    *   **[IMG_APK_2] Data Flow Diagram:** (`docs_apk/schemas/data_flow.md` -> převést na obrázek). Tok dat senzory -> DB -> Server.

### 3.4 Implementace klíčových funkcí
*   **Obsah:** Foreground Service (notifikace). PowerController (stavový automat ON/OFF). SyncWorker (dávky). Handshake.
*   **Grafika:**
    *   **[IMG_APK_3] Stavový diagram (State Diagram):** (`docs_apk/schemas/state_diagram.md` -> převést na obrázek). Stavy aplikace (Tracking, Syncing, Idle, PendingOff).

### 3.5 Uživatelské rozhraní
*   **Obsah:** Popis obrazovek (Dashboard, Login, Console). UX (jednoduchost).
*   **Grafika:**
    *   **[IMG_APK_4] Screenshot - Login:** Snímek obrazovky přihlášení.
    *   **[IMG_APK_5] Screenshot - Dashboard (Active):** Snímek hlavní obrazovky při aktivním sledování.
    *   **[IMG_APK_6] Screenshot - Dashboard (Server Instruction):** Snímek s bannerem "Čekám na potvrzení vypnutí".

---

## Seznam úkolů pro grafiku
1.  **Konverze diagramů:** Mermaid/MD soubory (`.md`) převést na PNG/PDF obrázky.
2.  **Pořízení screenshotů:** Vytvořit screenshoty aplikace a webového rozhraní serveru.
3.  **Umístění:** Nahrát vše do složky `FINAL_latex/image/` a pojmenovat konzistentně (např. `hw_schema_zapojeni.png`, `apk_dashboard.png`).
