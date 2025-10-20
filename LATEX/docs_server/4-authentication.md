# 4. Autentizace a Autorizace

Tento dokument popisuje všechny aspekty přihlašování, registrace a správy oprávnění v systému.

## 4.1. Správa Session

Aplikace využívá `express-session` pro správu uživatelských sessions. Po úspěšném přihlášení se do session uloží objekt `user` a flag `isAuthenticated`.

- **Konfigurace**: `server.js`
- **Secret**: Klíč pro podepisování session cookie je načítán z proměnné prostředí `SESSION_SECRET`.
- **Cookie**: Session cookie má nastaven `httpOnly: true` pro ochranu proti XSS útokům a `maxAge` na 6 hodin.

## 4.2. Lokální autentizace (Jméno a Heslo)

Logika je obsažena v `controllers/authController.js`.

### Registrace

1.  **Endpoint**: `POST /api/auth/register`
2.  Uživatel zadá jméno, e-mail a heslo.
3.  **Validace hesla**: Standardně je vyžadováno silné heslo (délka, velká písmena, čísla, speciální znaky). Lze povolit slabé heslo (min. 3 znaky) pomocí parametru `use_weak_password`.
4.  **Hashování**: Heslo se hashuje pomocí `bcrypt.hash()` se `salt(10)`.
5.  **Vytvoření uživatele**: Vytvoří se nový záznam v tabulce `users` s `is_verified: false`.
6.  **Ověření e-mailu**: Vygeneruje se 4místný kód, uloží se do databáze s expirací 10 minut a odešle se na e-mail uživatele.
7.  Uživatel je přesměrován na stránku pro ověření kódu (`/verify-email`).

### Přihlášení

1.  **Endpoint**: `POST /api/auth/login`
2.  Uživatel zadá jméno nebo e-mail a heslo.
3.  **Ověření hesla**: `bcrypt.compare()` porovná zadané heslo s hashem v databázi.
4.  **Kontrola ověření**: Pokud je heslo správné, systém zkontroluje, zda je účet ověřen (`is_verified: true`).
    - **Pokud není ověřen**: Vygeneruje a odešle se nový ověřovací kód a uživatel je přesměrován na `/verify-email`.
    - **Pokud je ověřen**: Do session se uloží potřebná data a uživatel je přesměrován na hlavní stránku (`/`) nebo do administrace (`/administration` v případě uživatele `root`).

### Ověření e-mailu

1.  **Endpoint**: `POST /verify-email`
2.  Systém porovná zadaný kód s kódem v databázi a kontroluje jeho platnost.
3.  Při úspěchu nastaví `is_verified: true` a přihlásí uživatele.

## 4.3. OAuth 2.0 (Google & GitHub)

Systém využívá knihovnu `Passport.js` a její strategie pro Google (`passport-google-oauth20`) a GitHub (`passport-github2`).

- **Konfigurace**: `config/passport.js`
- **Routy**: `routes/auth.oauth.js`

### Průběh přihlášení

1.  Uživatel klikne na tlačítko "Přihlásit přes Google/GitHub" (`GET /auth/google` nebo `GET /auth/github`).
2.  Je přesměrován na autorizační stránku poskytovatele.
3.  Po úspěšné autorizaci je přesměrován zpět na `callback` URL (`/auth/google/callback` nebo `/auth/github/callback`).
4.  **Zpracování profilu** (logika v `config/passport.js`):
    a. **Nalezení uživatele**: Systém se pokusí najít uživatele podle `provider` a `provider_id`.
    b. **Propojení účtů**: Pokud uživatel nenalezen, systém se pokusí najít existující lokální účet podle e-mailu vráceného od poskytovatele. Pokud je nalezen, účty se propojí (do záznamu se doplní `provider` a `provider_id`).
    c. **Vytvoření nového uživatele**: Pokud uživatel stále neexistuje, vytvoří se nový záznam v databázi. Pro Google je vyžadován ověřený e-mail.
5.  Uživatel je přihlášen a přesměrován na hlavní stránku.

## 4.4. Autorizace (Uživatelské role)

Autorizace je řízena pomocí specializovaného middlewaru v `middleware/authorization.js`.

- **`isAuthenticated`**: Základní ochrana. Povolí přístup jakémukoliv přihlášenému uživateli (včetně `root`). Používá se pro obecné stránky jako `/settings` nebo `/devices`.

- **`isUser`**: Povolí přístup pouze přihlášeným uživatelům, kteří **nejsou** `root`. Používá se pro hlavní stránku s mapou (`/`), aby se zajistilo, že `root` bude vždy přesměrován do své administrace.

- **`isRoot`**: Nejpřísnější ochrana. Povolí přístup pouze uživateli s `username: 'root'`. Používá se pro ochranu administrátorského rozhraní (`/administration`).
