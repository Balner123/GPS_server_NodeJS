# 9. Administrace

Tento dokument popisuje funkce dostupné v administrátorském rozhraní, které je určené výhradně pro správce systému (`root` uživatele).

- **Controller**: `controllers/administrationController.js` (deleguje na `AdminService`)
- **Service**: `services/adminService.js`
- **Routy**: `routes/administration.web.js`, `routes/administration.api.js`
- **Pohled**: `views/administration.ejs`

## 9.1. Přístup do administrace

Přístup je striktně omezen pomocí autorizačního middlewaru `isRoot`.

- **Endpoint**: `GET /administration`
- **Logika**: Middleware `isRoot` ověří, zda je přihlášený uživatel skutečně uživatel s `username: 'root'`.

## 9.2. Zobrazení dat

Administrátorská stránka poskytuje přímý pohled do databáze a zobrazuje čtyři hlavní tabulky: Users, Devices, Latest Locations, Alerts.

Controller (`getAdminPage`) načítá data přímo z DB modelů s podporou vyhledávání (`*Search`) a řazení (`*SortBy`).

## 9.3. Správa uživatelů

- **Endpointy**:
  - `DELETE /api/admin/users/:userId` (Standardní API)
  - `POST /api/admin/delete-user/:userId` (Legacy/Formulář)
- **Funkce**: Administrátor může smazat jakéhokoliv uživatele (kromě sebe sama).
- **Implementace**: `AdminService.deleteUserAndData` zajistí smazání uživatele. Odstranění závislých dat spoléhá na DB cascade a manuální cleanup v případě potřeby.

## 9.4. Správa zařízení

- **Endpointy**:
  - `DELETE /api/admin/devices/:deviceId` (Standardní API)
  - `POST /api/admin/delete-device/:deviceId` (Legacy/Formulář)
- **Funkce**: Administrátor může smazat jakékoliv zařízení v systému.
- **Implementace**: `AdminService.deleteDeviceAndData` provede atomické smazání zařízení a všech jeho závislostí (lokace, alerty) v transakci.

*Poznámka: `:deviceId` zde odkazuje na databázové `id` (číselné).*

## 9.5. Ověření uživatele přes admin

- **Endpoint**: `POST /api/admin/verify-user/:userId`
- **Funkce**: Nastaví `is_verified = true` pro daného uživatele (via `AdminService.verifyUser`).

## 9.6. Správa poplachů (alerts)

- **Endpointy**:
  - `DELETE /api/admin/alerts/:alertId`
  - `POST /api/admin/delete-alert/:alertId` (Legacy)
- **Implementace**: `AdminService.deleteAlert` zajistí kontrolu práv (root může vše, user jen své) a odstranění.

## 9.7. Architektura

Všechny operace jsou nyní zapouzdřeny v `services/adminService.js`. Controller pouze volá service a rozhoduje o formátu odpovědi (JSON vs Redirect).