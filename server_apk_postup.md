# Plán Úprav Serveru pro Komunikaci s APK

Tento dokument popisuje minimalistický, ale kompletní plán úprav serveru, které jsou nezbytné pro zajištění komunikace s novou mobilní aplikací (APK). Cílem je vytvořit sadu dedikovaných API endpointů a zároveň ponechat stávající funkčnost pro web a hardwarová zařízení 100% nedotčenou.

## Strategie: Dedikované API Endpoints

Nejčistším řešením je vytvořit novou sadu endpointů pod společným prefixem `/api/apk/`. Tím oddělíme logiku pro APK od logiky pro webové rozhraní.

### Přehled Potřebných Endpointů

| Metoda | Endpoint | Účel | Poznámka |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/apk/login` | Přihlášení uživatele z APK. | Vrátí JSON a nastaví session cookie. |
| `POST` | `/api/apk/register-device` | Automatická registrace zařízení po přihlášení. | Musí být voláno po úspěšném přihlášení. |
| `POST` | `/device_input` | Odeslání GPS dat. | **Stávající endpoint se znovu použije.** Není třeba ho duplikovat. |

---

## Technický Plán Implementace

### Krok 1: Vytvoření a registrace nového routeru pro APK **(DOKONČENO)**

1.  **Vytvořit soubor:** Ve složce `routes/` byl vytvořen nový soubor `apk.js`.
2.  **Zaregistrovat v `server.js`:** V `server.js` byl přidán řádek pro registraci routeru `app.use('/api/apk', require('./routes/apk'));`.

### Krok 2: Implementace API pro přihlášení (`/api/apk/login`) **(DOKONČENO)**

1.  **Definovat routu:** Do souboru `routes/apk.js` byl vložen kód pro obsluhu přihlášení `router.post('/login', authController.loginApk);`.
2.  **Vytvořit controller funkci:** V souboru `controllers/authController.js` byla přidána nová exportovaná funkce `loginApk`, která vrací JSON odpovědi.

### Krok 3: Implementace API pro registraci zařízení (`/api/apk/register-device`) **(DOKONČENO)**

1.  **Definovat routu:** V `routes/apk.js` byla přidána routa `router.post('/register-device', authorization.isAuthenticated, deviceController.registerDeviceApk);`.
2.  **Vytvořit controller funkci:** V `controllers/deviceController.js` byla přidána nová funkce `registerDeviceApk`, která vrací JSON odpovědi.

### Krok 4: Konfigurace CORS (Cross-Origin Resource Sharing) **(DOKONČENO)**

1.  **Nainstalovat balíček:** Balíček `cors` byl nainstalován pomocí `npm install cors`.
2.  **Použít v `server.js`:** V `server.js` byl přidán `require('cors')` a `app.use(cors(...))` middleware.

---

**Všechny plánované úpravy serveru pro komunikaci s APK jsou dokončeny.**