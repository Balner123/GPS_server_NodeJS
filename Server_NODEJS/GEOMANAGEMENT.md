# Implementační plán pro Geo-Management

## Cíl
Implementovat funkcionalitu Geofencingu (geografických ohrad) a připravit systém pro budoucí nástroje pro správu a analýzu mapových dat.

---

## Fáze 1: Uživatelské rozhraní (Frontend)

Cílem této fáze je připravit vše potřebné na straně klienta pro interakci s mapou.

*   **Úkol 1.1: Integrace knihovny `Leaflet.draw`**
    *   Přidat odkazy na CSS a JS soubory knihovny do souboru `views/partials/_head.ejs`.

*   **Úkol 1.2: Vytvoření plovoucího Tool-Menu**
    *   V `views/manage-devices.ejs` vytvořit malý plovoucí panel (tool-menu) v rohu mapy.
    *   Přidat do menu první tlačítko: "Vytvořit/Upravit ohradu".

*   **Úkol 1.3: Implementace kreslení**
    *   V `public/js/device.js` napsat logiku, která po kliknutí na tlačítko v tool-menu aktivuje režim kreslení.
    *   Umožnit uživateli nakreslit na mapě polygon (mnohoúhelník).
    *   Po dokončení kreslení zobrazit tlačítka "Uložit" a "Zrušit".
    *   Při výběru zařízení, které již má ohradu definovanou, zobrazit tuto ohradu na mapě.

---

## Fáze 2: Úložiště a API (Backend)

Cílem je připravit server na ukládání a správu dat o ohradách.

*   **Úkol 2.1: Rozšíření databáze**
    *   Upravit model `Device` v `models/device.js`.
    *   Přidat nový sloupec `geofence` s datovým typem `JSONB` nebo `TEXT` pro ukládání souřadnic ohrady ve formátu GeoJSON.

*   **Úkol 2.2: Vytvoření API Endpointů**
    *   V `routes/devices.api.js` vytvořit endpoint `POST /api/devices/geofence` pro uložení ohrady.
    *   Vytvořit endpoint `DELETE /api/devices/geofence/:deviceId` pro smazání ohrady.

*   **Úkol 2.3: Implementace Controlleru**
    *   V `deviceController.js` vytvořit funkce `updateGeofence` a `deleteGeofence` pro obsluhu těchto endpointů.

---

## Fáze 3: Logika poplachů (Backend)

Cílem je implementovat jádro funkcionality – kontrolu polohy a spouštění poplachů.

*   **Úkol 3.1: Kontrola "bodu v polygonu"**
    *   V `deviceController.js` upravit funkci `handleDeviceInput`.
    *   Při každém přijetí nových souřadnic načíst ohradu zařízení z databáze.
    *   Pokud ohrada existuje, provést matematickou kontrolu, zda je bod uvnitř.

*   **Úkol 3.2: Vytvoření databáze pro poplachy**
    *   Vytvořit nový model `Alert` (`models/alert.js`) a odpovídající tabulku v databázi pro ukládání historie poplachů (ID zařízení, typ, zpráva, čas).

*   **Úkol 3.3: Spouštění poplachů**
    *   Pokud je bod mimo ohradu, zavolat novou funkci `triggerGeofenceAlert`.
    *   Tato funkce:
        1.  Uloží nový záznam do tabulky `alerts`.
        2.  Pomocí `utils/emailSender.js` odešle varovný e-mail majiteli.

---

## Fáze 4: Zobrazení poplachů (Frontend)

Cílem je informovat uživatele o poplachu v reálném čase ve webovém rozhraní.

*   **Úkol 4.1: API pro poplachy**
    *   Vytvořit endpoint `GET /api/alerts`, který vrátí nepřečtené poplachy pro přihlášeného uživatele.

*   **Úkol 4.2: Zobrazení v UI**
    *   V `public/js/device.js` přidat mechanismus (polling), který se bude periodicky dotazovat na `/api/alerts`.
    *   Při obdržení nového poplachu zobrazit výrazné pop-up okno.
    *   Implementovat možnost označit poplach jako "přečtený".
