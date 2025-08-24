# Plán: Sjednocení registrace HW zařízení

Tento dokument popisuje kroky potřebné k úpravě serveru a firmwaru pro `gps_tracker.ino`, aby bylo možné hardwarové zařízení registrovat přímo pomocí uživatelských přihlašovacích údajů, podobně jako mobilní aplikace.

---

## Část 1: Úpravy na straně serveru (Node.js)

Cílem je vytvořit nový, bezpečný API endpoint, který zvládne ověření uživatele a registraci zařízení v jednom kroku.

### 1. Vytvoření nového API endpointu

- **Metoda:** `POST`
- **URL:** `/api/devices/register-by-hardware`
- **Umístění:** Doporučeno vytvořit nový soubor `routes/api.js` nebo přidat do `routes/devices.js`.
- **Očekávaný vstup:** JSON objekt v těle požadavku.
  ```json
  {
    "deviceId": "unikátní_id_zařízení_z_mcu",
    "username": "uzivatelske_jmeno",
    "password": "uzivatelske_heslo"
  }
  ```

### 2. Implementace logiky v controlleru

Vytvoří se nová asynchronní funkce v `controllers/deviceController.js`, například `registerDeviceFromHardware`.

- **Krok 1: Ověření uživatele.**
  - Funkce převezme `username` a `password` z požadavku.
  - Zavolá interní logiku pro ověření hesla (podobně jako stávající `login` funkce), aby se zkontrolovala jejich platnost v databázi.
  - Pokud ověření selže, vrátí chybu `401 Unauthorized`.

- **Krok 2: Registrace zařízení.**
  - Pokud je uživatel úspěšně ověřen, získá se jeho `userId`.
  - Převezme se `deviceId` z požadavku.
  - Zkontroluje se, zda zařízení s tímto `deviceId` již neexistuje. Pokud ano, vrátí chybu `409 Conflict`.
  - Vytvoří se nový záznam v databázi `devices` a spáruje se `deviceId` s ověřeným `userId`.

- **Krok 3: Odpověď.**
  - V případě úspěšné registrace vrátí stavový kód `200 OK`.
  - V případě chyby vrátí odpovídající chybový kód a zprávu.

---

## Část 2: Úpravy firmwaru (gps_tracker.ino)

Cílem je upravit konfigurační režim zařízení tak, aby umožnil zadání přihlašovacích údajů a provedl registraci na serveru.

### 1. Rozšíření permanentní paměti (EEPROM)

- Do EEPROM se přidá nový příznak (flag) na vyhrazenou adresu, např. `is_registered` (1 byte).
- Tento příznak bude indikovat, zda zařízení úspěšně prošlo registrací. `0` = neregistrováno, `1` = registrováno.

### 2. Úprava konfiguračního webového serveru

- **HTML formulář:** Stránka, kterou zařízení servíruje v režimu nastavení, se rozšíří o dvě nová textová pole: "Uživatelské jméno" a "Heslo".
- **Obsluha formuláře:**
  - Vytvoří se nová obslužná funkce `handleRegister`.
  - Tato funkce se aktivuje po odeslání formuláře.
  - Načte všechny hodnoty: nastavení sítě (IP serveru, atd.) a přihlašovací údaje (jméno, heslo).
  - Zavolá novou funkci `performRegistration()` (viz níže).
  - Podle výsledku zobrazí uživateli ve webovém prohlížeči zprávu o úspěchu nebo neúspěchu.
  - V případě úspěchu zapíše do EEPROM `is_registered = 1` a restartuje zařízení.

### 3. Implementace registrační logiky

- Vytvoří se nová funkce `bool performRegistration(username, password)`.
- **Krok 1: Sestavení JSON zprávy.** Vytvoří JSON objekt s `deviceId` (získaným z MAC adresy), `username` a `password`.
- **Krok 2: Odeslání požadavku.** Pomocí knihovny `HTTPClient` odešle `POST` požadavek s tímto JSONem na nový serverový endpoint `/api/devices/register-by-hardware`.
- **Krok 3: Zpracování odpovědi.** Zkontroluje stavový kód odpovědi od serveru. Pokud je `200 OK`, funkce vrátí `true`. V opačném případě vrátí `false`.

### 4. Úprava hlavní smyčky (`loop()`)

- Na začátku každého cyklu `loop()` se zkontroluje příznak `is_registered` z EEPROM.
- **Pokud je zařízení neregistrované (`is_registered == 0`):**
  - Smyčka neprovede nic z původní logiky (nesbírá GPS, neposílá data).
  - Může signalizovat stav čekání na registraci (např. pomalým blikáním LED).
  - `return;`
- **Pokud je zařízení registrované (`is_registered == 1`):**
  - Smyčka pokračuje normálně, jak fungovala doposud – sbírá data a odesílá je na server.
