# Použité technologie a architektura

Tento dokument slouží jako technický průvodce projektem. Shrnuje použitý technologický stack, architektonické vzory, klíčové knihovny a specifické algoritmy implementované v GPS serveru. Je určen pro vývojáře, kteří se chtějí rychle zorientovat v codebase.

## 1. Základní Stack

Projekt je postaven jako **monolitická serverová aplikace** běžící v prostředí Node.js.

| Komponenta | Technologie | Popis |
| :--- | :--- | :--- |
| **Runtime** | **Node.js** | JavaScript runtime prostředí (V8 engine). |
| **Framework** | **Express.js** | Minimalistický webový framework pro routování a middleware. |
| **Jazyk** | **JavaScript (ES6+)** | Používá CommonJS moduly (`require`). |
| **Databáze** | **MySQL 8.0** | Relační databáze pro trvalé uložení dat. |
| **ORM** | **Sequelize** | Object-Relational Mapper pro abstrakci SQL dotazů. |

## 2. Architektura aplikace (MVC)

Projekt striktně dodržuje návrhový vzor **Model-View-Controller**.

### Structure Mapping
- **Model (`/models`)**: Definuje schéma dat a vztahy (User, Device, Location, Alert). Využívá Sequelize definice.
- **View (`/views`)**: Prezentační vrstva. HTML šablony generované na serveru pomocí **EJS** (Embedded JavaScript).
- **Controller (`/controllers`)**: Aplikační logika. Přijímá vstupy, komunikuje s modely a vrací data nebo renderuje pohledy.
- **Routes (`/routes`)**: Definice URL endpointů a mapování na controllery. Odděleno na API (`.api.js`) a Web (`.web.js`).

### Middleware (`/middleware`)
Aplikace využívá řetězení middleware funkcí pro:
- **Autorizaci**: (`authorization.js`) Kontrola session a rolí (User vs Root).
- **Validaci**: (`validators.js`) Kontrola vstupních dat pomocí `express-validator`.
- **Logování**: (`requestLogger.js`) Zaznamenávání HTTP požadavků.
- **Rate Limiting**: Ochrana proti přetížení/útokům.

## 3. Datová vrstva a Persistence

### MySQL & Sequelize
- **Schéma**: Relační model s cizími klíči (User 1:N Device 1:N Location).
- **Synchronizace**: Projekt využívá `sequelize.sync({ alter: true })` pro vývoj (automatická úprava tabulek).
- **Inicializace**: `init-db.sql` slouží pro prvotní vytvoření DB struktury v Dockeru.
- **Transakce**: Kritické operace (např. hromadný import dat z trackeru nebo mazání zařízení) jsou baleny do databázových transakcí (`db.sequelize.transaction()`) pro zajištění integrity.

## 4. Bezpečnost a Autentizace

Bezpečnost je řešena na několika úrovních:

- **Autentizace**: Knihovna **Passport.js**.
    - `LocalStrategy`: Přihlášení jménem a heslem.
    - `GoogleStrategy`, `GitHubStrategy`: OAuth 2.0 přihlášení.
- **Session Management**: `express-session` s ukládáním do paměti (v produkci doporučeno Redis/DB store).
- **Hesla**: Hashování pomocí **bcryptjs** (solení a hashování). Hesla se nikdy neukládají v čitelné podobě.
- **API Ochrana**:
    - **Rate Limiting**: `express-rate-limit` omezuje počet požadavků z jedné IP.
    - **CORS**: Nastavení sdílení zdrojů (pokud je potřeba).
- **Sanitizace**: Ořezávání citlivých dat (hesla, tokeny) z logů.

## 5. API a Komunikace

### REST API
Aplikace vystavuje RESTful API pro:
- **Frontend**: AJAX volání pro dynamické operace (mazání, grafy).
- **Hardware/APK**: Příjem telemetrických dat.

### Dokumentace API
- **Swagger (OpenAPI 3.0)**: Automaticky generovaná dokumentace dostupná na `/api-docs`.
- Využívá `swagger-jsdoc` pro psaní dokumentace přímo v komentářích kódu a `swagger-ui-express` pro vizualizaci.

### Komunikace s Hardwarem
- **Format**: JSON payload via HTTP POST.
- **Handshake**: Specifický protokol pro ověření konfigurace zařízení a synchronizaci nastavení (intervaly, power management).

## 6. Klíčové Algoritmy

### Geofencing (Hlídání zón)
Server implementuje logiku pro detekci opuštění/návratu do zóny.
- **Kruhové zóny**: Výpočet vzdálenosti od středu (Haversine formula).
- **Polygonové zóny**: Algoritmus **Ray Casting** (Point in Polygon) pro detekci, zda se bod nachází uvnitř libovolného tvaru.
- **Logika**: Stav `geofence_alert_active` na zařízení zabraňuje spamování notifikacemi (alert se vytvoří jen při změně stavu Uvnitř <-> Venku).

### Shlukování dat (Clustering)
Pro zobrazení historie na mapě bez přehlcení:
- Algoritmus prochází seřazenou historii poloh.
- Pokud jsou body blíže než definovaný práh (`DISTANCE_THRESHOLD_METERS`), jsou sloučeny do jednoho bodu (průměr souřadnic).

## 7. Frontend (Server-Side Rendering)

Ačkoliv jde primárně o backend, aplikace obsahuje UI:
- **Template Engine**: **EJS**. Umožňuje vkládat data do HTML na straně serveru (`<%= user.username %>`).
- **CSS Framework**: Vlastní styly + pravděpodobně integrace CSS knihovny (např. Bootstrap - dle tříd v EJS).
- **Mapy**: Integrace mapových podkladů (OpenStreetMaps) pro vizualizaci souřadnic.

## 8. DevOps a Prostředí

- **Kontejnerizace**: **Docker** a **Docker Compose**.
    - Služba `app`: Node.js server.
    - Služba `mysql`: Databázový server.
- **Konfigurace**: Proměnné prostředí (.env) načítané přes `dotenv`.
- **Logování**: Vlastní logger (`utils/logger.js`) zapisující do souboru `log.txt` s rotací a formátováním.

## 9. Testování
- **Skripty**: Přítomnost `scripts/testy.py` naznačuje použití Python skriptů pro integrační nebo zátěžové testování API endpointů.
