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
| `GET` | `/devices` | `isAuthenticated` | Stránka pro správu zařízení. |
| `GET` | `/settings` | `isAuthenticated` | Stránka pro nastavení uživatelského účtu. |
| `GET` | `/administration` | `isRoot` | Hlavní stránka administrátorského rozhraní. |

---

## 3.3. API Endpoints

Tyto routy slouží pro komunikaci s frontendem a externími zařízeními (HW, APK). Vrací data ve formátu JSON.

### Autentizace (`/api/auth`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | Veřejné | Zpracuje přihlášení uživatele (jméno/heslo). |
| `POST` | `/register` | Veřejné | Zpracuje registraci nového uživatele. |
| `POST` | `/verify-email` | Veřejné | Ověří kód zadaný na `/verify-email` stránce. |
| `POST` | `/resend-verification-from-page` | Veřejné | Znovu odešle ověřovací kód. |

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
| `POST` | `/input` | Veřejné | **Klíčový endpoint** pro příjem dat z GPS trackerů. |
| `GET` | `/coordinates` | `isAuthenticated` | Získá poslední známé souřadnice všech zařízení uživatele. |
| `GET` | `/data` | `isAuthenticated` | Získá historii polohy pro konkrétní zařízení (dle `?id=`). |
| `GET` | `/settings/:deviceId` | `isUser` | Získá nastavení pro konkrétní zařízení. |
| `POST` | `/settings` | `isUser` | Aktualizuje nastavení (intervaly) pro zařízení. |
| `POST` | `/name` | `isUser` | Změní název zařízení. |
| `POST` | `/delete/:deviceId` | `isUser` | Smaže zařízení patřící uživateli. |
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

### Administrace (`/api/admin`)

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/delete-user/:userId` | `isRoot` | Smaže uživatele a všechna jeho data. |
| `POST` | `/delete-device/:deviceId` | `isRoot` | Smaže konkrétní zařízení bez ohledu na vlastníka. |

### Specifické pro Hardware/APK

| Metoda | Endpoint | Oprávnění | Popis |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/hw/register-device` | Veřejné | Zaregistruje HW zařízení k účtu na základě jména a hesla. |
| `POST` | `/api/apk/login` | Veřejné | Speciální přihlášení pro Android APK. |
| `POST` | `/api/apk/logout` | `isAuthenticated` | Odhlášení pro Android APK. |
| `POST` | `/api/apk/register-device` | `isAuthenticated` | Registrace zařízení z přihlášené Android APK. |
