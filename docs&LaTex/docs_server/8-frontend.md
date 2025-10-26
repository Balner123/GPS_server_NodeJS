# 8. Frontend

Tento dokument popisuje klientskou část aplikace, včetně použitého šablonovacího systému, hlavních knihoven a logiky uživatelského rozhraní.

## 8.1. Technologie a knihovny

- **Šablonovací systém**: **EJS (Embedded JavaScript)** se používá na straně serveru k dynamickému generování HTML stránek. Umožňuje vkládat data z controllerů přímo do HTML. Pro znovupoužitelné části (hlavička, patička, navigace) se využívají parciální šablony (`views/partials`).

- **Styling**: **Bootstrap 5** je hlavní CSS framework pro responzivní design a komponenty. Vlastní styly jsou definovány v `public/css/style.css`.

- **Mapy**: **Leaflet.js** je open-source knihovna pro interaktivní mapy. Používá se na hlavní stránce (`/`) i na stránce pro správu zařízení (`/devices`).

- **Kreslení na mapě**: **Leaflet.draw** je plugin pro Leaflet, který umožňuje uživatelům kreslit tvary (polygony, kruhy) na mapě. Využívá se pro definování geografických ohrad (Geofence).

## 8.2. Struktura složky `public`

Tato složka obsahuje všechny statické soubory, které jsou přímo přístupné z prohlížeče.

- **`/css/style.css`**: Obsahuje vlastní CSS pravidla, včetně definic pro světlý a tmavý motiv.
- **`/img/`**: Obrázky použité v aplikaci (ikony, pozadí).
- **`/js/`**: Klientské JavaScript soubory.

## 8.3. Klientské skripty (`/js/`)

### `theme-switcher.js`
- **Funkce**: Zajišťuje přepínání mezi světlým a tmavým motivem vzhledu.
- **Logika**: Ukládá preferenci uživatele do `localStorage` a při načtení stránky ji aplikuje, aby se zabránilo problikávání (FOUC).

### `common.js`
- **Funkce**: Obsahuje pomocné formátovací funkce, které se používají na více místech v aplikaci.
- **Příklady**: `formatTimestamp()`, `formatCoordinate()`, `formatSpeed()` atd. Zajišťují konzistentní zobrazení dat napříč aplikací.

### `index.js`
- **Určení**: Hlavní stránka (`/`).
- **Funkce**: Zobrazuje živou mapu s aktuální polohou všech zařízení uživatele.
- **Logika**:
  1. Inicializuje mapu Leaflet.
  2. V pravidelném intervalu (`5 sekund`) volá API endpoint `GET /api/devices/coordinates`.
  3. Aktualizuje pozice značek (markerů) na mapě a seznam zařízení v postranním panelu.
  4. Při kliknutí na zařízení v seznamu přesměruje na detail zařízení (`/devices?id=...`).

### `device.js`
- **Určení**: Stránka pro správu a detail zařízení (`/devices`).
- **Funkce**: Nejobsáhlejší klientský skript, který řídí veškerou interaktivitu na této stránce.
- **Logika**:
  1. **Výběr zařízení**: Načte ID zařízení z URL a zobrazí jeho data.
  2. **Zobrazení historie**: Volá `GET /api/devices/data` pro načtení historie polohy a vykreslí ji na mapu jako čáru (polyline) a jednotlivé body. Zpracovává i "cluster" objekty.
  3. **Správa nastavení**: Zpracovává formulář pro změnu intervalů a odesílá data na `POST /api/devices/settings`.
  4. **Geofencing**: Inicializuje `Leaflet.draw` a umožňuje uživateli kreslit, ukládat (`POST /api/devices/geofence`) a mazat ohrady.
  5. **Správa zařízení**: Obsahuje logiku pro přejmenování (`POST /api/devices/name`) a mazání (`POST /api/devices/delete/:deviceId`) zařízení.
  6. **Poplachy**: V pravidelném intervalu kontroluje `GET /api/alerts` a zobrazuje nové poplachy jako notifikace (toasty). Umožňuje také označit všechny poplachy u zařízení jako přečtené.

### `scripts.js`
- **Poznámka**: Tento soubor se zdá být **zastaralý**. Používá knihovnu Google Maps, zatímco zbytek aplikace přešel na Leaflet. Není načítán na žádné z hlavních stránek.
