# Plán úprav Android Aplikace pro Kompatibilitu se Serverem (Aktualizováno po úpravách serveru)

Tento dokument popisuje nezbytné kroky pro úpravu stávající Android aplikace tak, aby byla plně kompatibilní s novým serverovým backendem. Cílem je implementovat bezpečný a pro uživatele jednoduchý proces přihlášení a automatické registrace zařízení.

## 1. Cílové Chování Aplikace (Uživatelský Scénář)

1.  **První spuštění:** Uživatel spustí aplikaci.
2.  **Kontrola přihlášení:** Aplikace zkontroluje, zda existuje platná session (zda je uživatel přihlášen).
3.  **Zobrazení přihlašovací obrazovky:** Pokud uživatel není přihlášen, je automaticky přesměrován na novou přihlašovací obrazovku.
4.  **Přihlášení:** Uživatel zadá své jméno (nebo e-mail) a heslo a stiskne tlačítko "Přihlásit".
5.  **Automatická registrace zařízení:** Po úspěšném ověření přihlašovacích údajů serverem aplikace na pozadí provede následující:
    a. Získá unikátní ID zařízení (`ANDROID_ID`).
    b. Odešle na server požadavek pro zaregistrování tohoto ID ke právě přihlášenému účtu.
6.  **Přesměrování na hlavní obrazovku:** Po úspěšném přihlášení a registraci zařízení je uživatel přesměrován na hlavní obrazovku aplikace (`MainActivity`), kde může spustit/zastavit sledování.
7.  **Sledování polohy:** Když uživatel zapne sledování, `LocationService` začne odesílat data na server. Každý požadavek již obsahuje správné, zaregistrované ID zařízení.

## 2. Technický Plán Implementace

### Krok 1: Vytvoření Přihlašovací Obrazovky a UI logiky **(DOKONČENO)**

-   Byla vytvořena nová aktivita `LoginActivity.kt` a k ní příslušný layout `activity_login.xml`.
-   Layout obsahuje `EditText` pro uživatelské jméno/e-mail, `EditText` pro heslo, `Button` pro přihlášení a `ProgressBar` pro indikaci.
-   V `MainActivity.kt` byla přidána logika pro kontrolu stavu přihlášení a spuštění `LoginActivity`.

### Krok 2: Implementace Síťové Komunikace a Logiky **(DOKONČENO)**

-   Byla implementována síťová komunikace v `LoginActivity.kt` pro přihlášení na `/api/apk/login` a registraci zařízení na `/api/apk/register-device`.
-   Je zajištěno ukládání session cookie a `device_id` do `SharedPreferences`.

### Krok 3: Úprava `LocationService.kt` **(DOKONČENO)**

-   `LocationService.kt` byl upraven tak, aby četl `device_id` z `SharedPreferences` a používal ho v JSON payloadu odesílaném na `/device_input`.
-   Byla přidána logika pro odesílání session cookie s požadavkem.

#### Změna v odesílaném JSON payloadu

Je potřeba změnit, jak se identifikuje zařízení v JSONu odesílaném na **endpoint `/device_input`**.

**Před úpravou:**
```json
{
  "device": "Google Pixel 6",
  "latitude": 49.123,
  "longitude": 16.456,
  ...
}
```

**Po úpravě (správná verze):**
```json
{
  "device": "a1b2c3d4e5f6g7h8", // Hodnota z Settings.Secure.ANDROID_ID
  "latitude": 49.123,
  "longitude": 16.456,
  ...
}
```
Tato změna zajistí, že server bude moci data správně spárovat se zařízením registrovaným pod účtem daného uživatele.

## Serverové Změny (Dokončeno)

Server byl upraven a nyní poskytuje dedikované API endpointy pro mobilní aplikaci pod prefixem `/api/apk/`. Byla také nakonfigurována podpora CORS pro bezproblémovou komunikaci.