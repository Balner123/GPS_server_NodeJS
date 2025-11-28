# 3. API a routy

> **Důležité upozornění:** Tento dokument slouží pouze jako stručný přehled. **Autoritativní a aktuální dokumentace API** je generována automaticky ze zdrojového kódu (pomocí Swagger/OpenAPI) a je dostupná na endpointu `/api-docs` běžícího serveru. V případě rozporů má přednost Swagger dokumentace.

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

Poznámky k identifikátorům zařízení:
- V uživatelských API (`/api/devices/...`) se používá `deviceId` jako HW ID (řetězec `device_id`).
- V administraci pro endpoint `/api/admin/delete-device/:deviceId` se očekává databázové ID zařízení (číselné `id`).
