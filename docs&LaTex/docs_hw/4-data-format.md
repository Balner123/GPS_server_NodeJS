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

Poznámka k identifikátorům: firmware používá v uploadu jednotlivých záznamů klíč `device`, zatímco v handshake a registračních payloads používá `device_id`. Dokumentace níže zachovává tuto konvenci.

Další typ záznamu v dávce může obsahovat pouze stav napájení:

```json
{
	"device": "A1B2C3D4E5",
	"power_status": "OFF"
}
```

Ten se přidává tehdy, když je potřeba potvrdit serverem požadovaný shutdown.

## Dávkování

 - `send_cached_data()` ve stávající implementaci firmware čte dávky o maximální velikosti 15 záznamů (viz `MAIN/FINAL/file_system.cpp`, konstanta `MAX_BATCH_SIZE`). Serverem posílané nastavení `interval_send` je ukládáno do Preferences pod klíčem `batch_size`, ale aktuální kód používá interní limit 15 jako efektivní horní mez dávky. Poznámka: backend v současné konfiguraci akceptuje maximálně 15 záznamů v jedné dávce — pokusy o odeslání většího počtu mohou vést k chybě HTTP 500 ze serveru.
- Po úspěšném uploadu se z cache odebírá pouze odeslaná část, zbytek zůstává.
- Pokud odpověď obsahuje novou konfiguraci nebo registraci, uloží se okamžitě (Preferences).

# Formát dat a API

Tento dokument definuje přesnou podobu datových payloadů a chování komunikace mezi firmwarem a backendem. Preferujte krátké a stálé JSON payloady; rozsáhlejší ukázky uložte jako vzory v `docs_hw/schemas/`.

## Endpointy

- Upload dat: `POST http(s)://<server>[:<port>]/api/devices/input`
- Handshake: `POST http(s)://<server>[:<port>]/api/devices/handshake`
- Registrace (OTA): `POST http(s)://<server>[:<port>]/api/devices/register`

Poznámka: port 80 značí HTTP, jiný port než 443 znamená explicitně uvedené portování v URL; preferujte HTTPS.

## Struktura uploadu

Upload probíhá dávkově — jako pole JSON objektů. Každý objekt reprezentuje buď polohový záznam, nebo stavový záznam (např. potvrzení `power_status`).

Schematický příklad záznamu polohy (stručný):

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
	"timestamp": "2025-01-01T12:00:00Z"
}

Stavový záznam (příklad):

{
	"device": "<installationId>",
	"power_status": "OFF"
}

Poznámky k polím:
- `device` — identifikátor zařízení (posledních 10 hex znaků MAC bez dvojteček).
- `timestamp` — musí být ISO 8601 v UTC; interně se drží epoch milliseconds a serializuje se při odeslání.

## Dávkování a trvaní session

- `send_cached_data()` čte maximálně 15 záznamů na jeden upload (implementační limit `MAX_BATCH_SIZE`). Poznámka: server je navržen tak, aby bezpečně zpracoval až 15 položek; větší dávky mohou způsobit HTTP 500.
- Po úspěšném potvrzení jsou odeslané položky z cache odstraněny; neúspěšné položky zůstávají pro opakování.
- V průběhu jedné GPRS session probíhá nejprve handshake a následně upload dat.

## Formát odpovědi

Typická odpověď backendu (stručná):

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

- `success` — indikace přijetí dávky.
- `registered` — pokud `false`, zařízení přechází do bezpečného režimu.
- `config` — volitelné parametry, které zařízení aplikuje okamžitě.

HTTP stavové kódy a chování:
- 200: standardní odpověď s JSON → aplikovat konfiguraci.
- 403: vyžadovat odhlášení (FORCE_LOGOUT).
- 404/409: považovat za neregistrované zařízení → přepnout `registered=false`.
- ≥500 nebo síťová chyba: zachovat data v cache a opakovat později.

## Handshake

Handshake se provádí vždy před odesíláním dat v rámci GPRS session. Odesílaný payload (stručně):

{
	"device_id": "<installationId>",
	"client_type": "HW",
	"power_status": "ON|OFF"
}

Odpověď může obsahovat pole `registered`, `config` a `power_instruction` (`TURN_OFF` / `NONE`). Hodnota `TURN_OFF` by měla vést k potvrzení a následnému řízenému vypnutí.

## Registrace (OTA)

Endpoint `/api/devices/register` přijímá registrační payload obsahující `client_type`, `username`, `password`, `device_id` a `name`. Registrace vyžaduje aktivní GPRS spojení; po úspěchu se doporučuje restart do běžného režimu.

## Chování při chybách

- Neparsovatelná odpověď: logovat chybu, zachovat data v cache.
- Kritické chyby (`404`, `409`): přepnout `registered=false` a čekat na servisní zásah.
- Síťové chyby a 5xx: zachovat data a opakovat během dalšího cyklu.

