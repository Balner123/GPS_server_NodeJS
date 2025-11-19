# Konfigurace a perzistence

Tento dokument popisuje konfiguraci ukládanou ve firmware a pravidla pro její úpravu (OTA i zásahy serveru). Konfigurace je perzistentně uložena v `Preferences` (namespace `gps-tracker`).

## Možnosti konfigurace z OTA (uživatelská nastavení)

Uživatel (nebo servisní rozhraní OTA) může upravit následující hodnoty:

- `apn`, `gprsUser`, `gprsPass` — parametry pro připojení mobilní sítě.
- `server` (hostname) a `port` — cílový backend.
- `deviceName` — lidsky čitelný název zařízení.
- `ota_ssid`, `ota_password` — SSID a heslo pro servisní Wi‑Fi AP.

Změny jsou uloženy okamžitě a načteny při dalším běžném cyklu (`fs_load_configuration()`).

## Konfigurace řízená serverem

Server může překrýt provozní parametry prostřednictvím odpovědí na handshake nebo upload. Dva hlavní scénáře:

1) Handshake (`POST /api/devices/handshake`) — provádí se na začátku GPRS session a může vrátit konfigurační objekt, např.:
   - `config.interval_gps` → mapováno na lokální `sleepTime` (sekundy).
   - `config.interval_send` → mapováno na `batch_size` (1–50). Poznámka: server může poslat hodnotu pro `interval_send` a firmware ji uloží do Preferences pod klíčem `batch_size`, avšak v aktuální verzi firmwaru existuje interní implementační limit dávky (15 záznamů), který je aplikován při odesílání. Backend by měl očekávat maximálně 15 záznamů v jedné dávce — větší dávky mohou vyústit v HTTP 500 chybu.
   - `config.satellites` → `minSats` (minimální počet satelitů pro validní fix).
   - `config.mode` → `mode` (rezervováno pro budoucí logiku).
   - `registered` → `registered` (bool); pokud `false`, zařízení přechází do bezpečného vypnutí.
   - `power_instruction` → dočasná instrukce (`TURN_OFF` / `NONE`), aplikovaná v RAM a logovaná.

2) Odpověď na upload (`POST /api/devices/input`) — může obsahovat stejná pole jako handshake a potvrzení úspěchu; v případě pole `power_status` dochází ke zpracování potvrzení stavu.

Serverem přijaté hodnoty mají přednost před lokálními výchozími nastaveními; lokální změny uživatele však zůstávají v Preferences a mohou být opět přepsány při dalším handshaku.

## Klíčová perzistentní nastavení

- `sleepTime` — interval deep‑sleep v sekundách (výchozí 60).
- `minSats` — minimální počet satelitů pro validní fix (výchozí 1).
- `batch_size` — velikost dávky pro upload (spravováno serverem). Poznámka: hodnota je ukládána do Preferences, ale aktuální firmware uplatňuje implementační omezení (viz `MAIN/FINAL/file_system.cpp`) a efektivní horní mez dávky je 15. Backend by měl být nakonfigurován tak, aby bezpečně přijímal až 15 záznamů; zaslání větší dávky může způsobit HTTP 500.
- `registered` — boolean indikující registraci na backendu.
- `mode` — provozní mód (textová hodnota, serverem řízeno).

## Device ID a identifikace

- `deviceID` se neukládá do Preferences — generuje se při startu z MAC adresy ESP32 (posledních 10 hex znaků bez dvojteček).
- Výchozí SSID pro servisní režim: `lotrTrackerOTA_<DeviceID>`.
- `deviceID` se vždy zasílá v komunikaci s backendem (handshake, data, registrace).
