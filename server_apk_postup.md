# Plán Úprav Serveru pro Podporu Robustní Registrace APK

Tento dokument popisuje nezbytné změny na straně serveru (Node.js), aby podporoval nový, flexibilní registrační mechanismus pro Android aplikaci.

## 1. Cíl

- Podporovat identifikaci zařízení pomocí unikátního ID instalace (UUID) místo `ANDROID_ID`.
- Poskytnout aplikaci informaci, zda je její instance již registrována pro daného uživatele.
- Umožnit bezpečné odhlášení invalidací session.

## 2. Změny v API Endpointech

### Krok 1: Úprava `POST /api/apk/login`

Toto je klíčová změna pro inteligentní registraci na straně klienta.

- **Požadavek:** Endpoint musí nově v těle požadavku (`body`) přijímat kromě `identifier` a `password` i `installationId`.
  ```json
  {
    "identifier": "uzivatel@email.com",
    "password": "heslo",
    "installationId": "abc-123-def-456"
  }
  ```
- **Logika Controlleru (`authController.js`):**
  1. **Ověření uživatele:** Provést stávající logiku pro ověření jména a hesla. Pokud selže, vrátit chybu 401.
  2. **Vytvoření session:** Pokud je uživatel ověřen, vytvořit novou session a získat session ID.
  3. **Kontrola registrace zařízení:** Po úspěšném ověření provést databázový dotaz.
     - Získat `userId` přihlášeného uživatele.
     - Zkontrolovat v databázi (např. v tabulce `devices`), zda existuje záznam, kde se shoduje `user_id` **A ZÁROVEŇ** `installation_id`.
     - `SELECT COUNT(*) FROM devices WHERE user_id = ? AND installation_id = ?`
  4. **Sestavení odpovědi:** Vrátit odpověď 200 OK s novým JSON tělem:
     ```json
     {
       "success": true,
       "device_is_registered": true // nebo false, podle výsledku dotazu
     }
     ```
     - Session cookie bude automaticky přidána do hlavičky odpovědi mechanismem `express-session`.

### Krok 2: Úprava `POST /api/apk/register-device`

- **Požadavek:** Endpoint bude v těle požadavku přijímat `installationId` a `deviceName`.
- **Logika Controlleru (`deviceController.js`):**
  1. **Autorizace:** Zkontrolovat, zda má požadavek platnou session (uživatel musí být přihlášen).
  2. **Získání `userId`:** Získat `userId` z objektu session.
  3. **Vložení do databáze:** Vložit nový záznam do tabulky `devices` s `userId`, `installationId` a `deviceName`.
  4. Logika pro kontrolu duplicit může zůstat, ale nyní bude kontrolovat unikátnost `installation_id` pro daného `user_id`.

### Krok 3: (Doporučeno) Nový Endpoint `POST /api/apk/logout`

- **Cíl:** Poskytnout bezpečný způsob, jak ukončit session.
- **Routa:** `routes/auth.js`
- **Controller:** `authController.js`
- **Logika:**
  1. Endpoint musí být chráněn – vyžaduje platnou session.
  2. Po zavolání provede `req.session.destroy()`, což odstraní session ze serverového úložiště.
  3. Vrátí odpověď 200 OK s potvrzením, např. `{"success": true, "message": "Odhlášení úspěšné"}`.

## 3. Databázové Změny

- **Tabulka `devices`:**
  - Zkontrolovat, zda sloupec pro ID zařízení (dříve možná `device_id` nebo `android_id`) je vhodný pro uložení UUID. Ideální datový typ je `VARCHAR(36)` nebo `CHAR(36)`.
  - Pro srozumitelnost je doporučeno přejmenovat tento sloupec na `installation_id`.
