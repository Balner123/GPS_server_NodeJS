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
| **Vývoj** | `nodemon` | Automatické restartování serveru při změnách v kódu. |
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
├── utils/              # Utility (např. odesílání emailů)
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

> Tip: Pro rychlé sledování nových záznamů použijte `tail -f log.txt` (nebo PowerShell `Get-Content log.txt -Wait`).
