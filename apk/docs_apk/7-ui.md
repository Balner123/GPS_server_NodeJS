# Uživatelské rozhraní

Tato kapitola popisuje UI komponenty aplikace s důrazem na jasnou prezentaci stavu služby a jednoduché ovládání. Uživatelé vidí pouze informace relevantní pro provoz aplikace; detaily pro vývoj jsou skryty v debug režimu.

## Login obrazovka

- Pole pro identifikaci uživatele a heslo.
- Volitelné pole pro `server_url` (přístupné přes speciální gesto v UI).
- Po úspěšném přihlášení aplikace bezpečně uloží `session_cookie`, `device_id` a provozní intervaly (`gps_interval_seconds`, `sync_interval_count`).
- Pokud zařízení není registrováno, provede se registrace vůči serveru (`POST /api/devices/register`).

## Hlavní obrazovka (MainActivity)

- **Hlavní ovládací prvek**: Přepínač (`ON`/`OFF`) pro spuštění/ukončení `LocationService`.
- **Zobrazené hodnoty**:
  - Stav služby (aktivní / zastavená / pozastaveno serverem).
  - Stav poslední synchronizace.
  - Odpočet do další plánované aktualizace polohy.
  - Počet záznamů v lokální cache.
  - Indikátor provozního stavu (`power_status`).
- **Speciální UI stavy**:
  - **Banner se serverovou instrukcí**: Pod hlavním přepínačem se zobrazuje informační banner (`serverInstructionBanner`), pokud aplikace čeká na potvrzení instrukce `TURN_OFF`. Informuje uživatele, že služba byla pozastavena na pokyn serveru.
  - **Deaktivovaný přepínač**: Hlavní přepínač je neaktivní (disabled), pokud je příznak `pending_turn_off_ack` nastaven na `true`. Tím se zabrání konfliktu mezi uživatelským vstupem a serverovou instrukcí.
- **Interakce**:
  - **Krátký stisk přepínače**: Spustí nebo zastaví `LocationService`, pokud to `PowerController` dovolí (tj. není aktivní `pending_turn_off_ack`).
  - **Dlouhý stisk přepínače**: Zobrazí potvrzovací dialog pro odhlášení. Po potvrzení se vyčistí lokální session a zavolá se `POST /api/apk/logout`.
  - **Dlouhý stisk na konzoli**: Otevře dialog pro filtrování logů podle úrovně (Debug, Info, Warn, Error).
