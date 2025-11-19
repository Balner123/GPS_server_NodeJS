# Přehled aplikace

Aplikace slouží ke spolehlivému sběru GPS polohy na zařízení se systémem Android a k dávkovému odesílání nasbíraných pozic na server.

## Cíle aplikace
- zajistit spolehlivý sběr polohových dat při minimálních výpadcích;
- zabezpečit odolnost vůči přechodným výpadkům sítě prostřednictvím lokálního cachování a dávkového odesílání;
- umožnit bezpečné přihlášení a správu session (šifrované úložiště pro tokeny a konfigurace);
- zajistit vzdálenou konfiguraci provozních parametrů (intervaly, limity, instrukce jako `TURN_OFF`);
- poskytovat telemetrii napájení a stavu služby za účelem monitoringu a optimalizace.

## Logické vrstvy aplikace

Architektura je rozdělena do čtyř hlavních logických vrstev, které zajišťují oddělení odpovědností a robustnost systému.

- **Uživatelské rozhraní (UI Layer)**: Zahrnuje `Activity` a `Fragment` komponenty (`LoginActivity`, `MainActivity`), které se starají o interakci s uživatelem, zobrazování stavových informací a sběr vstupů.
- **Servisní vrstva (Service Layer)**: Jádrem je `LocationService`, popřední služba, která zajišťuje nepřetržitý sběr polohových dat bez ohledu na to, zda je aplikace viditelná.
- **Datová a synchronizační vrstva (Data & Sync Layer)**: Komponenty jako `Room` databáze (`AppDatabase`) a `SyncWorker` (spravovaný `WorkManagerem`) zodpovídají za bezpečné uložení dat na zařízení a jejich spolehlivou synchronizaci se serverem.
- **Řízení stavu a konfigurace (State & Configuration Layer)**: Seskupuje utility jako `PowerController`, `HandshakeManager` a `SharedPreferencesHelper`. Tyto moduly spravují provozní stav (`power_status`), aplikují konfiguraci ze serveru a zpracovávají vzdálené instrukce (`TURN_OFF`).

## Přehled hlavních komponent

- **LoginActivity**: Odpovídá za autentizaci uživatele a registraci zařízení vůči serveru.
- **MainActivity**: Zobrazovací vrstva a ovládací prvky uživatele (stav služby, poslední události, ovládání ON/OFF).
- **LocationService**: Popřední služba zodpovědná za akvizici polohy a její zápis do lokální databáze.
- **SyncWorker**: Zajišťuje dávkovou synchronizaci záznamů na server a zpracování odpovědí.
- **HandshakeManager / HandshakeWorker**: Orchestruje obousměrnou výměnu konfiguračních parametrů a potvrzování stavů.
- **PowerController**: Spravuje stavový stroj napájení (`ON`/`OFF`) a logiku pro zpracování a potvrzení instrukce `TURN_OFF`.
- **AppDatabase (Room)**: Lokální perzistentní úložiště pro `CachedLocation` záznamy.

-Sekvenční diagramy znázorňující registraci, handshake a dávkové odesílání jsou doporučeny v `docs_apk/image/` (viz návrhy ke každé sekci).

## Tok dat (stručně)
1) Snímek polohy získá `LocationService` a uloží jej do lokální tabulky `location_cache`.
2) Po dosažení definovaného prahu nebo podle plánovače spouští `SyncWorker` dávkové odeslání na server.
3) Server ověří příchozí dávku, vrátí případné instrukce (např. aktualizaci intervalů nebo `TURN_OFF`).
4) V případě instrukce `TURN_OFF` aplikace provede potvrzení změny (handshake), aktualizuje `power_status` a vypne službu.
