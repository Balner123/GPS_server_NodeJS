# LOTR Documentation Plan (LaTeX)

This plan maps existing Markdown documentation to the new LaTeX chapter structure and outlines the migration and expansion steps.

## Mapping: Markdown -> LaTeX chapters

- README.md, Poznámky k vývoji projektu.md
  - chapters/01-uvod.tex (Úvod, cíle, rozsah, role)
- docs_apk/overview.md, docs_server/1-backend-overview.md
  - chapters/02-systemovy-prehled.tex (Komponenty, use-cases, NFR)
- docs_apk/architecture.md, docs_server/1-backend-overview.md, docs_hw/hardware.md
  - chapters/03-architektura.tex (Architektura, rozhraní, diagramy)
- docs_server/1-backend-overview.md, 8-frontend.md, 9-administration.md
  - chapters/04-server-backend.tex (Stack, struktura, konfigurace, nasazení)
- docs_server/2-database.md (+ db_diagrams/*)
  - chapters/05-databaze.tex (ERD, integrita, výkon)
- docs_server/3-api-and-routes.md, 4-authentication.md
  - chapters/06-api-a-autentizace.tex (Routy, verze, authz)
- docs_hw/hardware.md, configuration.md, schemas/*
  - chapters/07-zarizeni-a-hardware.tex (HW, schémata, spotřeba)
- docs_hw/firmware.md, ota.md, configuration.md, data-format.md
  - chapters/08-firmware.tex (Architektura FW, OTA, formáty)
- docs_apk/ui.md, services.md, config.md, data.md, setup.md
  - chapters/09-aplikace-android.tex (UI, služby, konfigurace)
- docs_server/7-gps-data-processing.md, docs_hw/data-format.md
  - chapters/10-zpracovani-gps-dat.tex (Pipeline, modely, performance)
- docs_server/8-frontend.md, 9-administration.md
  - chapters/11-frontend-a-admin.tex (Web, admin, audity)
- (add based on practice)
  - chapters/12-testovani-a-kvalita.tex (Unit, Integration, E2E, performance)
- docs_apk/setup.md, ops notes
  - chapters/13-nasazeni-a-provoz.tex (Prostředí, release, monitoring)
- consolidate from API/Auth + HW
  - chapters/14-bezpecnost-a-soukromi.tex (TLS, role, GDPR)
- summary
  - chapters/15-zaver-a-rozvoj.tex
- Appendices:
  - chapters/appendix-a-api-priklady.tex (API examples)
  - chapters/appendix-b-schema-zapojeni.tex (Schematics)
  - chapters/appendix-c-troubleshooting.tex (Known issues)

## Migration checklist

- [ ] Convert docs_server/1-backend-overview.md content into 02, 03, and 04 chapters where relevant.
- [ ] Move ERD content and images from 2-database.md and db_diagrams/* into 05-databaze.tex.
- [ ] Transform API endpoints and auth from 3-api-and-routes.md, 4-authentication.md into 06-api-a-autentizace.tex; add example requests to appendix A.
- [ ] Port hardware description, configuration and schemas into 07-zarizeni-a-hardware.tex and appendix B.
- [ ] Port firmware, OTA and data formats into 08-firmware.tex.
- [ ] Port APK overview, UI, services, config and setup into 09-aplikace-android.tex.
- [ ] Port GPS data processing details into 10-zpracovani-gps-dat.tex.
- [ ] Port frontend/admin into 11-frontend-a-admin.tex.
- [ ] Draft testing strategy into 12-testovani-a-kvalita.tex (unit/integration/E2E/perf).
- [ ] Draft deployment and ops into 13-nasazeni-a-provoz.tex (env, release, monitoring).
- [ ] Draft security and privacy into 14-bezpecnost-a-soukromi.tex (TLS, JWT, roles, GDPR).
- [ ] Finalize conclusion in 15-zaver-a-rozvoj.tex.

## Conventions

- Language: Czech (babel), UTF-8.
- Figures: place under `figures/` and reference with `\label/\ref`.
- Code/JSON: use `listings` with `\lstinputlisting` or inline `lstlisting`.
- Cross-references: use `\label{chap:...}` and `\ref{chap:...}`.
- Acronyms: define once in Úvod; expand on first use.

## How to build (Windows)

- Recommended: TeX Live + latexmk.
- Build with: `latexmk -pdf -silent documentation.tex`
- Clean with: `latexmk -c`

If you prefer an editor, configure it to run `latexmk` for faster incremental builds.
