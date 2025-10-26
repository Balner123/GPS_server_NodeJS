# Uživatelské rozhraní

## Login obrazovka
- Pole: uživatel, heslo
- Skryté pole pro URL serveru (odhalí se dlouhým stiskem názvu aplikace v horní části)
- Po úspěšném přihlášení:
  - Uloží `session_cookie`, `device_id`, intervaly `gps_interval_seconds`, `sync_interval_count`
  - Pokud zařízení není registrované, proběhne registrace (`/api/apk/register-device`)

## Hlavní obrazovka (MainActivity)
- Přepínač ON/OFF pro start/stop `LocationService`
- Texty:
  - Stav služby (aktivní/zastavená)
  - Poslední stav připojení / synchronizace
  - Odpočet do další aktualizace
  - Počet pozic v mezipaměti
- Konzole logů (automatický scroll dolů, limit ~100 řádků)
- Dlouhý stisk přepínače: potvrzení a odhlášení uživatele
- Dlouhý stisk karty konzole: vymazání konzole

## Fragmenty
- V projektu jsou přítomny ukázkové `FirstFragment`/`SecondFragment` a Navigation graf, ale hlavní logika běží v `MainActivity`.
- Plán modularizace UI do fragmentů je popsán v `UI_modularization.txt` (zatím neaplikováno v hlavním toku aplikace).
