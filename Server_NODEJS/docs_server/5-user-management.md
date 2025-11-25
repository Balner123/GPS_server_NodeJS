# 5. Správa uživatelského účtu

Tento dokument popisuje, jak mohou přihlášení uživatelé spravovat svůj vlastní účet prostřednictvím stránky "Settings" (`/settings`).

- **Controller**: `controllers/settingsController.js`
- **Routy**: `routes/settings.web.js`, `routes/settings.api.js`
- **Pohled**: `views/settings.ejs`

## 5.1. Změna uživatelského jména

- **Endpoint**: `POST /api/settings/username`
- **Tělo požadavku**: `{ username: string }`
- **Logika**: Uživatel může změnit své jméno, pokud nové jméno již neexistuje v databázi. Po úspěšné změně se aktualizuje i jméno v aktivní session.

## 5.2. Změna hesla

- **Endpoint**: `POST /api/settings/password`
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

## 5.5. Nastavení prvního hesla (pro OAuth účty)

- **Stránka**: `GET /set-password`
- **Endpoints**:
  - `POST /api/settings/set-password` (v rámci stránky `/settings`)
  - `POST /api/auth/set-initial-password` (varianta používaná middlewarem výzvy)
- **Dostupnost**: Pouze pokud je uživatel přihlášen přes poskytovatele a nemá dosud lokální heslo.
- **Validace**: Stejná jako při registraci (lze volitelně povolit `use_weak_password`).
- **Tělo požadavku**: `{ newPassword, confirmPassword, use_weak_password? }`
- **Chování**: Po úspěchu zůstává uživatel přihlášen a může používat chráněné části systému.

## 5.6. Smazání účtu

- **Spuštění procesu**: `POST /api/settings/delete-account`
- **Potvrzení**: `GET /settings/confirm-delete` a `POST /api/settings/confirm-delete` s ověřovacím kódem zaslaným e‑mailem.
- **Další akce**: `POST /api/settings/resend-deletion-code` (znovu poslat kód), `POST /api/settings/cancel-delete` (zrušit proces).
- **Logika**:
  1. Odesláním požadavku se vygeneruje `deletion_code` s expirací a odešle se e‑mailem.
  2. Uživatel zadá kód na stránce potvrzení. Při shodě kódu a platné expiraci dojde ke smazání.
  3. Před smazáním uživatele jsou ručně smazána jeho zařízení a kaskádově i související data (lokace, poplachy).
  4. Session uživatele je zrušena, cookie smazána, přesměrování na `/login`.

## 5.7. Doplňující poznámky

- **Web vs API:** Webové (HTML) routy typicky používají redirecty a `connect-flash` pro chybové/úspěšné hlášky, zatímco API routy pod `/api` vrací JSON s odpovídajícími HTTP statusy.
- **Opětovné odeslání verifikačního kódu:** Endpoint pro opětovné odeslání je `POST /api/auth/resend-verification-code`. Webová varianta redirectuje uživatele na `/verify-email` s flash hláškou.
- **APK klient:** Pro APK klienta existují speciální endpointy:
  - `POST /api/apk/login` (vrací `{ success, device_is_registered }`)
  - `POST /api/apk/logout`
  - `POST /api/apk/register-device` (chráněno middlewarem `isApiAuthenticated`)
- **Nastavení prvního hesla:** Endpoint `POST /api/auth/set-initial-password` slouží pro nastavení prvního (lokálního) hesla u účtů vytvořených přes OAuth. UI varianta používá `POST /api/settings/set-password`.
- **Logout:** Logout (web i API) zničí session a smaže cookie `connect.sid`.

