# Dokumentace aplikace GPS Reporter (APK)

Toto je vstupní bod dokumentace. Obsah byl rozdělen do více přehledných částí a aktualizován podle aktuálního zdrojového kódu.

- Přehled a cíle: viz `overview.md`
- Architektura a komponenty: viz `architecture.md`
- Služby a synchronizace: viz `services.md`
- Datový model a perzistence: viz `data.md`
- API a síťová komunikace: viz `api.md`
- Konfigurace a nastavení: viz `config.md`
- Uživatelské rozhraní: viz `ui.md`
- Build a spuštění: viz `setup.md`
- Změny a nesoulady, které byly opraveny v dokumentaci: viz `changelog.md`

Klíčové body, které byly v dokumentaci upřesněny podle kódu:

- Přihlášení probíhá na `/api/apk/login`, registrace zařízení na `/api/apk/register-device` (nikoli `/api/devices/register/apk`).
- Odesílání poloh probíhá na `/api/devices/input` pomocí `SyncWorker` po dosažení prahu uložených pozic.
- Aplikace při startu služby provede i okamžité jednorázové zjištění polohy.
- Při chybě 403 z API probíhá vynucené odhlášení a zobrazení dialogu v aplikaci.
- Povolené cleartext spojení je v manifestu aktivní (`usesCleartextTraffic=true`) pro vývoj/testy; v produkci doporučujeme vypnout a používat výhradně HTTPS.
- Využívá se `LocalBroadcastManager` pro komunikaci stavu mezi `LocationService` a `MainActivity`.

Podrobnosti k výše uvedeným bodům a dalším aspektům najdete v odkazovaných souborech v této složce.
