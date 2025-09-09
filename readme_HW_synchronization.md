# Dokumentace Synchronizace a Registrace Hardwaru

Tento dokument popisuje finální, implementovaný proces pro první spuštění a registraci hardwarových GPS jednotek.

## Cíle Architektury

1.  **Bezpečnost:** Registrace zařízení je možná pouze po úspěšné autentizaci uživatele, což brání neoprávněnému přiřazení zařízení.
2.  **Jednoduchost:** Proces registrace je plně v režii uživatele a hardwaru, bez nutnosti manuálních kroků na straně serveru.
3.  **Úspora Energie:** Neregistrované zařízení necykluje a nevybíjí baterii, ale přejde do úsporného režimu.

---

## Architektura Řešení

Proces je rozdělen na dvě hlavní části: chování zařízení v normálním režimu a registrační proces ve speciálním OTA režimu.

### Část 1: Chování v Normálním Režimu (Neregistrované Zařízení)

Tato část popisuje situaci, kdy je zařízení zapnuto, ale ještě není přiřazeno k žádnému uživatelskému účtu.

#### **Chování Serveru:**

*   Endpoint `POST /api/devices/input` při přijetí dat z neznámého `deviceId` odpovídá stavovým kódem `403 Forbidden` a JSON zprávou:
    ```json
    {
      "registered": false,
      "message": "Device is not registered."
    }
    ```

#### **Chování Hardwaru:**

*   Po odeslání dat firmware analyzuje odpověď ze serveru.
*   Pokud odpověď obsahuje `{"registered": false}` (nebo je stavový kód `403`), zařízení provede následující:
    1.  Vypíše na sériový port zprávu `DEVICE NOT REGISTERED. PLEASE USE OTA MODE TO REGISTER. POWERING DOWN.`
    2.  Zruší svůj periodický časovač pro probouzení.
    3.  Uvede se do neomezeného hlubokého spánku (de-facto se vypne), aby se zabránilo další spotřebě energie.

---

### Část 2: Registrační Proces v OTA Režimu

Registrace je možná **pouze** v tomto režimu, který vyžaduje fyzický přístup k zařízení (přepnutí hardwarového switche).

#### **Chování Serveru:**

*   Existuje specializovaný endpoint `POST /api/hw/register-device`, který očekává JSON požadavek ve formátu:
    ```json
    {
      "username": "uzivatelske_jmeno",
      "password": "heslo_uzivatele",
      "deviceId": "unikatni_id_zarizeni",
      "name": "Volitelny Nazev Zarizeni"
    }
    ```
*   **Logika Controlleru:**
    1.  Ověří přihlašovací údaje (`username`, `password`). Při selhání odpoví `401 Unauthorized`.
    2.  Pokud přihlášení uspěje, zkontroluje, zda `deviceId` již není registrováno jiným uživatelem. Pokud ano, vrátí `409 Conflict`.
    3.  Pokud je vše v pořádku, vytvoří v databázi nový záznam v tabulce `Devices`, kde propojí `deviceId` s ID přihlášeného uživatele.
    4.  Odpoví `201 Created` s potvrzovací zprávou.

#### **Chování Hardwaru:**

*   V OTA režimu zařízení spustí webový server na vlastní WiFi síti.
*   Tento server na adrese `/` zobrazuje servisní stránku, která obsahuje:
    *   Informace o zařízení (jeho ID) a stavu připojení k mobilní síti.
    *   **Přihlašovací formulář** (username, password).
    *   Odkaz na stránku `/update` pro nahrání nového firmwaru.
*   Po odeslání formuláře na lokální cestu `/doregister` zařízení provede následující:
    1.  Zapne a připojí SIM modul (pokud již není).
    2.  Sestaví JSON z formuláře a svého ID.
    3.  Odešle `POST` požadavek na serverový endpoint `/api/hw/register-device`.
    4.  Zobrazí uživateli na webové stránce výsledek (úspěch/neúspěch) podle odpovědi ze serveru.
