# LOTR Documentation Structure

> **Primary rule:** `sablona-zaverecne-prace.tex` dictates the entire layout and flow. The final manuscript in `Balner_LOTR_system.tex` must stay tightly aligned with this template—only enrich it with LOTR content, never rearrange its fundamentals.

## Directory Map (source materials)
- `latex_template/` – baseline Czech-language report template (`sablona-zaverecne-prace.tex`) containing the authoritative page layout, chapter order, and front-matter requirements that every update must respect without exception.
- `FINAL_latex/` – definitive report file (`Balner_LOTR_system.tex`). All project-specific content goes here while keeping the template’s structure intact. `image/` holds final figures for inclusion.
- `docs_general/` – high-level project context: overall description (`README.md`), roadmap and decisions (`Poznámky k vývoji projektu.md`), Miro/Canvas export (`GPS_projekt.canvas`). Provides material for the intro, motivation, goals, timeline, and project management chapters.
- `docs_hw/` – hardware and firmware documentation: board wiring (`hardware.md`), configuration parameters (`configuration.md`), OTA and troubleshooting (`ota.md`, `troubleshooting.md`), data formats (`data-format.md`), firmware overview (`readme_HW_functions.md`), and supporting schematics in `schemas/`. This feeds the hardware design and embedded software chapters.
- `docs_server/` – server-side reference split into numbered sections (1–9) covering architecture, database, API, authentication, user/device management, data processing, frontend, and administration. `db_diagrams/` holds SQL exports/diagrams for appendices.
- `docs_apk/` – Android client documentation: overall goals (`overview.md`), architecture (`architecture.md`), services (`services.md`), data handling (`data.md`), configuration (`config.md`), UI notes (`ui.md`), changelog/setup. These inform the mobile-application chapter.
- `docs_apk/readme_apk.md`, `docs_server/...`, `docs_hw/...` contain iterative notes that can become annexes or development log content.

## Suggested LaTeX Report Outline
> `Balner_LOTR_system.tex` is the production document. Any structural adjustments (extra chapters, sections) should extend the template’s backbone rather than replace it. Treat `sablona-zaverecne-prace.tex` as the single source of truth for formatting, spacing, and preliminaries—deviations are out of scope.
1. **Úvod & Cíle** – derive motivation, scope, stakeholders, and project goals from `docs_general/README.md` and the roadmap notes.
2. **Analýza Požadavků** – summarize functional/non-functional requirements from general notes, including target use cases (vehicle tracking, child safety, etc.).
3. **Systémová Architektura** – describe the end-to-end LOTR ecosystem using cross-cutting context from `docs_general`, supported by overviews in `docs_server/1-backend-overview.md`, `docs_hw/hardware.md`, and `docs_apk/overview.md`.
4. **Hardware a Firmware Trackeru** – detail the ESP32 + A7670 design, power management, OTA mode, and data caching using `docs_hw/readme_HW_functions.md`, `hardware.md`, `configuration.md`, and schematics.
5. **Backend Server** – structure subsections to match `docs_server/1-7` (architecture, database, API/routes, authentication, user/device management, GPS data processing). Include deployment tooling (Docker, reverse proxy) and security considerations.
6. **Webové Rozhraní (Frontend + Administrace)** – base on `docs_server/8-frontend.md` and `docs_server/9-administration.md`, referencing UI behavior, map tooling, alerts, and admin workflows.
7. **Mobilní Aplikace (APK)** – use `docs_apk/architecture.md`, `services.md`, `data.md`, and `ui.md` to cover app structure, foreground service, WorkManager sync, UI design, and error handling.
8. **Komunikace a Datové Formáty** – consolidate `docs_hw/data-format.md`, backend API docs (`docs_server/3-api-and-routes.md`), and Android data handling (`docs_apk/data.md`). Include geofence workflow and power-status handshake.
9. **DevOps, Nasazení a Bezpečnost** – gather from `docs_general/Poznámky k vývoji projektu.md` (Docker, Nginx, Certbot), server notes, and any OTA deployment info.
10. **Testování, Validace a Troubleshooting** – draw on `docs_hw/troubleshooting.md`, server/admin docs, and any QA notes. Mention simulated runs, logging, alerting, and known issues.
11. **Závěr a Budoucí Práce** – synthesize future plans listed in general notes (APK features, hardware revisions, geofence improvements, etc.).

## MAIN IDEAS !
- Keep `Balner_LOTR_system.tex` synchronized with the template’s structural commands (`\chapter`, `\section`, front-matter definitions); evolved content must remain compliant with `sablona-zaverecne-prace.tex`. If a change risks breaking the template contract, rework the content instead of altering the structure.
- Add figures (system diagrams, DB schemas, hardware layouts) into `FINAL_latex/image/` and reference them via `\includegraphics`.
- Consider mirrored appendices for raw schemas (`docs_server/db_diagrams`), wiring tables, API listings, and changelog excerpts (`docs_apk/changelog.md`).
- Update the metadata macros at the top of the LaTeX file (`\jmenoAutora`, `\nazevPrace`, etc.) once the narrative is ready.
