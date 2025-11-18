# Terminologie a doporučené pojmy

Tento soubor obsahuje doporučené překlady, termíny a pravidla použití pro dokumentaci v `docs_hw`, `docs_server` a `docs_apk`. Cílem je zajistit konzistentní pojmenování a čitelnost napříč kapitolami. Používejte tento seznam jako primární zdroj při psaní nebo revizi dokumentů.

Obecná pravidla
- Jazyk: spisovná čeština, formální neutrální tón. Vyhýbejte se hovorovým výrazům a zbytečnému používání angličtiny, pokud neexistuje silný důvod.
- Anglické konstanty, názvy API/parametrů a knihoven: ponechat v originální podobě a zvýraznit jako kód (např. `TURN_OFF`, `api/devices/input`, `Sequelize`).
- Příklady kódu: minimalizovat — pouze krátké, ilustrační ukázky. Dlouhé příklady odkazovat na samostatné soubory v repozitáři a ne vkládat je celé do kapitol.
- Grafy a schémata: preferovat vizuální znázornění (diagramy architektury, ER diagramy, časové osy, sekvenční diagramy, grafy pro datové toky). Obrázky ukládejte do relevantních podsložek (`docs_hw/schemas`, `docs_server/db_diagrams`, `docs_apk/image` apod.) a vždy přidejte popisek a stručný textový popis pod obrázkem.
- Formátování kódu: vždy u fenced code blocku uveďte jazyk (např. ```bash, ```json, ```javascript, ```c). Krátké příkazy a ukázky konfigurace ano; dlouhé skripty NE.

Preferované české termíny a poznámky
- zařízení — preferovaný překlad pro „device“; používá se tam, kde mluvíme o fyzickém trackeru nebo mobilním zařízení.
- firmware — ponechat anglicky; technický software běžící v zařízení (pokud chcete překlad, používejte „firmware (systémové softwarové vybavení zařízení)“ při prvním výskytu).
- hardware / HW — „hardware“ nebo zkratka „HW“; v textu preferovat „hardware" (bez uvozovek), ve schématech lze použít „HW".
- OTA — zkratka pro "Over‑The‑Air update"; při prvním výskytu rozepište v závorce: `OTA (Over‑The‑Air)` a pak používejte `OTA`.
- GPS fix / fix polohy — krátce „GPS fix“; vysvětlit při prvním použití.
- handshake — ponechat anglicky; popsat význam (výměna potvrzovacích zpráv mezi zařízením a serverem).
- dávka / batch — překlad pro batch odesílání záznamů; používejte „dávka“ v češtině.
- cache / cachování — používejte „cachování“ pro popis lokálního ukládání nepřenesených dat.
- LittleFS — název souborového systému; ponechat anglicky jako `LittleFS`.
- Room DB — ponechat jako `Room` nebo „Room DB“; vysvětlit, že jde o lokální SQLite abstrakci pro Android.
- WorkManager — ponechat originál (Android komponenta).
- foreground service — „foreground služba“ (pro Android). Popište krátce princip (s notifikací, vyšší priorita).
- background task / background — „na pozadí“; používejte český termín v textu.
- power_status — pokud uvádíte proměnné, vždy formátovat jako kód: `power_status` a stručně popsat možné hodnoty (`ON`, `OFF`, atd.).
- TURN_OFF — dělat zvýrazněně jako kód: `TURN_OFF` (používat konzistentně jako serverová instrukce).
- registration / register — „registrace" / „registrovat"; používejte české sloveso v popisu; konstanty/výzvy API ponechat v originální podobě.
- APN — ponechat zkratku; při prvním výskytu rozepíšeme: Access Point Name (APN).
- modem (SIMCOM A7670) — „modem“; technický název modelu vždy v kódu nebo v závorkách.
- LTE / GPRS / SIM — ponechat zkratky; vysvětlit v kontextu sítí, pokud je to potřeba.
- installationId — ponechat jako `installationId` a popsat způsob vytvoření (pokud se používá: např. hash z UUID).
- session_cookie — `session_cookie` (kódový formát pro proměnné/konstanty).
- EncryptedSharedPreferences — ponechat originál (Android API), vysvětlit stručně využití.
- deep‑sleep — technický termín pro úsporný režim ESP32; ponechat anglicky s krátkým vysvětlením při prvním použití.
- MCU / ESP32 — používat `ESP32`; MCU vysvětlit jako „mikrokontrolér (MCU)“ při prvním výskytu.
- NEO‑6M — název GPS modulu; ponechat originál.
- PlatformIO — nástroj pro vývoj a flash; ponechat originál.
- Sequelize / ORM / MySQL — ponechat originály; vysvětlit zkratky (ORM) při prvním výskytu.
- EJS / MVC / Controller / Model / View — ponechat originály a vysvětlit v krátkém odstavci v serverové dokumentaci.
- telemetry / telemetrie — preferovaný český termín „telemetrie“ pro popis dat o stavu (např. napájení, signál).

Poznámky k používání angličtiny a konstant
- Pokud je nutné použít anglický termín (název knihovny, API endpoint, proměnná), formátujte jej jako kód: `like_this`.
- Při prvním výskytu anglického zkratkového termínu vždy doplňte krátké vysvětlení v češtině.

Pravidla pro množství ukázek a detailů
- Minimalizovat: krátké ukázky (3–12 řádků) maximálně; delší se přesunou do samostatných souborů (odkazovaných).
- Zaměřit se spíše na koncept, datové toky a sekvence než na detailní výpisy kódu.
- Pro implementační detaily použijte poznámky „Implementační poznámky“ nebo sekci Appendix, nikoli hlavní kapitolu.

Doporučení pro vizualizace a data
- Preferovat diagramy: architektura (component diagram), sekvenční diagramy (device ↔ server handshake), ER diagramy pro DB, a časové grafy pro chování (např. spotřeba během wake/sleep cyklů).
- Grafy pro data: pokud popisujete datové toky nebo rozložení telemetrie, přidejte graf (sloupcový nebo časový) a stručný popis.
- Obrázky ukládejte do příslušné podsložky a pojmenujte konzistentně: `section-topic-v1.png`.
- Každý obrázek: nadpis, alt text, krátký popis a odkaz na zdrojová data, pokud je to relevantní.

Příklad správného použití (krátce)
- Špatně: "Zařízení posílá TURN_OFF a pak se vypne."
- Správně: "Zařízení obdrží instrukci `TURN_OFF` od serveru; následně provede zápis potvrzení do lokální cache a přejde do režimu `power_status = 'OFF'`. Viz sekvenční diagram v `docs_hw/schemas/handshake_sequence.png`."
