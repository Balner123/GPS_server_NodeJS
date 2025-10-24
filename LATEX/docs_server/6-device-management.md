# 6. Správa zařízení

Tento dokument se věnuje všem operacím souvisejícím s GPS zařízeními – od jejich registrace, přes sledování, až po konfiguraci a mazání.

- **Hlavní Controller**: `controllers/deviceController.js`
- **Routy**: `routes/devices.*.js`, `routes/hw.api.js`, `routes/apk.js`
- **Pohled**: `views/manage-devices.ejs`

## 6.1. Registrace zařízení

Zařízení lze do systému přidat třemi způsoby:

1.  **Z hardwarového zařízení (OTA)**
    - **Endpoint**: `POST /api/hw/register-device`
    - **Proces**: Zařízení v konfiguračním režimu odešle své `deviceId` spolu s uživatelským jménem a heslem majitele. Server ověří přihlašovací údaje a pokud je vše v pořádku, přiřadí zařízení k danému účtu.

2.  **Z Android APK**
    - **Endpoint**: `POST /api/apk/register-device`
    - **Proces**: Uživatel přihlášený v mobilní aplikaci může zaregistrovat telefon jako sledovací zařízení. Aplikace odešle `installationId` (unikátní ID aplikace), které se použije jako `deviceId`.

3.  **Manuálně v UI** (aktuálně není implementováno)
    - V uživatelském rozhraní `/devices` je prostor pro přidání formuláře, který by umožnil manuální zadání `deviceId` a jeho registraci k účtu.

## 6.2. Zpracování a ukládání dat

- **Endpoint**: `POST /api/devices/input`
- **Proces**:
  1.  Zařízení (HW nebo APK) odesílá data o poloze na tento endpoint. Může jít o jeden bod nebo pole bodů (dávkové odeslání).
  2.  Server nejprve ověří, zda je `deviceId` registrováno v databázi.
  3.  Pokud ano, všechny platné body (s `latitude` a `longitude`) se uloží do tabulky `locations`.
  4.  U zařízení se aktualizuje časová značka `last_seen`.
  5.  Po uložení se provede kontrola na Geofence (viz níže).
  6.  V odpovědi server zašle zařízení aktuálně nastavené intervaly (`interval_gps`, `interval_send`, `satellites`), aby se mohlo přizpůsobit.

## 6.3. Zobrazení dat

- **Live mapa**: Na hlavní stránce (`/`) se pomocí `GET /api/devices/coordinates` periodicky načítají poslední známé polohy všech aktivních zařízení uživatele a zobrazují se na mapě.
- **Historie polohy**: Na stránce `/devices` si může uživatel zobrazit historii polohy pro vybrané zařízení. Data se načítají z `GET /api/devices/data` a v controlleru prochází **agregací** (shlukováním) pro lepší přehlednost při stání vozidla.

## 6.4. Konfigurace zařízení

Uživatel může na stránce `/devices` měnit nastavení pro každé zařízení:

- **Změna názvu**: `POST /api/devices/name`
- **Změna intervalů**: `POST /api/devices/settings`
  - `interval_gps`: Jak často má zařízení zjišťovat polohu.
  - `interval_send`: Po kolika zjištěných polohách má zařízení odeslat data na server (pro dávkový režim).
  - `satellites`: Minimální počet satelitů pro fix

## 6.5. Geofencing (Geografické ohrady)

- **Uložení ohrady**: `POST /api/devices/geofence`
  - Na mapě v `/devices` může uživatel nakreslit polygon (pomocí `Leaflet.draw`), který se uloží jako JSON do sloupce `geofence` u daného zařízení.
- **Kontrola**: Při každém přijetí nových souřadnic (`handleDeviceInput`) server zkontroluje, zda se bod nachází uvnitř uložené ohrady.
- **Spuštění poplachu**: Pokud je bod **mimo** ohradu, zavolá se funkce `triggerGeofenceAlert`.

## 6.6. Poplachy (Alerts)

- **Vytvoření poplachu**: Funkce `triggerGeofenceAlert`:
  1.  Vytvoří nový záznam v tabulce `alerts` s typem `geofence`.
  2.  Odešle majiteli zařízení varovný e-mail (pomocí `utils/emailSender.js`).
- **Zobrazení poplachů**: Frontend se periodicky dotazuje na `GET /api/alerts`, aby zjistil nové (nepřečtené) poplachy a zobrazil je uživateli.
- **Správa poplachů**:
  - `POST /api/alerts/read`: Označí konkrétní poplachy jako přečtené.
  - `POST /api/alerts/read-all/:deviceId`: Označí všechny poplachy u zařízení jako přečtené.

## 6.8. Export dat do GPX

- **Endpoint**: `GET /api/devices/export/gpx/:deviceId`
- **Proces**: 
  1. Na stránce `/devices`, po výběru konkrétního zařízení, se na kartě s informacemi o zařízení objeví tlačítko "Export GPX".
  2. Po kliknutí na tlačítko server shromáždí veškerou historii polohy pro dané zařízení, seřadí ji podle času a vygeneruje soubor ve formátu GPX 1.1.
  3. Tento soubor je následně odeslán do prohlížeče a automaticky se stáhne.
  4. Soubor obsahuje všechny zaznamenané body trasy (`<trkpt>`) včetně zeměpisné šířky, délky, nadmořské výšky (`<ele>`), času (`<time>`) a rychlosti (`<speed>`).
