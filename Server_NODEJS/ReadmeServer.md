# GPS Server NodeJS

## Struktura projektu

```

# GPS Server NodeJS

## Struktura projektu

```mermaid
graph TD
   subgraph Backend
      S[server.js] -->|mounts| R1[routes/auth.js]
      S --> R2[routes/settings.js]
      S --> R3[routes/devices.js]
      S --> R4[routes/administration.js]
      S --> R5[routes/verify-email-change.js]
      R1 --> C1[controllers/authController.js]
      R2 --> C2[controllers/settingsController.js]
      R3 --> C3[controllers/deviceController.js]
      R4 --> C4[controllers/administrationController.js]
      R5 --> C1
      C1 --> M1[models/user.js]
      C2 --> M1
      C3 --> M2[models/device.js]
      C3 --> M3[models/location.js]
      C1 --> U1[utils/emailSender.js]
   end
   subgraph Frontend
      V1[views/*.ejs] --> S
      P1[public/js] --> V1
      P2[public/css] --> V1
      P3[public/img] --> V1
   end
   subgraph Database
      DB[(MySQL)]
      M1 --> DB
      M2 --> DB
      M3 --> DB
   end
```

## Uživatelský flow

```mermaid
sequenceDiagram
   participant U as Uživatel
   participant FE as Frontend (EJS)
   participant BE as Backend (Express)
   participant DB as DB (MySQL)
   participant SMTP as Email

   U->>FE: Registrace / Změna emailu
   FE->>BE: POST /register nebo /settings/email
   BE->>DB: Kontrola duplicity, validace
   BE->>SMTP: Odeslání ověřovacího kódu
   BE->>FE: Přesměrování na /verify-email nebo /verify-email-change
   U->>FE: Zadání kódu
   FE->>BE: POST /verify-email nebo /verify-email-change
   BE->>DB: Ověření kódu, změna stavu/emailu
   BE->>FE: Přihlášení / potvrzení změny
```

## Podrobnosti funkcí

- **Registrace uživatele**
│   ├── authController.js
│   ├── deviceController.js
│   ├── indexController.js
│   ├── settingsController.js
├── middleware/
│   ├── authorization.js
├── models/
│   ├── device.js
│   ├── location.js
│   ├── user.js
│   ├── css/
│   ├── img/
│   ├── js/
├── routes/
│   ├── auth.js
│   ├── devices.js
│   ├── register-device.js
│   ├── settings.js
│   ├── verify-email-change.js
│   ├── generate-hash.js
│   ├── hash-password.js
│   ├── testy.py
│   ├── emailSender.js
├── views/
│   ├── partials/
├── database.js
├── docker-compose.yml
├── dockerfile
├── init-db.sql
├── server.js
```

## Funkčnost serveru

- **Přihlášení**: Přes email nebo uživatelské jméno, kontrola hesla.
- **Změna emailu**: Odeslání ověřovacího kódu na nový email, změna emailu až po ověření kódu.
- **Správa zařízení**: Přidání, odebrání, správa zařízení (deviceController).
- **Administrace**: Správa uživatelů, role root, omezení mazání root účtu.
- **Ověření emailu**: Moderní UI pro zadání kódu (4 pole), automatické přeskočení mezi poli.
- **Bezpečnost**: Hashování hesel (bcryptjs), validace vstupů, session, rate limiting.
- **Email**: Odesílání přes Gmail SMTP (Nodemailer, utils/emailSender.js).
- **Frontend**: EJS šablony, Bootstrap.
- **Docker**: docker-compose pro spuštění serveru a databáze.

## Spuštění

1. Inicializace databáze:
   - Spusťte SQL skript `init-db.sql` v MySQL.
2. Instalace závislostí:
   - `npm install`
3. Spuštění serveru:
   - `node server.js` nebo přes Docker Compose
4. Přístup:
   - Webové rozhraní na `http://localhost:5000`
- `init-db.sql` – inicializace databáze
- `utils/emailSender.js` – odesílání emailů
- Root účet nelze smazat přes administraci.
---
Tento soubor shrnuje strukturu a hlavní funkce serveru. Pro detailní popis jednotlivých částí viz komentáře v kódu.
