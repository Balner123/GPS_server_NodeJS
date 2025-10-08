# GPS Tracking Server

Tento dokument poskytuje základní přehled serverové části aplikace pro sledování GPS. Server je postaven na platformě **Node.js** s využitím frameworku **Express.js** a slouží jako backend pro příjem a zpracování dat z GPS zařízení, správu uživatelů a vizualizaci dat.

## Architektura

Aplikace dodržuje vzor **Model-View-Controller (MVC)**. Pro komunikaci s databází MySQL využívá **Sequelize ORM** a pro generování stránek šablonovací systém **EJS**.

## Spuštění projektu

Projekt je navržen pro spuštění s Dockerem.

```bash
# Sestavení a spuštění kontejnerů v detached módu
docker-compose up --build -d

# Zobrazení logů aplikace
docker-compose logs -f app

# Zastavení služeb
docker-compose down
```

---

## Detailní technická dokumentace

Kompletní a detailní popis jednotlivých částí systému naleznete v následujících dokumentech ve složce `/docs`:

- **[1. Přehled Backendu](./docs/1-backend-overview.md)**: Celková architektura, technologický stack a struktura projektu.
- **[2. Databáze](./docs/2-database.md)**: Detailní popis schématu, modelů a jejich vztahů.
- **[3. API a Routy](./docs/3-api-and-routes.md)**: Kompletní seznam všech API endpointů a webových stránek.
- **[4. Autentizace a Autorizace](./docs/4-authentication.md)**: Hloubkový pohled na přihlašování, registrace, OAuth a uživatelské role.
- **[5. Správa uživatelského účtu](./docs/5-user-management.md)**: Popis funkcí dostupných uživateli v nastavení jeho účtu.
- **[6. Správa zařízení](./docs/6-device-management.md)**: Vše o registraci, konfiguraci a sledování GPS zařízení.
- **[7. Zpracování GPS dat (Agregace)](./docs/7-gps-data-processing.md)**: Detailní vysvětlení algoritmu pro shlukování GPS bodů.
- **[8. Frontend](./docs/8-frontend.md)**: Popis klientské části, včetně použitých knihoven a skriptů.
- **[9. Administrace](./docs/9-administration.md)**: Funkce dostupné v rozhraní pro správce systému.
