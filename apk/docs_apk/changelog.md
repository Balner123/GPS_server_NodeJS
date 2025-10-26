# Změny a opravy v dokumentaci (2025-10-26)

Tento soubor shrnuje nesoulady mezi kódem a původní dokumentací, které byly opraveny, a nově zdokumentované chování.

- Endpointy:
  - Přihlášení: `/api/apk/login` (potvrzeno kódem)
  - Registrace zařízení: `/api/apk/register-device` (původně bylo uvedeno `/api/devices/register/apk`)
  - Odeslání poloh: `/api/devices/input`
- Vynucené odhlášení:
  - Při HTTP 403 z endpointu pro odeslání poloh aplikace vyšle `FORCE_LOGOUT` a zobrazí dialog – nově zdokumentováno.
- Okamžitý fix polohy:
  - `LocationService` při startu vyžádá 1× aktuální polohu (před periodickým sledováním) – nově zdokumentováno.
- Aktualizace intervalů:
  - `SyncWorker` aplikuje nové intervaly z odpovědi serveru typicky při zpracování větší dávky (>10), následně restartuje službu – upřesněno.
- Cleartext traffic:
  - Manifest má `usesCleartextTraffic=true` (pro vývoj/testy). Doporučení pro produkci používat výhradně HTTPS – doplněno.
- Knihovny:
  - Použití `androidx.localbroadcastmanager` – explicitně doplněno v dokumentaci.
- UI modularizace:
  - V repo jsou ukázkové `FirstFragment`/`SecondFragment`, ale hlavní tok běží v `MainActivity`. Plán modularizace popsán v `UI_modularization.txt` – vysvětleno.
