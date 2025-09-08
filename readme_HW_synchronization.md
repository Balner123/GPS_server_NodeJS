# Plán Synchronizace a Registrace Hardwaru (v2.0)

Tento dokument popisuje nový, bezpečnější a robustnější proces pro první spuštění a registraci hardwarových GPS jednotek. Nahrazuje původní koncept manuální registrace.

## Cíle

1.  **Zvýšit bezpečnost:** Odstranit možnost registrace zařízení pouhým zadáním jeho ID, což brání "krádeži" ID.
2.  **Zjednodušit proces pro uživatele:** Proces registrace je plně v režii uživatele a hardwaru, bez nutnosti manuálních kroků v administraci serveru.
3.  **Sjednotit logiku:** Přiblížit proces registrace hardwaru zavedenému procesu pro mobilní aplikaci (APK).
4.  **Šetřit energii:** Neregistrované zařízení nebude cyklicky odesílat data a vybíjet baterii.

---

## Architektura Řešení

Proces je rozdělen na dvě hlavní části: chování zařízení v normálním režimu a registrační proces ve speciálním OTA režimu.

### Část 1: Chování v Normálním Režimu (Neregistrované Zařízení)

Tato část řeší situaci, kdy je zařízení zapnuto, ale ještě nebylo přiřazeno k žádnému uživatelskému účtu.

#### **Kroky na straně serveru:**

1.  **Upravit `POST /api/devices/input`:**
    *   Logika v controlleru `handleDeviceInput` bude upravena.
    *   Při přijetí dat se provede kontrola, zda `deviceId` existuje v databázi a je přiřazeno uživateli.
    *   Pokud **není** nalezeno, server odpoví stavovým kódem `403 Forbidden` a JSON zprávou:
        ```json
        {
          "registered": false,
          "message": "Device is not registered."
        }
        ```

#### **Kroky na straně hardwaru:**

1.  **Upravit `sendHTTPPostRequest()`:**
    *   Po odeslání dat bude firmware analyzovat odpověď ze serveru.
2.  **Upravit hlavní logiku po probuzení:**
    *   Pokud odpověď obsahuje `{"registered": false}` (nebo je stavový kód `403`), zařízení pochopí, že není registrováno.
    *   Vypíše na sériový port zprávu `DEVICE NOT REGISTERED. PLEASE USE OTA MODE TO REGISTER. POWERING DOWN.`
    *   Zruší se periodický časovač pro probouzení.
    *   Zařízení se uvede do neomezeného hlubokého spánku (de-facto se vypne), aby se zabránilo další spotřebě energie.

---

### Část 2: Registrační Proces v OTA Režimu

Registrace bude možná **pouze** v tomto režimu, který vyžaduje fyzický přístup k zařízení (přepnutí switche).

#### **Kroky na straně serveru:**

1.  **Vytvořit nový endpoint `POST /api/hw/register-device`:**
    *   Tento endpoint bude určen výhradně pro registraci hardwaru.
    *   Bude očekávat `POST` požadavek s JSON tělem:
        ```json
        {
          "username": "uzivatelske_jmeno",
          "password": "heslo_uzivatele",
          "deviceId": "unikatni_id_zarizeni",
          "name": "Volitelny Nazev Zarizeni"
        }
        ```
    *   **Logika Controlleru:**
        1.  Ověří přihlašovací údaje (`username`, `password`) proti databázi uživatelů.
        2.  **Pokud přihlášení selže:** Odpoví `401 Unauthorized` s chybovou hláškou.
        3.  **Pokud přihlášení uspěje:**
            *   Zkontroluje, zda zařízení s daným `deviceId` již není registrováno jiným uživatelem. Pokud ano, vrátí chybu `409 Conflict`.
            *   Pokud je vše v pořádku, vytvoří v databázi nový záznam v tabulce `Devices`, kde propojí `deviceId` s ID přihlášeného uživatele.
            *   Odpoví `201 Created` s potvrzovací zprávou.

2.  **Odstranit starou manuální registraci:**
    *   Webová stránka `/register-device` a její obslužné routy a funkce v controlleru budou z projektu kompletně odstraněny.

#### **Kroky na straně hardwaru:**

1.  **Rozšířit `startOTAMode()`:**
    *   Webový server běžící na zařízení bude obsluhovat dvě stránky:
        1.  Původní stránku pro nahrání nového firmwaru (`/update`).
        2.  Novou hlavní stránku (`/`), která bude obsahovat:
            *   Informace o zařízení (jeho ID).
            *   **Přihlašovací formulář** s poli pro `username` a `password`.
            *   Odkaz na stránku `/update`.
2.  **Vytvořit handler pro přihlašovací formulář (např. `POST /register`):**
    *   Po odeslání formuláře handler na zařízení provede následující kroky:
        1.  Zapne SIM modul a připojí se k síti GPRS.
        2.  Získá `username` a `password` z formuláře.
        3.  Vytvoří JSON tělo s přihlašovacími údaji a vlastním `deviceId`.
        4.  Odešle `POST` požadavek na serverový endpoint `/api/hw/register-device`.
        5.  Na základě odpovědi ze serveru zobrazí uživateli na webové stránce výsledek:
            *   **Úspěch:** "Zařízení úspěšně registrováno k účtu [username]. Restartujte zařízení do normálního režimu."
            *   **Neúspěch:** "Chyba: Neplatné přihlašovací údaje." nebo jiná relevantní chyba.
        6.  Po dokončení operace se SIM modul opět vypne.