# Rozcestník dokumentace (STRUCTURE.md)

Tento soubor slouží jako navigační mapa a stručný průvodce obsahem složky `docs&LaTex`. Níže naleznete popis jednotlivých sekcí, klíčové soubory a jejich účel v rámci projektu GPS sledovacího systému (LOTR).

## Kořenový adresář

- **`LITERATURE.md`**: Seznam použité literatury a zdrojů.
- **`TERMINOLOGY.md`**: Slovník pojmů a zkratek používaných v projektu.
- **`structure.md`**: Tento soubor (rozcestník).

## docs_apk/ (Dokumentace mobilní aplikace)
Dokumentace pro klientskou Android aplikaci.

- **Hlavní kapitoly:**
  - `0-overview.md`: Přehled aplikace a její účel.
  - `1-architecture.md`: Architektura aplikace (MVVM, moduly).
  - `3-services.md`: Služby na pozadí (lokalizace, komunikace).
  - `4-data.md`: Správa dat, lokální databáze (Room).
  - `5-api.md`: Komunikace s backendem (Retrofit, REST).
  - `6-config.md`: Konfigurace a nastavení.
  - `7-ui.md`: Uživatelské rozhraní (Jetpack Compose).
  - `8-setup.md`: Instalační a vývojová příručka.
  - `9-technologies.md`: Použité technologie a knihovny.
  - `manual.md`: Uživatelský manuál.
- **`schemas/`**: Diagramy specifické pro aplikaci (Use Case, State, Data Flow).

## docs_server/ (Dokumentace backendu)
Dokumentace serverové části, API a databáze.

- **Hlavní kapitoly:**
  - `0-packages.md`, `1-backend-overview.md`: Přehled struktury a balíčků backendu.
  - `2-database.md`: Návrh a struktura databáze.
  - `3-api-and-routes.md`: Dokumentace REST API endpointů.
  - `4-authentication.md`: Autentizace a bezpečnost.
  - `5-user-management.md` & `6-device-management.md`: Správa uživatelů a zařízení.
  - `7-gps-data-processing.md`: Zpracování příchozích GPS dat.
  - `8-frontend.md`: Dokumentace webového rozhraní (pokud je součástí serveru).
  - `9-administration.md`: Administrační rozhraní.
  - `10-technologies.md`: Technologický stack serveru.
- **`db_diagrams/`**: SQL exporty a PDF diagramy databázového schématu.
- **`schemas/`**: Sekvenční diagramy (registrace, tracking) a use case diagramy backendu.

## docs_hw/ (Hardware a Firmware)
Dokumentace fyzického zařízení GPS trackeru.

- **Hlavní kapitoly:**
  - `0-overview.md`: Přehled hardwarového řešení.
  - `1-hardware.md`: Popis komponent a zapojení.
  - `2-firmware.md`: Logika firmware (C/C++).
  - `3-configuration.md`: Konfigurace zařízení.
  - `4-data-format.md`: Formát přenášených dat.
  - `5-ota.md`: Over-The-Air aktualizace.
  - `6-setup.md`: Oživení a montáž.
  - `7-technologies.md`: Použité HW technologie.
- **`reference/`**: Externí dokumentace (např. k modulům jako LilyGO).
- **`schemas/`**: Schémata zapojení, diagramy stavů (Life Cycle), fotografie prototypů a stavů zařízení.

## FINAL_latex/ (Text závěrečné práce)
Zdrojové kódy pro sazbu finální textové části práce v systému LaTeX.

- **`Balner_LOTR_system.tex`**: Hlavní zdrojový soubor práce.
- **`Balner_LOTR_system.pdf`**: Vygenerované PDF práce.
- **`image/`**: Obrázky použité v textu práce (loga, schémata).

## latex_template/ (Šablona)
Šablona školní závěrečné práce pro formátování LaTeX dokumentů.
- Obsahuje `sablona-zaverecne-prace.tex` a návody.

## requirements_examples/ (Zadání a vzory)
Referenční materiály a vzorové práce.
- Obsahuje MarkDown soubory vzorových prací (`lahodny...`, `lacheta...`) a pravidla pro psaní.

## docs_general_deprecated/ (Archiv)
Starší, již neaktuální dokumentace a harmonogramy. Uchováno pro historický kontext.