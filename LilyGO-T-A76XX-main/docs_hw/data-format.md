# Formát dat a API

Tento dokument popisuje, co zařízení odesílá na server a co naopak od serveru očekává.

## Endpointy

- Odesílání dat: `POST http(s)://<server>[:<port>]/api/devices/input` (schéma a port dle konfigurace: port 80 → HTTP, jinak HTTPS)
- Registrace v OTA: `POST https://<server>/api/hw/register-device`

## Jednotlivý záznam (objekt)

Položky odesílané při úspěšném GPS fixu:

- `device` – unikátní ID (posledních 10 znaků MAC)
- `name` – jméno zařízení (nastavitelná hodnota)
- `latitude`, `longitude`
- `speed` (km/h)
- `altitude` (m)
- `accuracy` (HDOP)
- `satellites`
- `timestamp` – UTC ve formátu `YYYY-MM-DDThh:mm:ssZ` (pokud jej GPS poskytne)

Pokud není fix, záznam se NEvytváří a nic se v daném cyklu neodešle.

## Dávkové odesílání

- Firmware načte až 50 řádků ze souboru `/gps_cache.log` a zformuje JSON pole: `[ {record1}, {record2}, ... ]`.
- Po úspěšném přijetí serverem z cache odstraní odeslanou část a případně ponechá zbytek na další cyklus.

## Odpověď serveru

Server může volitelně vrátit JSON s těmito položkami:

- `success` (bool) – úspěch zpracování dávky
- `registered` (bool) – pokud `false`, firmware se uspí „na neurčito“ a čeká na zásah
- `interval_gps` (number) – interval spánku v sekundách (přebije lokální hodnotu)
- `interval_send` (number 1..50) – velikost dávky; uloží se do Preferences
- `satellites` (number) – požadované minimum satelitů pro uznání fixu

Neparsovatelná odpověď je tolerována (hodnoty se nezmění), ale v logu se vytiskne chyba.
