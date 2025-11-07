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

- Port se používá i v tracker režimu (handshake + upload). Port 80 = HTTP, jinak HTTPS; pokud je port ≠443, přidává se do URL.
- OTA stránka `/testserver` zatím vrací simulovaný výsledek, proto nemusí odhalit chybu.

## Nejde se připojit k OTA Wi‑Fi po změně SSID/hesla

- Změna SSID/hesla se projeví až při dalším startu do OTA režimu.

## Nelze nahrát nový firmware

- Ujistěte se, že jste v OTA režimu (držte tlačítko na GPIO32 po resetu, dokud LED nezačne blikat) a jste připojeni k AP zařízení.
- Nahrávejte pouze `.bin` vytvořený pro dané prostředí (`default_envs` v `platformio.ini`).

## Tracker se po handshake vypne

- Server mohl vrátit `registered=false` nebo `power_instruction=TURN_OFF`.
- Zkontrolujte web administrace, zda je zařízení přiřazeno správnému účtu a zda nebyla odeslána instrukce k vypnutí.
