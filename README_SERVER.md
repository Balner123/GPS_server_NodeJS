# GPS Tracking Server (Node.JS)

Tento dokument popisuje architekturu, strukturu a fungování NodeJS serveru pro GPS sledování.

## Architektura

Server je postaven na Node.js s využitím Express.js frameworku. Pro komunikaci s databází využívá Sequelize ORM. Architektura je navržena tak, aby oddělovala jednotlivé části aplikace (routy, controllery, modely).

## Struktura Projektu

Projekt má standardní MVC (Model-View-Controller) adresářovou strukturu.

## Databáze

Aplikace používá MySQL databázi. Schéma je definováno pomocí Sequelize modelů v adresáři `/models` a inicializováno pomocí skriptu `init-db.sql`.

### Schéma Databáze

```mermaid
erDiagram
    USER ||--|{ DEVICE : "vlastní"
    DEVICE ||--o{ LOCATION : "má"

    USER {
        INT id PK
        STRING username UNIQUE
        STRING email UNIQUE
        STRING password
        BOOLEAN is_verified
    }

    DEVICE {
        INT id PK
        INT user_id FK
        STRING device_id UNIQUE
        STRING name
        DATETIME last_seen
        INT interval_gps "Interval měření (s)"
        INT interval_send "Počet cyklů pro odeslání"
    }

    LOCATION {
        INT id PK
        INT device_id FK
        DECIMAL longitude
        DECIMAL latitude
        DATETIME timestamp
        DECIMAL speed
    }
```

## API Endpoints

Kompletní a aktuální dokumentace API je automaticky generována pomocí Swaggeru a je dostupná na adrese `/api-docs` po spuštění serveru.

### Klíčové endpointy:

*   **Pro Hardware:**
    *   `POST /api/devices/input`: Přijímá data o poloze z GPS zařízení (jednotlivě nebo v dávce). Pokud zařízení není registrováno, vrací `403 Forbidden`.
    *   `POST /api/hw/register-device`: Registruje hardware k uživatelskému účtu. Vyžaduje přihlašovací údaje uživatele a ID zařízení. Používá se v OTA režimu.

*   **Pro Web/APK Klienty:**
    *   `POST /api/apk/login`: Přihlášení pro mobilní aplikaci.
    *   `POST /api/apk/register-device`: Registrace zařízení z mobilní aplikace (vyžaduje přihlášení).
    *   `GET /api/devices/coordinates`: Vrací aktuální souřadnice všech zařízení přihlášeného uživatele.
    *   `GET /api/devices/data?id=...`: Vrací historická data pro konkrétní zařízení.
    *   `POST /api/devices/settings`: Aktualizuje nastavení pro konkrétní zařízení (intervaly, jméno atd.).

## Instalace a Spuštění

Projekt je navržen pro spuštění v Dockeru.

1.  Ujistěte se, že máte nainstalovaný Docker a Docker Compose.
2.  Vytvořte soubor `.env` v adresáři `Server_NODEJS` (můžete kopírovat z `PLANY.txt` nebo jiného zdroje).
3.  Spusťte kontejnery pomocí příkazu:
    ```bash
    docker-compose up --build -d
    ```
4.  Při prvním spuštění se automaticky vytvoří databáze podle `init-db.sql`.
5.  Server poběží na portu definovaném v `.env` (např. `http://localhost:3000`).