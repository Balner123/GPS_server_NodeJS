# 6. Správa zařízení

Tento dokument se věnuje všem operacím souvisejícím s GPS zařízeními – od jejich registrace, přes sledování, až po konfiguraci a mazání.

- **Hlavní Controller**: `controllers/deviceController.js` (deleguje logiku na services)
- **Services**: `services/deviceService.js`, `services/locationService.js`, `services/alertService.js`, `services/geofenceService.js`
- **Routy**: `routes/devices.*.js`, `routes/hw.api.js`, `routes/apk.js`
- **Pohled**: `views/manage-devices.ejs`

## 6.1. Registrace zařízení

Primárně se používá sjednocený endpoint:

- **Unified**: `POST /api/devices/register`
  - `client_type=HW` – vyžaduje `username` + `password` a `device_id`. Endpoint provede autentizaci a přiřadí zařízení k účtu.
  - `client_type=APK` – vyžaduje aktivní session (APK login). Stačí poslat `device_id` (např. `installationId`) a volitelný název.

*Poznámka: Staré endpointy `POST /api/hw/register-device` a `POST /api/apk/register-device` byly v rámci refactoringu (2025) odstraněny nebo označeny jako deprecated. Nová integrace musí používat `POST /api/devices/register`.*

Poznámka k chování unified registrace:
- Endpoint `POST /api/devices/register` vrací `201` při úspěšném vytvoření, `200` pokud je zařízení již registrováno u stejného uživatele a `409` když zařízení patří jinému uživateli.

### Handshake

- **Endpoint**: `POST /api/devices/handshake`
- **Účel**: Zařízení (HW/APK) získá aktuální konfiguraci (`interval_gps`, `interval_send`, `mode`, `satellites`) a případnou `power_instruction` (`NONE`|`TURN_OFF`). Pokud zařízení hlásí shodu (`power_status=OFF` po instrukci `TURN_OFF`), server instrukci zruší ještě před odpovědí.
- **Výstup**: `{ "registered": true|false, "config": { ... }, "power_instruction": "NONE" | "TURN_OFF" }`
- **Legacy**: `POST /api/hw/handshake` – existuje jako alias pro `api/devices/handshake`.

Poznámka: Handshake endpoint také aktualizuje `device.device_type`, `device.power_status` a `device.last_seen`, pokud jsou tyto hodnoty zaslány v payloadu.

## 6.2. Zpracování a ukládání dat

- **Endpoint**: `POST /api/devices/input`
- **Proces (Service Layer)**:
  1.  Zařízení (HW nebo APK) odesílá data o poloze na tento endpoint.
  2.  Controller `deviceController.js` validuje vstupy a volá `LocationService.processLocationData`.
  3.  Service spustí DB transakci:
      - Uloží body do tabulky `locations` (bulk insert).
      - Aktualizuje `last_seen` a stavy (`power_status`, `device_type`) u zařízení.
      - Pokud je potvrzena instrukce vypnutí, zruší ji.
  4.  Po commitu transakce volá `GeofenceService.checkGeofence` pro asynchronní kontrolu geozón a odeslání alertů.
  
  Odpověď je `{ "success": true }` (HTTP 200).

## 6.3. Zobrazení dat

- **Live mapa**: Na hlavní stránce (`/`) se pomocí `GET /api/devices/coordinates` periodicky načítají poslední známé polohy (`LocationService.getLatestCoordinates`).
- **Historie polohy**: Na stránce `/devices` si může uživatel zobrazit historii polohy. Data se načítají z `GET /api/devices/data` (`LocationService.getDeviceHistory`) a prochází **agregací** (shlukováním) pro lepší přehlednost.

## 6.4. Konfigurace zařízení

Uživatel může na stránce `/devices` měnit nastavení pro každé zařízení (`DeviceService.updateSettings`):

- **Změna intervalů**: `POST /api/devices/settings`
  - `interval_gps`: Jak často má zařízení zjišťovat polohu.
  - `interval_send`: Po kolika zjištěných polohách má zařízení odeslat data na server.
  - `satellites`: Minimální počet satelitů pro fix.
  - `mode`: Režim `simple` vs `batch`.

## 6.5. Geofencing (Geografické ohrady)

- **Uložení ohrady**: `POST /api/devices/geofence`
- **Kontrola**: Řízena službou `GeofenceService`. Při každém přijetí nových souřadnic server zkontroluje, zda se bod nachází uvnitř uložené ohrady.
- **Spuštění poplachu**: Pokud je bod **mimo** ohradu a stav není aktivní, systém nastaví `geofence_alert_active = true`, uloží alert a odešle e‑mail (`sendGeofenceAlertEmail`).
- **Návrat do ohrady**: Pokud se zařízení vrátí dovnitř a stav byl aktivní, systém jej zruší (`geofence_alert_active = false`).

## 6.6. Poplachy (Alerts)

Všechny operace spravuje `AlertService`:

- **Vytvoření poplachu**: `GeofenceService` volá `Alert.create`.
- **Zobrazení poplachů**: Frontend se dotazuje na `GET /api/alerts` (`AlertService.getUnreadAlerts`).
- **Správa poplachů**:
  - `POST /api/alerts/read`: Označí konkrétní poplachy jako přečtené (`AlertService.markAlertsAsRead`).
  - `POST /api/alerts/read-all/:deviceId`: Označí všechny poplachy u zařízení jako přečtené.

## 6.7. Mazání zařízení

- **Endpoint**: `DELETE /api/devices/:deviceId` (nebo legacy `POST /api/devices/delete/:deviceId`)
- **Proces**: `DeviceService.deleteDevice` provede atomické smazání zařízení včetně všech závislostí (lokace, alerty) v rámci jedné transakce.

## 6.8. Export dat do GPX

- **Endpoint**: `GET /api/devices/export/gpx/:deviceId`
- **Proces**: `LocationService.getGpxData` vygeneruje XML string s historií polohy ve formátu GPX 1.1.