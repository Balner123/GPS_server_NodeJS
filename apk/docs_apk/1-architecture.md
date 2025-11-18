# Architektura a komponenty

Tento dokument popisuje architekturu a hlavní komponenty mobilní aplikace (Android). Text je formální a věcný; implementační detaily přesahující stručné vysvětlení jsou umístěny do samostatných souborů nebo do ukázkových zdrojů v repozitáři.

## Přehled komponent

- **ApiClient**: Centralizovaný klient pro veškerou HTTP komunikaci se serverem. Obsahuje metody pro přihlášení, registraci, handshake, odesílání dat a odhlášení. Odstraňuje duplicitní síťový kód.

- **ServiceStateRepository**: Singleton objekt, který drží aktuální stav `LocationService` pomocí `StateFlow`. Umožňuje `MainActivity` (a dalším komponentám) reaktivně sledovat stav služby.

- **LoginActivity**: Zajišťuje autentizaci uživatele a registraci zařízení prostřednictvím `ApiClient`. Zabezpečeně ukládá `session_cookie` a `device_id` pomocí `EncryptedSharedPreferences`.

- **MainActivity**: Hlavní obrazovka pro prezentaci stavu služby a ovládání (start/stop, odhlášení). Sleduje aktuální stav služby pomocí `ServiceStateRepository` (`StateFlow`). Zobrazuje telemetrické údaje a stavové zprávy, včetně banneru pro serverové instrukce.

- **LocationService (foreground service)**: Odpovídá za akvizici polohy. Její životní cyklus je řízen `PowerController`. Aktualizuje stav služby v `ServiceStateRepository`.

- **SyncWorker (WorkManager)**: Provádí dávkové odesílání záznamů na `/api/devices/input` prostřednictvím `ApiClient`. Zpracovává odpovědi serveru, včetně konfiguračních změn a instrukce `TURN_OFF`, kterou předává `PowerController`.

- **HandshakeManager / HandshakeWorker**: Orchestruje komunikaci s `/api/devices/handshake` pomocí `ApiClient`. Aplikuje konfiguraci ze serveru a interpretuje `power_instruction`, kterou rovněž předává `PowerController`.

- **PowerController**: Klíčová komponenta pro správu stavového stroje napájení (`ON`/`OFF`). Centralizuje logiku pro zpracování instrukce `TURN_OFF`. Zajišťuje, že služba zůstane neaktivní, dokud není `TURN_OFF` instrukce potvrzena a zrušena serverem. Spravuje příznak `pending_turn_off_ack`.

- **AppDatabase (Room)**: Lokální perzistentní úložiště pro `CachedLocation`, které slouží jako cache pro případ dočasné nedostupnosti sítě.

- **Pomocné moduly**:
  - `SharedPreferencesHelper`: Abstrakce pro bezpečné čtení a zápis do `EncryptedSharedPreferences`.
  - `ConsoleLogger`: Centralizovaný logger pro diagnostiku a monitoring v reálném čase.
  - `ServiceState`, `StatusMessages`: Datové a stavové objekty pro komunikaci.

## Datové toky a rozhraní

Základní tok dat a instrukcí je následující:

1.  **Sběr dat**: `LocationService` v aktivním stavu (`power_status = 'ON'`) získává polohu a ukládá ji jako `CachedLocation` do `Room` databáze.
2.  **Synchronizace**: `SyncWorker` se periodicky spouští, načítá dávku dat z `Room` a odesílá ji na server (`/api/devices/input`).
3.  **Zpracování odpovědi**: Server může v odpovědi poslat konfigurační změny nebo instrukci (`power_instruction`).
    -   **Změna konfigurace**: `SyncWorker` nebo `HandshakeManager` uloží nové intervaly a v případě potřeby iniciuje restart `LocationService`.
    -   **Instrukce `TURN_OFF`**:
        a. `SyncWorker` nebo `HandshakeManager` zavolá `PowerController.requestTurnOff()`.
        b. `PowerController` nastaví interní stav na `OFF`, uloží příznak `pending_turn_off_ack = true` a zastaví `LocationService`.
        c. Jakákoli další snaha o spuštění služby je blokována, dokud `pending_turn_off_ack` je `true`.
4.  **Potvrzení (Acknowledgement)**: `HandshakeManager` v rámci periodického handshake informuje server o svém stavu (`power_status = 'OFF'`). Když server odpoví bez `power_instruction = 'TURN_OFF'`, `HandshakeManager` zavolá `PowerController.markTurnOffAcknowledged()`, který resetuje `pending_turn_off_ack` na `false`. Tím je cyklus uzavřen a službu lze opět spustit.

Pro detailní sekvenční schémata registrace, handshake a dávkového odeslání viz `docs_apk/image/`.

## Konvence a doporučení pro implementaci

- Veškeré konstanty a názvy proměnných uvádějte ve formátu kódu (např. `TURN_OFF`, `installationId`).
- Krátké ukázky konfigurace nebo příkazů jsou prípustné; rozsáhlé kódové ukázky se ukládají mimo hlavní dokumentaci.
- Pro asynchronní a časově závislé procesy použijte jasné diagramy (sekvenční nebo časové grafy) namísto dlouhých textových popisů.

## Použité knihovny (výběr)

- Google Play Services Location
- Room
- WorkManager
- EncryptedSharedPreferences
- Gson
- LocalBroadcastManager
- Coroutines
- Material

---
Poslední aktualizace: 2025-11-18
