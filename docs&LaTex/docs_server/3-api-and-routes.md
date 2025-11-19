# 3. API a routy

Tento dokument popisuje hlavní REST API a webové routy. Detailní specifikace (parametry, schémata, příklady odpovědí) jsou dostupné v Swagger UI na `/api-docs` a v `docs_server/schemas/`.

## Autorizace a middleware

- `isAuthenticated` — vyžaduje platnou session; jinak přesměruje na `/login` nebo vrátí HTTP 401 pro API.
- `isUser` — uživatel s běžnými oprávněními (ne root).
- `isRoot` — administrátorská role s vyššími právy.

Middleware implementují centrální kontrolu přístupu a validaci vstupních dat; chyby validace vrací strukturovaný JSON s popisem chyby.

## Stručný přehled rout

Webové (EJS) routy slouží UI; API routy vrací JSON a jsou určeny pro klienty (APK, HW) i frontend.

Hlavní skupiny API:

- `/api/auth` — autentizační operace (`/login`, `/register`, `/verify-email`, apod.).
- `/api/devices` — správa zařízení, příjem dat (`POST /input`), exporty, nastavení zařízení.
- `/api/settings` — změny uživatelských preferencí a bezpečnostní operace (změna hesla, smazání účtu).
- `/api/admin` — administrativní operace (pouze `isRoot`).

Poznámka: legacy endpointy pro HW/APK existují pouze pro zpětnou kompatibilitu; primární integrace probíhá přes sjednocené controllery pod `/api/devices`.

## Klíčové endpointy (vybrané)

- `POST /api/devices/input` — přijímá dávky dat z trackerů (HW). Endpoint je veřejný, očekávaný payload a chování viz `docs_server/schemas/` a `docs_hw/4-data-format.md`.
- `POST /api/devices/handshake` — vrací konfigurační překryvy a instrukce napájení (`NONE` | `TURN_OFF`).
- `POST /api/devices/register` — registrace zařízení (podrobnosti a podmínky viz `docs_hw/5-ota.md`).
- `/api/auth/*` — standardní autentizační operace; odpovědi obsahují stav a chybové kódy pro klienta.

Pro úplný seznam rout, autorizaci a příklady odpovědí použijte Swagger (`/api-docs`).

---
Poslední aktualizace: 2025-11-18
# 3. API a Routy

Tento dokument poskytuje kompletní přehled všech webových stránek a API endpointů dostupných v aplikaci. Přístup k mnoha z nich je omezen pomocí autorizačního middlewaru.

## 3.1. Autorizační Middleware

- **`isAuthenticated`**: Vyžaduje, aby byl uživatel přihlášen (existuje platná session). Pokud ne, přesměruje na `/login`.
- **`isUser`**: Vyžaduje, aby byl uživatel přihlášen a zároveň nebyl 'root'. Zabraňuje administrátorovi v přístupu na běžné uživatelské stránky.
- **`isRoot`**: Vyžaduje, aby byl uživatel přihlášen a jeho jméno bylo 'root'.

---

## 3.2. Webové stránky (GUI)

Tyto routy vrací HTML stránky renderované pomocí EJS.

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | `isUser` | Hlavní stránka s mapou pro běžného uživatele. |
| `GET` | `/login` | Veřejné | Zobrazí přihlašovací stránku. |
| `GET` | `/register` | Veřejné | Zobrazí registrační stránku. |
| `GET` | `/logout` | Veřejné | Odhlásí uživatele a přesměruje na login. |
| `GET` | `/verify-email` | Veřejné | Stránka pro zadání ověřovacího kódu z e-mailu. |
| `GET` | `/set-password` | `isAuthenticated` | Stránka pro nastavení prvního hesla u OAuth účtu bez lokálního hesla. |
| `GET` | `/devices` | `isAuthenticated` | Stránka pro správu zařízení. |
| `GET` | `/settings` | `isAuthenticated` | Stránka pro nastavení uživatelského účtu. |
| `GET` | `/settings/confirm-delete` | `isAuthenticated` | Stránka pro potvrzení smazání účtu pomocí kódu. |
| `GET` | `/administration` | `isRoot` | Hlavní stránka administrátorského rozhraní. |

---

## 3.3. API Endpoints

Tyto routy slouží pro komunikaci s frontendem a externími zařízeními (HW, APK). Vrací data ve formátu JSON.

### Autentizace (`/api/auth`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | Veřejné | Zpracuje přihlášení uživatele (jméno/heslo). |
| `POST` | `/register` | Veřejné | Zpracuje registraci nového uživatele. |
| `POST` | `/verify-email` | Veřejné | Ověří kód (při registraci nebo změně e‑mailu). |
| `POST` | `/resend-verification-code` | Veřejné | Znovu odešle ověřovací kód (API varianta). |
| `POST` | `/set-initial-password` | `isAuthenticated` | Nastaví první heslo pro účet vytvořený přes OAuth (povoleno pouze, pokud zatím nemá lokální heslo). |

Poznámka: Webová varianta opětovného odeslání kódu je dostupná na `POST /resend-verification-from-page` (mimo `/api/auth`).

