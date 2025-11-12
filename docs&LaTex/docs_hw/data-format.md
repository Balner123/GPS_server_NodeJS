# Formát dat a API

Tento dokument popisuje, jak firmware v `MAIN/FINAL` komunikuje s backendem.

## Endpointy

- **Upload dat:** `POST http(s)://<server>[:<port>]/api/devices/input`
- **Handshake:** `POST http(s)://<server>[:<port>]/api/devices/handshake`
- **Registrace (OTA):** `POST http(s)://<server>[:<port>]/api/devices/register`

Port 80 ⇒ HTTP, cokoliv jiného ⇒ HTTPS (pokud port není 443, přidá se do URL).

## Obsah uploadovaných dat

Upload probíhá v dávkách (JSON pole). Každý záznam odpovídá jednomu řádku v cache:

- `device` – ID (posledních 10 znaků MAC, bez `:`)
- `name` – jméno zařízení (nastavitelné)
- `latitude`, `longitude`
- `speed` – km/h
- `altitude` – m
- `accuracy` – HDOP
- `satellites`
- `timestamp` – `YYYY-MM-DDThh:mm:ssZ`, pokud GPS poskytne datum i čas

Další typ záznamu v dávce může obsahovat pouze stav napájení:

```json
{
	"device": "A1B2C3D4E5",
	"power_status": "OFF"
}
```

Ten se přidává tehdy, když je potřeba potvrdit serverem požadovaný shutdown.

## Dávkování

- `send_cached_data()` čte až 50 řádků z `/gps_cache.log`.
- Po úspěšném uploadu se z cache odebírá pouze odeslaná část, zbytek zůstává.
- Pokud odpověď obsahuje novou konfiguraci nebo registraci, uloží se okamžitě (Preferences).

## Odpověď na upload

Očekává se JSON, typicky:

```json
{
	"success": true,
	"registered": true,
	"config": {
		"interval_gps": 120,
		"interval_send": 5,
		"satellites": 4,
		"mode": "batch"
	}
}
```

- `success` – potvrzení, že dávka byla přijata.
- `registered` – pokud `false`, firmware přepne do trvalého vypnutí.
- `config` – volitelné překryté nastavení (viz `configuration.md`).
- Při 404 nebo 409 se považuje zařízení za neregistrované; při 5xx a 0 se data v cache zachovají.

## Handshake

Při každé modem session probíhá handshake před uploadem. Odesílaný payload:

```json
{
	"device_id": "A1B2C3D4E5",
	"client_type": "HW",
	"power_status": "ON"
}
```

Odpověď může obsahovat:

- `registered` – viz výše.
- `config` – stejné klíče jako u uploadu.
- `power_instruction` – zatím `TURN_OFF` nebo `NONE`. Hodnota `TURN_OFF` způsobí, že po potvrzení serveru zařízení provede `graceful_shutdown()`.

## Registrace (OTA)

Endpoint `/api/devices/register` přijímá JSON:

```json
{
	"client_type": "HW",
	"username": "user@example.com",
	"password": "***",
	"device_id": "A1B2C3D4E5",
	"name": "Tracker-1"
}
```

Výsledek se zobrazí v OTA rozhraní; zároveň se doporučuje po úspěšné registraci restartovat do běžného režimu.

## Chování při chybách

- Neparsovatelná odpověď: firmware vypíše chybu, ale data z cache ponechá.
- HTTP 404/409: `registered=false`, zařízení se vypne a čeká na zásah.
- HTTP ≥500 nebo přenosová chyba: data zůstávají v cache, pokusí se znovu v dalším cyklu.
