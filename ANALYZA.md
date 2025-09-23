# Analýza projektu GPS Tracker

Tento dokument slouží k systematické analýze projektu, identifikaci problémů a návrhu dalších kroků.

---

## 1. Analýza hlavního `README.md` (23. 9. 2025)

### A. Shrnutí obsahu
- **Název:** LOTR (Location Tracker)
- **Architektura:** Skládá se ze 4 hlavních komponent: Hardware, Server (Node.js), Webové rozhraní a Android aplikace.
- **Klíčové funkce:** HW podporuje dávkové odesílání a cachování. Server a web umožňují správu a geofencing.
- **Dokumentace:** Roztříštěná mezi několik souborů (`README.md`, `PLANY.txt`, PDF) a externí nástroj Obsidian.

### B. První postřehy
- **Vysoká komplexnost:** Kombinace vývoje firmwaru, backendu, frontendu a mobilní aplikace je velmi náročná.
- **Nejasný stav:** Z dokumentace není jasné, které části jsou plně funkční a integrované.

---

## 2. Analýza `Server_NODEJS/readme_server.md` (23. 9. 2025)

### A. Závěr k serverové části
Serverová část je **robustní, dobře navržená a skvěle zdokumentovaná** (MVC architektura, detailní popis API, `mermaid` diagramy). Je to nejstabilnější komponenta projektu.

### B. Drobné nedostatky a doporučení
1.  **Konfigurace e-mailu:** Přihlašovací údaje v `utils/emailSender.js` přesunout do `.env`.
2.  **Chybějící `.env.example`:** Vytvořit vzorový konfigurační soubor.
3.  **Verze Node.js:** Specifikovat verzi v `package.json` (sekce `engines`).

---

## 3. Analýza `LilyGO-T-A76XX-main/README.md` (23. 9. 2025)

### A. Závěr k README hardwaru
Dokumentace popisuje **sofistikovaný systém** pro firmware, včetně OTA (Over-the-Air) servisního režimu, kde si zařízení vytváří vlastní Wi-Fi síť a webový portál pro bezpečnou registraci k uživatelskému účtu.

---

## 4. Analýza kódu `gps_tracker.ino` (23. 9. 2025)

### A. Závěr k firmwaru
Firmware je **velmi propracovaný a funkčně bohatý**. Kód potvrzuje plnou implementaci klíčových funkcí:
- **OTA Registrace:** Implementováno. Používá endpoint `POST /api/hw/register-device`.
- **Dávkové odesílání a cachování:** Implementováno. Používá endpoint `POST /api/devices/input`.
- **Vzdálená konfigurace:** Implementováno. Server může měnit `sleep_interval` zařízení.

---

## 5. Odhalení nesouladu v dokumentaci (23. 9. 2025)

### A. Nález
- Prohledáním kódu serveru byl v `Server_NODEJS/routes/hw.api.js` nalezen endpoint `POST /api/hw/register-device`.
- Tento endpoint je v kódu skvěle zdokumentován pomocí Swagger komentářů.

### B. Příčina problému
- Klíčový endpoint `/api/hw/register-device`, který používá hardware, **není zmíněn v hlavní dokumentaci serveru** (`readme_server.md`).
- Vývojář přidal novou funkci a zdokumentoval ji v kódu (Swagger), ale zapomněl aktualizovat manuální `README` soubor.

---

## 6. Analýza `apk/readme_androidstudio_implementation.md` (23. 9. 2025)

### A. Shrnutí obsahu
- **Účel dokumentu:** Detailní **technický návod pro vývojáře**, jak z existujících zdrojových souborů ručně sestavit funkční projekt v novém Android Studiu.

### B. Interpretace a stav aplikace
- **Existence kódu:** Aplikace existuje na úrovni zdrojových kódů, ale **není uložena jako plnohodnotný, samostatný projekt**.
- **Důsledek:** Tento stav výrazně komplikuje další vývoj. Prvním krokem pro práci na aplikaci by bylo vytvoření kompletního projektu dle návodu.

---

## 7. Analýza zdrojových kódů Android aplikace (`.kt`) (23. 9. 2025)

### A. Zjištěná funkčnost
- **Architektura:** Aplikace funguje jako **softwarová verze hardwarového trackeru**. Používá `LocationService` pro sběr dat na pozadí a `Room` databázi pro jejich cachování. `SyncWorker` se stará o spolehlivé odesílání dat na server.
- **Komunikace se serverem:** `SyncWorker` odesílá data na `POST /api/devices/input`, stejně jako hardware. Pro autentizaci používá `session_cookie`.
- **Vzdálená konfigurace:** Aplikace, stejně jako firmware, umí ze serveru přijmout a aplikovat nové nastavení pro intervaly sběru a odesílání dat.

### B. Identifikované nedostatky
1.  **Zastaralá síťová vrstva:** Kód používá přímo `java.net.HttpURLConnection` místo moderních knihoven jako Retrofit/OkHttp, což komplikuje kód a ošetřování chyb.
2.  **Chybějící logika:** V analyzovaných souborech chybí kód pro přihlášení uživatele a získání `session_cookie`, bez kterého je synchronizace nefunkční. Tato logika se musí nacházet v neanalyzovaných souborech (`LoginActivity.kt`).

---

## ZÁVĚREČNÉ SHRNUTÍ A DOPORUČENÍ

Analýza je dokončena. Následuje celkové zhodnocení a návrh konkrétních kroků pro další postup.

---

## 8. Analýza `PLANY.txt` (23. 9. 2025)

### A. Shrnutí obsahu
- Soubor obsahuje seznam plánovaných funkcí a nápadů pro jednotlivé komponenty projektu (APK, Server, Hardware).
- Formátování je poškozené (problém s kódováním), ale obsah je srozumitelný.

### B. Klíčové zjištění
- **Dokument je zastaralý, ale velmi cenný.** Odhaluje, že mnoho z klíčových a technicky náročných "plánovaných" funkcí již **bylo úspěšně implementováno**.
- **Příklady implementovaných plánů:**
    - **Hardware & Aplikace:** Cachování dat při ztrátě spojení a jejich hromadné odeslání.
    - **Hardware:** Automatická registrace zařízení k účtu bez nutnosti manuálního zadávání ID.
    - **Server:** Schopnost přijímat dávky (pole) polohových dat.

### C. Závěr
- Analýza tohoto souboru potvrzuje, že technické jádro systému (firmware, backend) je z velké části hotové. Projekt se pravděpodobně zastavil před implementací pokročilejších funkcí (geofencing) a dokončením uživatelských rozhraní (web, grafika aplikace).
