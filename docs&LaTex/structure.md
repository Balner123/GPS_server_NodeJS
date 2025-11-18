**Úvod**

Tento soubor slouží jako rozcestník a stručný průvodce obsahem složky `docs&LaTex`. Najdete zde přehled jednotlivých podsložek, důležité soubory a krátké instrukce jak pracovat s obsahem a jak připravit finální dokumentaci (LaTeX/PDF).

**Struktura**

- `docs_apk/`: Dokumentace týkající se mobilní aplikace (APK). Obsahuje kapitoly jako přehled, architektura, služby, data, API, konfigurace, UI a nastavení.
	- Hlavní soubory: `0-overview.md`, `1-architecture.md`, `3-services.md`, `4-data.md`, `5-api.md`, `6-config.md`, `7-ui.md`, `8-setup.md`.

- `docs_server/`: Dokumentace serverové části projektu.
	- Obsahuje: `0-packages.md`, `1-backend-overview.md`, `2-database.md`, `3-api-and-routes.md`, `4-authentication.md`, `5-user-management.md`, `6-device-management.md`, `7-gps-data-processing.md`, `8-frontend.md`, `9-administration.md`.

- `docs_hw/`: Hardwarová dokumentace a firmware.
	- Obsahuje kapitoly `0-overview.md`, `1-hardware.md`, `2-firmware.md`, `3-configuration.md`, `4-data-format.md`, `5-ota.md` a podsložky `reference/` a `schemas/`.
	- Důležité: v `schemas/` jsou odkazy a části související s komponentami (`PARTS_links.txt`).

- `docs_general_deprecated/`: Zastaralé dokumenty; uchováváme pro historii, nepoužívat pro finální sestavení.

- `FINAL_latex/`: Pracovní adresář obsahující LaTeX zdroj pro finální dokumentaci.
	- Například `Balner_LOTR_system.tex` (možný pracovní hlavní soubor) a připojené obrázky v `image/`.

- `latex_template/`: Šablona pro závěrečnou práci nebo pro finální sazbu dokumentace.
	- Obsahuje `sablona-zaverecne-prace.tex`, obrázky a další pomocné soubory.

- `db_diagrams/`: SQL exporty / diagramy databáze. Uloženy jsou například soubory `*.sql` s exporty diagramů.

- `requirements_examples/`: Ukázky/požadavky — může obsahovat seznam knihoven, požadavků nebo příklady (místo pro `requirements.txt` apod.).
