# GPS Tracking Server

Tento projekt je komplexní serverová aplikace pro sledování GPS zařízení v reálném čase. Je postaven na platformě **Node.js** s využitím frameworku **Express.js**. Aplikace slouží jako backend pro příjem, zpracování a vizualizaci dat z GPS zařízení, správu uživatelských účtů, autentizaci a autorizaci, a poskytuje administrační rozhraní.

## Klíčové funkce

-   **Správa uživatelů**: Registrace, přihlášení (včetně OAuth přes Google a GitHub), ověření e-mailu, změna hesla a správa uživatelského profilu.
-   **Správa zařízení**: Přidávání, odebírání a správa GPS sledovacích zařízení.
-   **Zobrazení polohy**: Vizualizace aktuální i historické polohy zařízení na mapě.
-   **API pro hardware**: Dedikované API endpointy pro komunikaci s hardwarovými GPS jednotkami.
-   **Administrace**: Rozhraní pro správu uživatelů a systémových nastavení.
-   **Zabezpečení**: Omezení počtu dotazů (rate limiting), ochrana CSRF, a bezpečné ukládání hesel pomocí `bcryptjs`.
-   **API dokumentace**: Interaktivní dokumentace API dostupná přes Swagger UI.

## Technologický stack

### Backend
-   **Node.js**: Runtime prostředí.
-   **Express.js**: Webový framework.
-   **Sequelize**: ORM pro komunikaci s databází MySQL.
-   **Passport.js**: Middleware pro autentizaci (lokální, Google OAuth 2.0, GitHub OAuth 2.0).
-   **EJS**: Šablonovací systém pro generování HTML stránek.
-   **bcryptjs**: Knihovna pro hashování hesel.
-   **Nodemailer**: Modul pro odesílání e-mailů.
-   **Swagger JSDoc / Swagger UI Express**: Pro automatické generování API dokumentace.

### Databáze
-   **MySQL**: Relační databázový systém.

### Frontend
-   **EJS**: Vykreslování na straně serveru.
-   **CSS & JavaScript**: Vlastní styly a skripty pro interaktivitu.

### DevOps
-   **Docker / Docker Compose**: Pro kontejnerizaci a snadné nasazení.

## Struktura projektu

Aplikace dodržuje upravený vzor **Model-View-Controller (MVC)**:

-   `config/`: Konfigurace (např. Passport.js).
-   `controllers/`: Obsahuje logiku pro zpracování požadavků.
-   `database.js`: Inicializace a připojení k databázi.
-   `docs/`: Podrobná technická dokumentace.
-   `middleware/`: Middleware funkce (např. autorizace, validátory).
-   `models/`: Sequelize modely databáze.
-   `public/`: Statické soubory (CSS, JS, obrázky).
-   `routes/`: Definuje routy pro webové stránky a API.
-   `views/`: EJS šablony pro uživatelské rozhraní.
-   `server.js`: Hlavní vstupní bod aplikace.
-   `swaggerDef.js`: Konfigurace pro Swagger.
-   `docker-compose.yml`, `dockerfile`: Konfigurace pro Docker.

## Spuštění projektu

### Požadavky
-   Node.js
-   MySQL databáze
-   Nebo Docker

### 1. Spuštění s Dockerem (doporučeno)

Projekt je navržen pro snadné spuštění pomocí Dockeru.

```bash
# Sestavení a spuštění kontejnerů v detached módu
docker-compose up --build -d

# Zobrazení logů aplikace
docker-compose logs -f app

# Zastavení služeb
docker-compose down
```

### 2. Manuální spuštění

1.  **Klonujte repozitář:**
    ```bash
    git clone <URL-repozitare>
    cd GPS_server_NodeJS/Server_NODEJS
    ```

2.  **Nainstalujte závislosti:**
    ```bash
    npm install
    ```

3.  **Nastavte prostředí:**
    -   Zkopírujte soubor `.env.example` na `.env`.
    -   Upravte proměnné v `.env` a nastavte připojení k vaší MySQL databázi a klíče pro OAuth.
    ```
    SESSION_SECRET=...
    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    GITHUB_CLIENT_ID=...
    GITHUB_CLIENT_SECRET=...
    EMAIL_USER=...
    EMAIL_PASS=...
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=...
    DB_NAME=gps_tracking
    ```

4.  **Spusťte server:**
    -   Pro produkční běh:
        ```bash
        npm start
        ```
    -   Pro vývoj s automatickým restartem (vyžaduje `nodemon`):
        ```bash
        npm run dev
        ```

Server poběží na adrese `http://localhost:5000`.

## API Dokumentace

Po spuštění aplikace je interaktivní API dokumentace (Swagger) dostupná na adrese:
[http://localhost:5000/api-docs/](http://localhost:5000/api-docs/)

## Detailní technická dokumentace

Kompletní a detailní popis jednotlivých částí systému naleznete v následujících dokumentech ve složce `/docs`:

-   **[1. Přehled Backendu](./docs/1-backend-overview.md)**
-   **[2. Databáze](./docs/2-database.md)**
-   **[3. API a Routy](./docs/3-api-and-routes.md)**
-   **[4. Autentizace a Autorizace](./docs/4-authentication.md)**
-   **[5. Správa uživatelského účtu](./docs/5-user-management.md)**
-   **[6. Správa zařízení](./docs/6-device-management.md)**
-   **[7. Zpracování GPS dat](./docs/7-gps-data-processing.md)**
-   **[8. Frontend](./docs/8-frontend.md)**
-   **[9. Administrace](./docs/9-administration.md)**