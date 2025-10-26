# Troubleshooting

## Nemohu se registrovat v OTA (GPRS Failed)

- Zkontrolujte SIM, kredit a signál.
- V `Settings` nastavte správné APN a uložte; zkuste `Test` u GPRS.
- Po změnách APN zkuste znovu registraci.

## Zařízení neposílá data

- Pokud se nedaří získat GPS fix, nic se neukládá a nic se neodešle.
- Zvyšte viditelnost oblohy nebo snižte limit satelitů (server může poslat nižší `satellites`).
- Zkontrolujte, že je baterie nabitá a GPS napájení (GPIO5) funguje.

## Data se neposílají, i když jsou v cache

- Odesílání probíhá až po dosažení velikosti dávky nebo když zůstala stará data v cache.
- Zkontrolujte GPRS připojení (APN) a konektivitu k serveru.

## „Server Port“ v Settings nic nemění

- V aktuální verzi má vliv pouze na test spojení v OTA režimu (`/testserver`).
- Odesílání dat (HTTPS) běží vždy na portu 443.

## Nejde se připojit k OTA Wi‑Fi po změně SSID/hesla

- Změna SSID/hesla se projeví až při dalším startu do OTA režimu.

## Nelze nahrát nový firmware

- Ujistěte se, že jste v OTA režimu (GPIO23 na 3.3V) a jste připojeni k AP zařízení.
- Nahrávejte pouze `.bin` vytvořený pro dané prostředí (`default_envs` v `platformio.ini`).
