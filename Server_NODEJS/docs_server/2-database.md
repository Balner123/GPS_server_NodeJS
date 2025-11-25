
# 2. Databáze

Tento dokument detailně popisuje databázové schéma, jednotlivé tabulky (modely) a jejich vzájemné vztahy.

## 2.1. Přehled

- **Systém**: MySQL
- **ORM**: Sequelize
- **Inicializace**: Schéma databáze a základní data jsou definovány v souboru `init-db.sql`, který se automaticky spouští při prvním startu `mysql` kontejneru v Dockeru.

## 2.2. Schéma a modely

Následuje popis jednotlivých tabulek a jejich reprezentace v Sequelize modelech.

### Tabulka `users`

Ukládá informace o uživatelských účtech.

- **Model**: `models/user.js`
- **Klíčové sloupce**:
  - `id`: Primární klíč (PK).
  - `username`, `email`: Unikátní identifikátory uživatele.
  - `password`: Hashované heslo pro lokální účty (u OAuth může být prázdné, dokud si uživatel nenastaví heslo).
  - `is_verified`: Flag, zda byl e-mail uživatele ověřen.
  - `verification_code`, `verification_expires`: Dočasný kód a jeho expirace pro ověření e‑mailu nebo specifické procesy.
  - `pending_email`: Dočasně uložený nový e‑mail čekající na ověření.
  - `provider`, `provider_id`, `provider_data`: Informace o přihlášení přes třetí strany (OAuth), např. `google` nebo `github`.
  - `deletion_code`, `deletion_code_expires`: Kód a expirace pro potvrzení smazání účtu.

### Tabulka `devices`

Obsahuje informace o registrovaných GPS zařízeních.

- **Model**: `models/device.js`
- **Klíčové sloupce**:
  - `id`: Primární klíč (PK).
  - `user_id`: Cizí klíč (FK) odkazující na `users.id`. Určuje, komu zařízení patří.
  - `device_id`: Unikátní identifikátor zařízení (řetězec). V databázi je definován jako `VARCHAR(255)` (viz `init-db.sql`), proto aplikace akceptuje delší ID — doporučuje se používat konzistentní formát (HW ID nebo instalacní ID pro APK).
  - `name`: Uživatelsky definovaný název zařízení.
  - `status`: Stav zařízení (`active`, `inactive`).
  - `last_seen`: Poslední časová značka, kdy zařízení odeslalo data.
  - `power_status`: Stav napájení hlášený zařízením (`ON`, `OFF`).
  - `power_instruction`: Instrukce pro zařízení k vypnutí (`NONE`, `TURN_OFF`).
  - `interval_gps`, `interval_send`, `satellites`: Konfigurace intervalů a minimální počet satelitů pro fix (HW).
  - `mode`: Režim odesílání dat (`simple`, `batch`).
  - `geofence`: JSON pro uložení ohrady (podporuje GeoJSON polygon i vlastní typ `circle`).
  - `geofence_alert_active`: Interní příznak, zda je aktivní „mimo geofence“ stav.
  - `device_type`: Typ klienta/zařízení (`HW`, `APK`).
  - `created_at`: Datum registrace zařízení.

### Tabulka `locations`

Ukládá jednotlivé záznamy o poloze z GPS zařízení.

- **Model**: `models/location.js`
- **Klíčové sloupce**:
  - `id`: Primární klíč (PK).
  - `device_id`: Cizí klíč (FK) odkazující na `devices.id`.
  - `longitude`, `latitude`: Zeměpisné souřadnice.
  - `timestamp`: Časová značka záznamu.
  - `speed`, `altitude`, `accuracy`, `satellites`: Doplňující data z GPS modulu.

### Tabulka `alerts`

Záznamy o vygenerovaných poplaších (např. při opuštění geofence).

- **Model**: `models/alert.js`
- **Klíčové sloupce**:
  - `id`: Primární klíč (PK).
  - `device_id`: Cizí klíč (FK) odkazující na `devices.id`.
  - `type`: Typ poplachu (např. `geofence`).
  - `message`: Text poplachu.
  - `is_read`: Flag, zda si uživatel poplach přečetl.

## 2.3. Vztahy mezi modely (Asociace)

Vztahy jsou definovány v `associate` metodách jednotlivých modelů a zajišťují integritu dat. Kód někdy provádí i ruční mazání závislých záznamů v transakcích (např. při mazání zařízení), i když databáze má také `ON DELETE CASCADE`.

## 2.4. Inicializační SQL a root uživatel

Soubor `init-db.sql` v kořeni projektu obsahuje SQL pro vytvoření databáze, tabulek a indexů. Skript rovněž obsahuje ukázkový záznam pro uživatele `root`. Poznámka: momentálně nepoužíváme specializovaný `seed-root`.

```mermaid
erDiagram
    users {
        int id PK
        varchar username
        varchar email
    }

    devices {
        int id PK
        int user_id FK
    varchar device_id
        varchar name
    varchar status
    int interval_gps
    int interval_send
    int satellites
    json geofence
    boolean geofence_alert_active
    }

    locations {
        int id PK
        int device_id FK
        decimal longitude
        decimal latitude
    }

    alerts {
        int id PK
        int device_id FK
        varchar type
    }

    users ||--o{ devices : "vlastní"
    devices ||--o{ locations : "zaznamenává"
    devices ||--o{ alerts : "generuje"
```

- **`User` 1 : N `Device`**: Jeden uživatel může vlastnit více zařízení.
- **`Device` 1 : N `Location`**: Jedno zařízení může mít mnoho záznamů o poloze.
- **`Device` 1 : N `Alert`**: K jednomu zařízení se může vázat více poplachů.

**Kaskádové mazání (`ON DELETE CASCADE`)**: Při smazání uživatele se kaskádově smažou i jeho zařízení a následně jejich lokace a poplachy. V některých operacích (např. mazání zařízení administrátorem) se pro jistotu provádí ruční mazání závislých záznamů v transakci.

## Provozní poznámky

- Po spuštění kontejneru se inicializační skript `init-db.sql` může použit pro naplnění základních dat.
- Migrace: používejte verzované migrace, zvláště při změnách schématu v produkci.
- Konfigurace připojení: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` jsou definovány přes env proměnné a spravovány v `docker-compose.yml`.