### OAuth Přihlášení (`/auth`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `GET` | `/google` | Veřejné | Zahájí proces přihlášení pomocí Google. |
| `GET` | `/google/callback` | Veřejné | Zpracuje návrat z Google po autorizaci. |
| `GET` | `/github` | Veřejné | Zahájí proces přihlášení pomocí GitHub. |
| `GET` | `/github/callback` | Veřejné | Zpracuje návrat z GitHub po autorizaci. |

### Správa zařízení (`/api/devices`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/input` | Veřejné | **Klíčový endpoint** pro příjem dat z GPS trackerů; odpověď je vždy `{ "success": true }`. |
| `GET` | `/coordinates` | `isAuthenticated` | Získá poslední známé souřadnice všech zařízení uživatele. |
| `GET` | `/data` | `isAuthenticated` | Získá historii polohy pro konkrétní zařízení (dle `?id=`). |
| `GET` | `/settings/:deviceId` | `isUser` | Získá nastavení pro konkrétní zařízení. `deviceId` je HW ID (řetězec). |
| `POST` | `/settings` | `isUser` | Aktualizuje nastavení (intervaly) pro zařízení. |
| `POST` | `/name` | `isUser` | Změní název zařízení. |
| `POST` | `/delete/:deviceId` | `isUser` | Smaže zařízení patřící uživateli. `deviceId` je HW ID (řetězec). |
| `POST` | `/geofence` | `isUser` | Uloží nebo aktualizuje geografickou ohradu (geofence). |
| `GET`  | `/export/gpx/:deviceId` | `isUser` | Exportuje historii polohy zařízení jako soubor ve formátu GPX. |

### Poplachy (`/api/devices`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `GET` | `/alerts` | `isUser` | Získá všechny nepřečtené poplachy pro uživatele. |
| `POST` | `/alerts/read` | `isUser` | Označí konkrétní poplachy jako přečtené. |
| `POST` | `/alerts/read-all/:deviceId` | `isUser` | Označí všechny poplachy u zařízení jako přečtené. |

### Nastavení účtu (`/api/settings`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/username` | `isUser` | Změní uživatelské jméno. |
| `POST` | `/password` | `isUser` | Změní heslo. |
| `POST` | `/email` | `isUser` | Zahájí proces změny e-mailové adresy. |
| `POST` | `/delete-account` | `isUser` | Smaže celý uživatelský účet. |
| `POST` | `/disconnect` | `isUser` | Odpojí propojený účet třetí strany (Google, GitHub). |
| `POST` | `/set-password` | `isUser` | Nastaví (první) lokální heslo u účtu přihlášeného přes OAuth. |
| `POST` | `/confirm-delete` | `isUser` | Potvrdí smazání účtu ověřovacím kódem. |
| `POST` | `/resend-deletion-code` | `isUser` | Znovu odešle kód pro smazání účtu. |
| `POST` | `/cancel-delete` | `isUser` | Zruší probíhající proces smazání účtu. |

### Administrace (`/api/admin`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/delete-user/:userId` | `isRoot` | Smaže uživatele a všechna jeho data. |
| `POST` | `/delete-device/:deviceId` | `isRoot` | Smaže konkrétní zařízení bez ohledu na vlastníka. `deviceId` je zde databázové ID (číselné), nikoliv HW ID. |
| `POST` | `/verify-user/:userId` | `isRoot` | Ručně označí uživatele jako ověřeného (verify email). |
| `DELETE`| `/alerts/:alertId` | `isAuthenticated` | Smaže konkrétní poplach (Admin může smazat libovolný, uživatel jen svůj). |
| `POST` | `/delete-alert/:alertId` | `isRoot` | Alternativní POST endpoint pro mazání poplachů (pro HTML formuláře). |

### Specifické pro Hardware/APK

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/devices/register` | Dle typu | Sjednocená registrace zařízení (`client_type=HW|APK`), HW vyžaduje jméno+heslo, APK aktivní session. |
| `POST` | `/api/devices/handshake` | Veřejné | Vrátí konfiguraci a power instrukce (`NONE`/`TURN_OFF`); pokud zařízení hlásí stav odpovídající instrukci, server ji v odpovědi vynuluje. |
| `POST` | `/api/hw/register-device` | Veřejné | **Legacy** endpoint pro HW registraci (deleguje na unified controller). |
| `POST` | `/api/hw/handshake` | Veřejné | **Legacy** handshake endpoint – odpovídá stejně jako `/api/devices/handshake`. |
| `POST` | `/api/apk/login` | Veřejné | Speciální přihlášení pro Android APK. |
| `POST` | `/api/apk/logout` | `isAuthenticated` | Odhlášení pro Android APK. |
| `POST` | `/api/apk/register-device` | `isAuthenticated` | **Legacy** registrace z APK (interně využívá unified logiku). |

Poznámky k identifikátorům zařízení:
- V uživatelských API (`/api/devices/...`) se používá `deviceId` jako HW ID (řetězec `device_id`).
- V administraci pro endpoint `/api/admin/delete-device/:deviceId` se očekává databázové ID zařízení (číselné `id`).
