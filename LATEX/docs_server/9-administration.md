# 9. Administrace

Tento dokument popisuje funkce dostupné v administrátorském rozhraní, které je určené výhradně pro správce systému (`root` uživatele).

- **Controller**: `controllers/administrationController.js`
- **Routy**: `routes/administration.web.js`, `routes/administration.api.js`
- **Pohled**: `views/administration.ejs`

## 9.1. Přístup do administrace

Přístup je striktně omezen pomocí autorizačního middlewaru `isRoot`.

- **Endpoint**: `GET /administration`
- **Logika**: Middleware `isRoot` ověří, zda je přihlášený uživatel skutečně uživatel s `username: 'root'`. Pokud ne, je mu odepřen přístup a je přesměrován na svou hlavní stránku (`/`) nebo na přihlašovací stránku (`/login`).

## 9.2. Zobrazení dat

Administrátorská stránka poskytuje přímý pohled do databáze a zobrazuje tři hlavní tabulky:

1.  **Users**: Seznam všech uživatelů v systému, včetně jejich ID, jména, e-mailu, stavu ověření, hashe hesla a počtu vlastněných zařízení.
2.  **Devices**: Seznam všech zařízení v systému, včetně jejich `deviceId`, jména, vlastníka a času poslední aktivity (`last_seen`).
3.  **Latest Locations**: Výpis posledních 50 zaznamenaných poloh napříč všemi zařízeními pro rychlý přehled o aktivitě systému.

## 9.3. Správa uživatelů

- **Endpoint**: `POST /api/admin/delete-user/:userId`
- **Funkce**: Administrátor může smazat jakéhokoliv uživatele (kromě sebe sama).
- **Proces**: Po potvrzení se zavolá `User.destroy()`. Díky kaskádovému mazání (`ON DELETE CASCADE`) jsou automaticky smazána i všechna zařízení, lokace a poplachy patřící tomuto uživateli.

## 9.4. Správa zařízení

- **Endpoint**: `POST /api/admin/delete-device/:deviceId`
- **Funkce**: Administrátor může smazat jakékoliv zařízení v systému přímo, bez ohledu na to, kdo je jeho vlastníkem.
- **Proces**: Podobně jako u mazání uživatele, tato akce smaže zařízení a všechna s ním související data (lokace, poplachy).
