# Architektura firmware

Tento dokument vysvětluje, co zařízení dělá v běžném (Tracker) režimu.

## Cyklus práce

1) Probuzení z hlubokého spánku
2) Zapnutí externího GPS a čtení NMEA (SoftwareSerial 32/33)
3) Čekání na fix (limit 5 minut) s podmínkou minimálního počtu satelitů (výchozí 7)
4) Uložení záznamu do cache (`/gps_cache.log`) při úspěšném fixu
5) Pokud je dosažená velikost dávky (nebo existují stará data), inicializace modemu a GPRS → odeslání dávky
6) Případné aktualizace parametrů ze serveru
7) Vypnutí modemu a přechod do hlubokého spánku

`loop()` je prázdná – vše probíhá v `setup()` a po dokončení jde zařízení spát.

## GPS zpracování

- Knihovna: `TinyGPS++`
- Sériová linka: SoftwareSerial, 9600 bps
- Validace fixu: platná pozice, datum/čas, satelity ≥ `minSatellitesForFix`
- Ukládané hodnoty: lat, lon, speed (km/h), altitude (m), HDOP, počet satelitů, UTC timestamp

Pokud fix neproběhne, nic se do cache nepřidá a nic se neodesílá v tomto cyklu.

## Dávkování a cache (LittleFS)

- Soubor: `/gps_cache.log`, každý řádek je jeden JSON objekt (jedna pozice)
- Při odesílání se čte až 50 řádků a sestaví se JSON pole – to se odešle najednou
- Po úspěchu se odeslaná část z cache odstraní, zbytek zůstává na další pokus

## Odesílání na server (HTTP/HTTPS)

- Metoda: POST na cestu `/api/devices/input` proti hostu a portu z nastavení
- Transport: SIMCOM HTTP(S) API přes `TinyGsm`
- Schéma a port:
	- pokud je nastaven port 80 → `http://<host>:80/...`
	- jinak → `https://<host>[:<port>]/...` (port se přidá, pokud není 443)

## Parametry řízené serverem

Server může v odpovědi změnit:

- `interval_gps` – interval spánku (s)
- `interval_send` – velikost dávky (1–50)
- `satellites` – minimální počet satelitů nutných pro uznání fixu

Pokud server vrátí `registered=false`, firmware nastaví příznak neregistrovaného zařízení a po dokončení cyklu uspí zařízení na neurčito (vyžaduje zásah – servisní režim a registraci).
