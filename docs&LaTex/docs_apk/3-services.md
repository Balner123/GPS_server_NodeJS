
# Služby a synchronizace

Tento dokument popisuje servisní komponenty aplikace, jejich odpovědnosti a očekávané chování při standardních i chybových stavech. Popisy jsou stručné a koncentrované.

## LocationService

- **Role**: Popřední služba zodpovědná za akvizici polohy a její lokální persistenci.
- **Řízení stavu**: Její spuštění a běh jsou plně pod kontrolou `PowerController`.
  - Pokus o spuštění služby je ignorován, pokud `PowerController` hlásí stav `OFF` nebo pokud je aktivní příznak `pending_turn_off_ack`.
  - Při ztrátě GPS nebo externím pokynu k zastavení služba provede řádný shutdown a informuje `PowerController`.
- **Start služby (pokud je povolen `PowerController`)**:
  1. Načtení provozních parametrů (`gps_interval_seconds`, `sync_interval_count`).
  2. Spuštění `HandshakeManager` pro ověření konfigurace se serverem.
  3. Aktivace periodických aktualizací polohy z `FusedLocationProviderClient`.
- **Persistování polohy**: Každý GPS fix se uloží do `Room` databáze. Pokud počet záznamů dosáhne `sync_interval_count`, je naplánován `SyncWorker`.

## HandshakeManager / HandshakeWorker

- **Role**: Orchestrace komunikace s endpointem `/api/devices/handshake` pro synchronizaci stavu a konfigurace.
- **Hlavní funkce**:
  - Zasílá na server aktuální stav zařízení (`power_status`, verze atd.).
  - Zpracovává odpověď:
    - **Nová konfigurace**: Uloží nové intervaly a v případě potřeby (služba běží a není požadován `TURN_OFF`) iniciuje restart `LocationService`.
    - **Instrukce `power_instruction`**:
      - `TURN_OFF`: Zavolá `PowerController.requestTurnOff()`, čímž spustí proces řízeného vypnutí.
      - `NONE` (nebo chybějící instrukce): Zavolá `PowerController.markTurnOffAcknowledged()`. Tímto mechanismem se resetuje příznak `pending_turn_off_ack` a služba může být znovu spuštěna.
- **Plánování**: Periodický `HandshakeWorker` běží každých 60 minut, aby byla zajištěna pravidelná synchronizace stavu. Tento plán je zrušen, pokud `PowerController` přejde do stavu `OFF`.

## SyncWorker

- **Role**: Spolehlivé dávkové odesílání záznamů na server a aplikace serverových instrukcí.
- **Podmínky**: Běží pouze s dostupným síťovým připojením (`NetworkType.CONNECTED`).
- **Chování**:
  1. Načte dávku (max. 50) záznamů z `location_cache`. Pokud `PowerController` hlásí `pending_turn_off_ack`, odesílání se přeruší a je upřednostněn `HandshakeManager`.
  2. Odešle data na `/api/devices/input`.
  3. **Při úspěchu (HTTP 200)**:
     - Smaže odeslané záznamy z lokální databáze.
     - Zpracuje případné konfigurační změny nebo `power_instruction` stejným způsobem jako `HandshakeManager` (předává řízení `PowerController`).
     - Po dokončení dávky spustí `HandshakeManager`, aby se server dozvěděl o aktuálním stavu.
  4. **Při chybě autorizace (HTTP 401/403)**: Vyšle broadcast `FORCE_LOGOUT`, který způsobí odhlášení uživatele a vyčištění session.
  5. **Při ostatních serverových nebo síťových chybách**: Vrátí `Result.retry()`, aby `WorkManager` naplánoval opakování.
