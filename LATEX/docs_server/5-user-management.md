# 5. Správa uživatelského účtu

Tento dokument popisuje, jak mohou přihlášení uživatelé spravovat svůj vlastní účet prostřednictvím stránky "Settings" (`/settings`).

- **Controller**: `controllers/settingsController.js`
- **Routy**: `routes/settings.web.js`, `routes/settings.api.js`
- **Pohled**: `views/settings.ejs`

## 5.1. Změna uživatelského jména

- **Endpoint**: `POST /api/settings/username`
- **Logika**: Uživatel může změnit své jméno, pokud nové jméno již neexistuje v databázi. Po úspěšné změně se aktualizuje i jméno v aktivní session.

## 5.2. Změna hesla

- **Endpoint**: `POST /api/settings/password`
- **Dostupnost**: Pouze pro lokální účty (`provider: 'local'`).
- **Logika**:
  1. Uživatel musí zadat své staré heslo, nové heslo a potvrzení nového hesla.
  2. Staré heslo se ověří proti databázi pomocí `bcrypt.compare()`.
  3. Nové heslo podléhá stejným pravidlům validace jako při registraci (lze použít i volbu slabého hesla).
  4. Pokud jsou všechny podmínky splněny, nové heslo se hashuje a uloží do databáze.

## 5.3. Změna e-mailu

- **Endpoint**: `POST /api/settings/email`
- **Dostupnost**: Pouze pro lokální účty.
- **Logika**:
  1. Uživatel zadá nový e-mail.
  2. Systém ověří, že nový e-mail již není používán jiným účtem.
  3. Do sloupce `pending_email` v tabulce `users` se uloží nový e-mail.
  4. Vygeneruje se ověřovací kód, který se odešle na **novou** e-mailovou adresu.
  5. Uživatel je přesměrován na stránku `/verify-email`, kde musí zadat kód.
  6. Po úspěšném ověření se e-mail v databázi finálně změní a `pending_email` se vymaže.

## 5.4. Odpojení účtu třetí strany

- **Endpoint**: `POST /api/settings/disconnect`
- **Dostupnost**: Pouze pro účty přihlášené přes OAuth (`provider: 'google'` nebo `'github'`).
- **Logika**: Tato funkce převede účet třetí strany na lokální účet.
  1. Uživatel musí zadat a potvrdit nové heslo pro svůj účet.
  2. Po úspěšné validaci hesla se v databázi nastaví `provider: 'local'`, vymažou se `provider_id` a `provider_data` a uloží se hash nového hesla.
  3. Uživatel je automaticky odhlášen a přesměrován na přihlašovací stránku s výzvou, aby se přihlásil novým heslem.

## 5.5. Smazání účtu

- **Endpoint**: `POST /api/settings/delete-account`
- **Logika**: Jedná se o nevratnou operaci.
  1. Uživatel potvrdí smazání v uživatelském rozhraní.
  2. Po odeslání požadavku se zavolá `User.destroy()`.
  3. Díky nastavení `ON DELETE CASCADE` v databázi se automaticky smažou i všechna zařízení, historie poloh a poplachy patřící tomuto uživateli.
  4. Session uživatele je zničena a je přesměrován na přihlašovací stránku.
