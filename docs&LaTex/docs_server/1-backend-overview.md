# 1. Přehled backendu

Tento dokument stručně popisuje architekturu, klíčové komponenty a provozní poznámky serverové části aplikace.

## Architektura

Backend je implementován v Node.js s využitím frameworku Express a následuje logiku MVC (Model–View–Controller). Datová vrstva je realizována přes Sequelize a MySQL. Prezentační část používá EJS pro generování server-side HTML; většina interakce probíhá však přes REST API vrstvu.

Hlavní adresáře projektu:

- `config/` — konfigurace (Passport, rate-limits apod.)
- `controllers/` — aplikační logika (zpracování požadavků)
- `models/` — Sequelize modely a migrace
- `routes/` — registrace rout a jejich autorizace
- `middleware/` — autorizace, validace, rate limiting
- `utils/` — pomocné utility (logger, sanitizace)
- `views/`, `public/` — šablony a statické soubory

## Technologický stack (stručně)

- Node.js, Express
- MySQL + Sequelize
- EJS (server-side views)
- Passport / express-session (autentizace)
- Swagger (`swagger-ui-express`) pro API dokumentaci

Plný seznam závislostí je v `package.json`; doporučenou cestou ke kontrole API spec je `/api-docs` (Swagger).

## Spuštění a konfigurace

Preferovaný způsob provozu je kontejnerizace (Docker, `docker-compose.yml`).

- Start (devel/prod): `docker-compose up --build -d`
- Hlavní vstup: `server.js` — inicializuje middleware, routy a službu.
- Konfigurace pomocí env proměnných (př. `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`).

Poznámka: při vývoji aplikace může být použito `sequelize.sync({ alter: true })`; v produkci doporučujeme migrace.

## Logování a observabilita

Logger je implementován v `utils/logger.js`. Důležité body:

- Logy se ukládají do souboru `log.txt` (append), formát je časová značka + úroveň + JSON metadata.
- Citlivá pole (`password`, `token`, `authorization`) jsou automaticky redigována.
- GET požadavky jsou logovány stručně; ostatní metody mají detailní záznamy (payloady a odpovědi).

---
Plné technické detaily a referenční diagramy jsou v `db_diagrams/` a v jednotlivých kapitolách v této složce `docs_server/`.
# 1. Přehled Backendu

Tento dokument poskytuje celkový přehled architektury, použitých technologií a základní konfigurace serverové části aplikace.

## 1.1. Architektura

Server je postaven na platformě **Node.js** s využitím frameworku **Express.js**. Aplikace dodržuje osvědčený architektonický vzor **Model-View-Controller (MVC)**, který zajišťuje oddělení datové logiky (Model), prezentační vrstvy (View) a řídící logiky (Controller).

- **Model**: Reprezentován soubory ve složce `/models`. Definuje strukturu dat pomocí **Sequelize ORM** a komunikuje s databází MySQL.
- **View**: Reprezentován soubory ve složce `/views`. Využívá šablonovací systém **EJS (Embedded JavaScript)** k dynamickému generování HTML stránek.
- **Controller**: Reprezentován soubory ve složce `/controllers`. Obsahuje hlavní aplikační logiku, zpracovává požadavky od uživatelů, komunikuje s modely a renderuje pohledy.

## 1.2. Technologický stack

Seznam klíčových knihoven a technologií použitých v projektu (viz `package.json`):

| Kategorie | Technologie | Popis |
| :--- | :--- | :--- |
| **Základ** | Node.js, Express.js | Runtime prostředí a webový framework. |
| **Databáze** | MySQL, Sequelize | Relační databáze a ORM pro práci s ní. |
| **Pohledy** | EJS | Šablonovací systém pro generování HTML. |
| **Autentizace** | `express-session`, `passport` | Správa uživatelských sessions a strategie pro přihlášení (lokální, Google, GitHub). |
| **Bezpečnost** | `bcryptjs`, `express-rate-limit` | Hashování hesel a ochrana proti brute-force útokům. |
| **Validace** | `express-validator` | Validace a sanitizace dat přicházejících od klienta. |
| **API Dokumentace**| `swagger-ui-express` | Automaticky generovaná dokumentace pro API. |
| **Ostatní** | `dotenv`, `nodemailer`, `cors` | Správa konfiguračních proměnných, odesílání e-mailů, Cross-Origin Resource Sharing. |

## 1.3. Struktura projektu

