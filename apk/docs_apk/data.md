# Datový model a perzistence

## Room databáze

- Databáze: `gps_reporter_database`
- Entita: `CachedLocation` (tabulka `location_cache`)

Pole entity:
- `id: Int` (PK, autoincrement)
- `latitude: Double`
- `longitude: Double`
- `speed: Float` (v km/h – přepočet z m/s × 3.6)
- `altitude: Double` (m)
- `accuracy: Float` (m, -1 pokud není k dispozici)
- `satellites: Int` (pokud dostupné z `Location.extras`)
- `timestamp: Long` (epoch millis)
- `deviceId: String` (installationId)
- `deviceName: String` (např. "<výrobce> <model>")
- `powerStatus: String` (`"ON"` / `"OFF"`)

DAO (`LocationDao`):
- `insertLocation(location)` – uložení polohy
- `getLocationsBatch(limit)` – načtení dávky záznamů podle času (ASC)
- `deleteLocationsByIds(ids)` – smazání podle ID

## Síťový formát

Při odeslání (`SyncWorker`) se dávka konvertuje na pole JSON objektů:
- `device` (string) – `deviceId`
- `name` (string) – `deviceName`
- `latitude` (number)
- `longitude` (number)
- `speed` (number)
- `altitude` (number)
- `accuracy` (number)
- `satellites` (number)
- `power_status` (string)
- `client_type` (string, vždy `"APK"`)
- `timestamp` (string, ISO 8601 v UTC, např. `2025-01-01T12:00:00Z`)

Poznámka: Room databáze má verzi 2 (migrace `MIGRATION_1_2` přidává sloupec `powerStatus`).

Poznámka: Interně je `timestamp` v ms, před odesláním převáděn do ISO8601 UTC.