# 1. Přehled Backendu

Tento dokument poskytuje celkový přehled architektury, použitých technologií a základní konfigurace serverové části aplikace.

## 1.1. Architektura

Server je postaven na platformě **Node.js** s využitím frameworku **Express.js**. Aplikace dodržuje vrstvenou architekturu (Service Layer Pattern) postavenou na základě **MVC (Model-View-Controller)**.

- **Model**: Reprezentován soubory ve složce `/models`. Definuje strukturu dat pomocí **Sequelize ORM** a komunikuje s databází MySQL.
- **View**: Reprezentován soubory ve složce `/views`. Využívá šablonovací systém **EJS (Embedded JavaScript)** k dynamickému generování HTML stránek.
- **Controller**: Reprezentován soubory ve složce `/controllers`. Zpracovává HTTP požadavky, validuje vstupy a řídí tok aplikace. **Neobsahuje byznys logiku.**
- **Service**: Reprezentován soubory ve složce `/services`. Obsahuje veškerou byznys logiku, složitější operace, transakce a komunikaci s modely. Controllery delegují práci těmto službám.

### Hlavní služby (Services)
- `AuthService`: Správa uživatelů, registrace, přihlašování, verifikace e-mailů, reset hesel.
- `DeviceService`: Správa zařízení, registrace (Unified), nastavení, mazání.
- `LocationService`: Zpracování GPS dat, geocoding, historie polohy, GPX export.
- `GeofenceService`: Detekce vstupu/výstupu z geofence, alerty.
- `AlertService`: Správa notifikací a alertů.
- `AdminService`: Administrátorské operace (mazání uživatelů, verifikace).

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
├── controllers/        # Řídící logika (Controllery - tenké)
├── services/           # Byznys logika (Services - tlusté)
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

Aplikace je navržena pro spuštění pomocí **Docker**. Konfigurace se nachází v souboru `docker-compose.yml`.

- **Start serveru**: `docker-compose up --build -d`
- **Vstupní bod**: Soubor `server.js` inicializuje Express aplikaci a middleware.
- **Konfigurace**: Proměnné prostředí (`.env`) řídí chování (PORT, DB credentials, atd.).

## 1.5. Logování a observabilita

Všechny HTTP požadavky procházejí middlewarem `logger.requestLogger()` (v `utils/logger.js`). Logy se ukládají do `log.txt`.
Metody controllerů a services používají strukturované logování (`log.info(...)`) s metadaty (requestId, userId, deviceId) pro snadnější debugování.