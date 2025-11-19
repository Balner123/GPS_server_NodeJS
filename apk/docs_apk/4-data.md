# Datový model a perzistence

Tento dokument popisuje datovou strukturu lokální persistence a síťový formát používaný při dávkovém odesílání záznamů.

## Lokální persistnce (Room)

- Databáze: `gps_reporter_database`
- Entita: `CachedLocation` (tabulka `location_cache`)

Hlavní pole entity `CachedLocation`:
- `id: Int` — primární klíč (autoincrement).
- `latitude: Double` — zeměpisná šířka.
- `longitude: Double` — zeměpisná délka.
- `speed: Float` — rychlost v km/h (interně m/s, přepočet při serializaci).
- `altitude: Double` — nadmořská výška v metrech.
- `accuracy: Float` — přesnost v metrech (`-1` pokud není k dispozici).
- `satellites: Int` — počet satelitů (pokud dostupné v `Location.extras`).
- `timestamp: Long` — epoch milliseconds (UTC).
- `deviceId: String` — `installationId` zařízení.
- `deviceName: String` — lidsky čitelný název zařízení.
- `powerStatus: String` — provozní stav (`"ON"` / `"OFF"`).

DAO operace (přehled):
- `insertLocation(location)` — vložení záznamu.
- `getLocationsBatch(limit)` — načtení dávky záznamů (ASC podle `timestamp`).
- `deleteLocationsByIds(ids)` — odstranění potvrzených záznamů.

## Síťový formát (payload)

Při odeslání dávky `SyncWorker` serializuje položky na pole JSON objektů se strukturou níže. Preferrujte stručný payload a v případě potřeby doplňte další metadatumy v separátním poli `meta`.

Příklad (schematicky):

{
	"device": "<installationId>",
	"name": "<deviceName>",
	"latitude": <number>,
	"longitude": <number>,
	"speed": <number>,
	"altitude": <number>,
	"accuracy": <number>,
	"satellites": <number>,
	"power_status": "ON|OFF",
	"client_type": "APK",
	"timestamp": "2025-01-01T12:00:00Z"
}

Popis polí:
- `device` — identifikátor zařízení (`installationId`).
- `name` — uživatelsky čitelný název zařízení.
- `latitude`, `longitude` — souřadnice.
- `speed` — rychlost (v km/h).
- `altitude` — výška v metrech.
- `accuracy` — přesnost v metrech.
- `satellites` — počet satelitů, pokud dostupné.
- `power_status` — stav služby (`ON`/`OFF`).
- `client_type` — typ klienta (`APK`).
- `timestamp` — ISO 8601 čas v UTC (před odesláním převést z epoch ms).

Poznámky:
- Interně se `timestamp` ukládá jako epoch milliseconds; při serializaci na JSON konvertuje do ISO 8601 (UTC).