# 9. Administrace

Tento dokument popisuje funkce dostupné v administrátorském rozhraní, které je určené výhradně pro správce systému (`root` uživatele).

- **Controller**: `controllers/administrationController.js`
- **Routy**: `routes/administration.web.js`, `routes/administration.api.js`
- **Pohled**: `views/administration.ejs`

## 9.1. Přístup do administrace

Přístup je striktně omezen pomocí autorizačního middlewaru `isRoot`.

- **Endpoint**: `GET /administration`
- **Logika**: Middleware `isRoot` ověří, zda je přihlášený uživatel skutečně uživatel s `username: 'root'`. Pokud ne, je mu odepřen přístup a je přesměrován na svou hlavní stránku (`/`) nebo na přihlašovací stránku (`/login`).

Poznámka: Webová administrace je dostupná přes `GET /administration` (renderuje `views/administration.ejs`). API pro administraci je přístupné pod prefixem `/api/admin` a vyžaduje session cookie (middleware `isAuthenticated`) a často také `isRoot`.
## 9.2. Zobrazení dat

Administrátorská stránka poskytuje přímý pohled do databáze a zobrazuje tři hlavní tabulky:

1.  **Users**: Seznam všech uživatelů v systému, včetně jejich ID, jména, e-mailu, stavu ověření, hashe hesla a počtu vlastněných zařízení.
2.  **Devices**: Seznam všech zařízení v systému, včetně jejich `deviceId`, jména, vlastníka a času poslední aktivity (`last_seen`).
3.  **Latest Locations**: Výpis posledních 50 zaznamenaných poloh (pagination podporována) napříč všemi zařízeními pro rychlý přehled o aktivitě systému.

Další detaily načítání dat (viz `controllers/administrationController.js`):
- `userSearch`, `deviceSearch`, `locationSearch`, `alertSearch` — query parametry pro filtrování.
- `userSortBy`, `deviceSortBy`, `locationSortBy`, `alertSortBy` a odpovídající `*SortOrder` parametry pro řazení (výchozí `created_at`/`DESC`, location `timestamp`).
- Locations paging: page parametr a `pageSize = 50` (offset = (page-1) * pageSize).
- Alerts paging: `alertsPage` a `alertsPageSize = 50`.
- `devices` rows include last known `Location` (limit 1, ordered by `timestamp DESC`) a vlastník `User.username`.
## 9.3. Správa uživatelů


- **Endpoint**: `POST /api/admin/delete-user/:userId`
- **Funkce**: Administrátor může smazat jakéhokoliv uživatele (kromě sebe sama). Pokud se root uživatel pokusí smazat sám sebe, akce je zablokována a uživatel je přesměrován zpět s flash chybou.
- **Chování a odpovědi:** Tento endpoint je navržen pro použití z administrátorského webu — po úspěchu provede `req.flash('success')` a redirect (`302`) na `/administration`. Při chybě se také vrací redirect s flash chybou.
- **Implementace:** Kontrolér volá `db.User.destroy({ where: { id: userId } })` a zapisuje logy. Poznámka: v tomto kódu není explicitní transaction — odstranění spoléhá na ORM/DB pravidla a případné cascade chování.

## 9.4. Správa zařízení


- **Endpoint**: `POST /api/admin/delete-device/:deviceId`
- **Funkce**: Administrátor může smazat jakékoliv zařízení v systému přímo, bez ohledu na to, kdo je jeho vlastníkem.
- **Chování:** Tento endpoint používá explicitní DB transaction (`db.sequelize.transaction()`). Postup:
	1. Najde zařízení podle numerického `id` (`db.Device.findOne({ where: { id: deviceId } })`).
	2. Pokud zařízení neexistuje: rollback transaction, `req.flash('error', 'Device not found.')` a redirect na `/administration`.
	3. Ručně smaže všechny `Location` záznamy (`Location.destroy({ where: { device_id: device.id } })`) a `Alert` záznamy (`Alert.destroy({ where: { device_id: device.id } })`) v rámci transaction.
	4. Smaže zařízení (`device.destroy({ transaction: t })`) a commit.
	5. Po úspěchu `req.flash('success', ...)` a redirect na `/administration`.

Poznámka: `:deviceId` zde odkazuje **na databázové `id`** (číselné), ne na HW `device_id` string používaný v zařízení API.

Tento postup bezpečně zaručuje, že související data jsou odstraněna i pokud DB nepodporuje kaskádové mazání pro všechny vztahy.

---

## 9.5. Ověření uživatele přes admin

- **Endpoint**: `POST /api/admin/verify-user/:userId`
- **Funkce**: Nastaví `is_verified = true` pro daného uživatele. Po úspěchu provede flash message a redirect na `/administration`.

---

## 9.6. Správa poplachů (alerts)

- **Endpointy**:
	- `DELETE /api/admin/alerts/:alertId` — API-style delete (vyžaduje session).
	- `POST /api/admin/delete-alert/:alertId` — form-friendly POST alternativní endpoint (vyžaduje `isRoot` pro admin POST variantu).
- **Autorizace a chování:**
	- `deleteAlert` kontroluje, zda alert existuje. Pokud ne, vrací `404` (JSON) nebo flash+redirect (web).
	- Root uživatel může smazat jakýkoliv alert. Ostatní uživatelé mohou smazat pouze své vlastní alerty (`alert.user_id === req.session.user.id`). V případě nedostatečných práv vrací `403` (JSON) nebo flash+redirect.
	- Po úspěchu vrací `200` a `{ success: true }` pro JSON požadavky, nebo flash success a redirect pro web.

---

## 9.7. Shrnutí zabezpečení a odpovědí

- Většina administrativních akcí je dostupná pouze pro přihlášené uživatele s účtem `root`. Webové endpointy používají `req.flash()` + redirecty; API volání (která přijmou `Accept: application/json`) vrací JSON statusy a chybové kódy.
- V některých případech (např. mazání alertu) existuje rozlišování mezi `DELETE` API a POST formulářovou variantou z důvodu starších prohlížečů/formů.

