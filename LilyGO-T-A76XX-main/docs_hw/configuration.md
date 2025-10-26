# Konfigurace a perzistence

Nastavení je možné měnit v servisním (OTA) režimu na stránce `Settings`.

## Co lze nastavit

- APN, GPRS user, GPRS password
- Server hostname a Port (port se používá pro odesílání dat i test; port 80 → HTTP, jinak HTTPS; pokud je port ≠ 443, přidá se do URL)
- Device Name (odesílá se v každém záznamu)
- OTA SSID a heslo (platí při dalším startu do OTA)

Uložené položky se zapisují do `Preferences` prostoru `gps-tracker`.

## Hodnoty ze serveru

- `interval_gps` – interval hlubokého spánku (v sekundách)
- `interval_send` – velikost dávky (1–50), ukládá se do `Preferences` pod klíčem `batch_size`
- `satellites` – minimální počet satelitů pro fix

Tyto hodnoty nastavuje server v odpovědi na odeslání dávky. Pokud server nic neposkytne, ponechá se lokální nastavení.

## Device ID

- `deviceId` je odvozen z MAC adresy ESP32: vezme se posledních 10 znaků MAC bez dvojteček.
- Výchozí SSID pro OTA obsahuje `deviceId`: `lotrTrackerOTA_<DeviceID>`.
- ID je zobrazeno na hlavní stránce v OTA režimu a posílá se v každém záznamu.