```
/
├── config/             # Konfigurace (např. Passport.js)
├── controllers/        # Řídící logika (Controllery)
├── db_diagrams/        # Diagramy databáze
├── docs/               # Detailní dokumentace
├── middleware/         # Middleware funkce (autorizace, validace)
├── models/             # Datové modely (Sequelize)
├── public/             # Statické soubory (CSS, JS, obrázky)
├── routes/             # Definice všech endpointů (rout)
├── scripts/            # Pomocné skripty
├── utils/              # Utility (logger, geoUtils, gpxGenerator)
├── views/              # Šablony stránek (EJS)
├── .env                # Konfigurační proměnné (lokální)
├── docker-compose.yml  # Konfigurace pro spuštění s Dockerem
├── package.json        # Seznam závislostí a skriptů
└── server.js           # Hlavní vstupní bod aplikace
```

## 1.4. Spuštění a konfigurace

Aplikace je navržena pro spuštění pomocí **Docker**. Konfigurace se nachází v souboru `docker-compose.yml`, který definuje dva hlavní kontejnery: `app` (Node.js aplikace) a `mysql` (databáze).

- **Start serveru**: `docker-compose up --build -d`
- **Vstupní bod**: Soubor `server.js` inicializuje Express aplikaci, nastavuje veškerý middleware (session, Passport, rate limiting) a registruje všechny routy ze složky `/routes`.
- **Konfigurace**: Aplikace je konfigurována pomocí proměnných prostředí (environment variables), které jsou definovány v `docker-compose.yml` a načítány přes `dotenv`. Mezi klíčové proměnné patří `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET` atd.

Další provozní proměnné a runtime chování (viz `server.js`):

- `RATE_LIMIT_MAX` — celkový limit požadavků pro web (default: `300` pokud není definováno).
- `RATE_LIMIT_MAX_API` — limit pro API endpointy (default: `100` pokud není definováno).
- `NODE_ENV` — pokud má hodnotu `using_ssl`, cookie `secure` flag pro session cookie se nastaví na `true` (tj. cookie bude zasílána pouze přes HTTPS). Pozor, kód používá právě tento string aby zapnul secure cookie: `process.env.NODE_ENV === 'using_ssl'`.
- `PORT` — port, na kterém server naslouchá (fallback 5000).

Poznámka o rate-limiting: Server používá dvě úrovně rate-limiteru — obecný limiter (aplikovaný dříve v middleware řetězci) a přísnější limiter aplikovaný na všechny `/api` routy. To znamená, že API rozhraní má oddělené limity a běžné webové stránky mohou mít jiné limity.

Další runtime poznámky:

- Statické soubory jsou servírovány z adresáře `public` (`express.static`).
- Swagger UI (automatically generated from JSDoc in `routes/*.js`) je dostupný na `/api-docs`.
- Session cookie: `sameSite: 'lax'`, `httpOnly: true`, `maxAge: 6 hours`.
- Skripty dostupné v `package.json`: `start` (production) a `dev` (development, uses `nodemon`).

Další poznámky:
- **Swagger UI** je dostupné na `/api-docs` (viz `swaggerDef.js`).
- **Sequelize sync**: Aplikace volá `sequelize.sync({ alter: true })` při startu – menší změny schématu se mohou promítnout automaticky (doporučeno pro vývoj).
- **Session cookie** používá `sameSite: 'lax'`, `httpOnly: true` a délku 6 hodin; `secure` je řízeno přes `NODE_ENV === 'using_ssl'`.

## 1.5. Logování a observabilita

Základní serverový logger je implementován v `utils/logger.js` a všechny HTTP požadavky procházejí middlewarem `logger.requestLogger()` registrovaným v `server.js`.

- **Úložiště logů**: Výstup je ukládán do souboru `log.txt` v kořenové složce serveru. Logger automaticky zakládá soubor (i nadřazené složky) a zapisuje v append módu.
- **Formát**: Každý řádek obsahuje ISO timestamp, úroveň (resp. HTTP metodu) a JSON serializovaná metadata (např. `requestId`, `statusCode`, `durationMs`).
- **Oddělené úrovně pro metody**: Od listopadu 2025 je úroveň logu svázána s metodou. GET požadavky používají úroveň `[GET]` a jsou logovány pouze jedním stručným řádkem (`GET /route ...`) bez payloadu. Zbytek metod (POST, PUT, DELETE, …) zachovává detailní logování payloadů i odpovědí a úroveň odpovídající metodě (`[POST]`, `[PUT]`, …).
- **Maskování citlivých dat**: Logger automaticky rediguje hodnoty klíčů jako `password`, `token`, `authorization` atd. Funkce `sanitizePayload` navíc ořezává příliš velké objekty podle hodnoty `LOGGER_MAX_BODY_LENGTH` (výchozí 8192 bajtů, konfigurovatelná přes env).
- **Kontextové loggery**: Volání `req.log = logger.child({ ... })` umožňuje controllerům a middleware sdílet stejné `requestId` a přidávat vlastní metadata.
