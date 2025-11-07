# GPS Tracker – přehled a rychlý start

Tento projekt obsahuje firmware pro GPS tracker postavený na desce LilyGO (ESP32 + 4G modem A76xx). Níže je rychlý přehled a odkazy na detailní kapitoly.

## Co to umí

- Periodické zjišťování polohy z externího GPS modulu (NEO‑6M nebo kompatibilní)
- Odesílání dat na server přes LTE/GPRS (HTTPS)
- Chytré cachování do LittleFS a dávkové odesílání (nižší spotřeba, vyšší spolehlivost)
- Odolnost vůči výpadkům sítě (data se uchovají a doženou se později)
- Dva režimy: běžný „Tracker“ a servisní „OTA/Service“ režim

Podrobná dokumentace je rozdělena do několika souborů:

- `docs_hw/hardware.md` – zapojení, piny, napájení, tlačítko pro OTA
- `docs_hw/firmware.md` – architektura, cyklus spánku, práce s GPS a modemem
- `docs_hw/ota.md` – servisní režim, registrace, nastavení, OTA aktualizace
- `docs_hw/data-format.md` – formát odesílaných dat, handshake a dávkování
- `docs_hw/configuration.md` – přenastavení APN/serveru/OTA Wi‑Fi, chování řízené serverem
- `docs_hw/troubleshooting.md` – časté problémy a jejich řešení

## Build a nahrání (PlatformIO)

1. Otevřete root projektu (`LilyGO-T-A76XX-main`) v VS Code s PlatformIO.
2. V `platformio.ini` je implicitně nastaveno `default_envs = T-Call-A7670X-V1-0` a `src_dir = MAIN`.
3. První nasazení: v sekci PlatformIO spusťte „Upload Filesystem Image“ (inicializace LittleFS).
4. Poté nahrajte firmware („Upload“).

## První spuštění a párování zařízení

Zařízení se páruje přes servisní (OTA) režim – bez potřeby ruční registrace na serveru.

1. Přepněte zařízení do servisního režimu: **po připojení napájení a restartu držte tlačítko (GPIO32) stisknuté alespoň 2 s**.
2. Po rozblikání LED tracker vytvoří Wi‑Fi AP se SSID dle nastavení (výchozí „lotrTrackerOTA_<DeviceID>“; lze změnit v Nastavení).
3. Připojte se (výchozí heslo je „password“, lze změnit v Nastavení) a v prohlížeči otevřete `http://192.168.4.1`.
4. Na úvodní stránce uvidíte stav připojení k mobilní síti (GPRS). Registrace vyžaduje aktivní GPRS.
5. Vyplňte své přihlašovací jméno a heslo k serveru a odešlete „Register Device“.
6. Po úspěchu zařízení vypněte (tlačítkem nebo odpojením napájení) a znovu zapněte bez držení tlačítka – poběží v tracker režimu.

Poznámky

- SSID i heslo OTA lze nastavit v servisním režimu v nabídce „Settings“. Změna se projeví po dalším restartu a opětovném vstupu do OTA režimu.
- Při prvním zapnutí v běžném režimu se zařízení řídí implicitními hodnotami; intervaly a dávkování může později přenastavit server v odpovědi.
