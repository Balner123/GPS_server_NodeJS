# Plán úprav Android Aplikace pro Robustní Registraci a Správu Účtu

Tento dokument nahrazuje předchozí plány. Popisuje kroky pro implementaci flexibilního a robustního mechanismu přihlašování, odhlašování a registrace zařízení.

## 1. Cíl

- **Odstranit chybu "ID již existuje"** při reinstalaci aplikace.
- **Umožnit přihlášení více uživatelů** na jednom zařízení (ne současně).
- **Implementovat standardní funkci odhlášení.**
- **Oddělit logiku přihlášení od logiky registrace zařízení.**

## 2. Technický Plán Implementace

### Krok 1: Generování Unikátního ID pro Každou Instalaci (UUID)

Toto je nejdůležitější změna, která řeší problém s reinstalací.

- **Kde:** V `LoginActivity.kt` nebo v `Application` třídě, pokud existuje.
- **Logika:**
  1. Při startu aplikace zkontrolovat `SharedPreferences`, zda existuje hodnota `installation_id`.
  2. Pokud `installation_id` **neexistuje**:
     - Vygenerovat nový UUID: `val newId = UUID.randomUUID().toString()`
     - Uložit ho do `SharedPreferences`: `sharedPrefs.edit().putString("installation_id", newId).apply()`
  3. Toto `installation_id` se od teď bude používat ve veškeré komunikaci se serverem, která vyžaduje identifikaci zařízení (přihlášení, registrace). Nahradí tak dosavadní `ANDROID_ID`.
- **Důležité:** Toto ID musí přežít odhlášení uživatele, ale musí být smazáno při odinstalaci aplikace (což se děje automaticky s `SharedPreferences`).

### Krok 2: Implementace Funkce Odhlášení

- **Kde:** V `MainActivity.kt` a `activity_main.xml`.
- **Úpravy UI:**
  1. Do `activity_main.xml` přidat nové tlačítko, například `logoutButton`. Může být v menu nebo přímo na obrazovce.
- **Logika:**
  1. V `MainActivity.kt` nastavit `onClickListener` pro `logoutButton`.
  2. Po kliknutí provést následující akce:
     - Zastavit `LocationService`, pokud běží: `stopService(Intent(this, LocationService::class.java))`.
     - Vymazat **uživatelsky specifická data** z `SharedPreferences`. To zahrnuje:
       - `session_cookie`
       - `isAuthenticated`
       - Jakékoliv další uložené informace o uživateli.
     - **NESMAZAT `installation_id`!**
     - Přesměrovat uživatele na `LoginActivity`: `startActivity(Intent(this, LoginActivity::class.java))`.
     - Ukončit `MainActivity`: `finish()`.
  3. **(Volitelné, doporučené):** Před vymazáním lokálních dat zavolat nový serverový endpoint `/api/apk/logout` pro invalidaci session na straně serveru.

### Krok 3: Inteligentní Přihlašovací a Registrační Proces

- **Kde:** V `LoginActivity.kt`.
- **Logika:**
  1. Uživatel zadá přihlašovací údaje a klikne na "Přihlásit".
  2. Aplikace odešle POST požadavek na `/api/apk/login`. **Tělo požadavku nyní musí obsahovat i `installationId`** z `SharedPreferences`.
     ```json
     {
       "identifier": "uzivatel@email.com",
       "password": "heslo",
       "installationId": "abc-123-def-456"
     }
     ```
  3. Aplikace očekává od serveru novou odpověď, která obsahuje boolean flag `device_is_registered`.
  4. **Větvení logiky na základě odpovědi:**
     - **Pokud `device_is_registered` je `true`:**
       - Uložit session cookie.
       - Uložit stav přihlášení (`isAuthenticated = true`).
       - Přeskočit registraci a rovnou spustit `MainActivity`.
     - **Pokud `device_is_registered` je `false`:**
       - Uložit session cookie.
       - Provést druhý POST požadavek na `/api/apk/register-device`. Tělo požadavku bude obsahovat `installationId` a název zařízení.
       - Po úspěšné registraci spustit `MainActivity`.

Tento postup zajistí, že aplikace bude robustní, flexibilní a uživatelsky přívětivá.
