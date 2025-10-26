# Analýza funkčnosti firmwaru (aktuální stav)

Tento dokument shrnuje klíčové chování `MAIN/gps_tracker.ino` a opravuje dřívější nepřesnosti.

## Základní princip: probuzení → práce → hluboký spánek

- Veškerá logika probíhá v `setup()`; `loop()` se nevyužívá.
- Zařízení se probudí, provede jednu „práci“ a přejde do hlubokého spánku na nastavený interval.

## Režimy

1) Tracker (výchozí)

- GPS (externí přes SoftwareSerial na pinech 32/33, napájení pin 5) se zapne, čeká se na fix až 5 minut.
- Pokud se získá platný fix s minimálním počtem satelitů (výchozí 7; lze změnit ze serveru), hodnoty se uloží jako JSON řádek do `LittleFS` souboru `/gps_cache.log` a počítadlo cyklů se zvýší.
- Pokud se fix NEzíská, nic se do cache NEpřidá a cyklus se bez odesílání ukončí spánkem. Dřívější dokumentace chybně uváděla, že se odesílá chybová zpráva – v aktuálním kódu se při neúspěšném fixu neodesílá nic.
- Odesílání probíhá pouze při dosažení „batch size“ (implicitně 1; lze měnit ze serveru) nebo když v cache zůstala stará data. Odesílají se dávky až 50 záznamů ve formátu JSON pole.
- Server může v odpovědi změnit:
  - `interval_gps` – interval spánku (sekundy),
  - `interval_send` – velikost dávky (1–50),
  - `satellites` – minimální počet satelitů pro uznání fixu.
- Pokud server vrátí `registered=false`, zařízení po dokončení cyklu usne „na neurčito“ (k probuzení je pak nutné použít servisní režim a registraci).

2) Servisní/OTA

- Aktivuje se přivedením GPIO23 (otaPin) na 3.3V při startu.
- Modem se inicializuje a zařízení se pokusí připojit k GPRS (kvůli registraci a testům). Stav „GPRS Connected/Failed“ je zobrazen na titulní stránce.
- Spustí se Wi‑Fi AP s konfigurovatelným SSID (výchozí „lotrTrackerOTA“) a heslem („password“). Web běží na `http://192.168.4.1`.
- Funkce webu:
  - „Register Device“ – po zadání uživatele/hesla zavolá POST na `/api/hw/register-device` s `deviceId` (posledních 10 znaků MAC),
  - „Settings“ – nastavení APN, GPRS user/pass, server host, OTA SSID/heslo; včetně tlačítek „Test“ pro GPRS a TCP spojení na zadaný host:port,
  - „Firmware Update“ – nahrání `.bin` a OTA aktualizace.

Pozn.: Položka „Server Port“ je v současné verzi použita pouze pro test spojení v servisním režimu. Samotné odesílání dat z tracker režimu probíhá vždy přes HTTPS na portu 443, proměnná `port` se v URL dosud nevyužívá.

## Přepínače a napájení

- „OTA přepínač“: GPIO23 → 3.3V = servisní/OTA režim.
- Hlavní vypínač napájení je mimo logiku firmwaru.
- ESP32 používá hluboký spánek řízený časovačem; výchozí interval je 60 s a může být změněn serverem.
