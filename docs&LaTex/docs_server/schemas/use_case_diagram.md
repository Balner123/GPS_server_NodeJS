```mermaid
flowchart TD
    %% --- DEFINICE STYLŮ ---
    classDef actor fill:#7ce3ff;
    classDef system fill:#a8a8a8,stroke-dasharray: 5 5;
    classDef logic fill:#24ba49;
    classDef data fill:#ff3e3e;
    classDef ui fill:#f0f048;

    classDef default color:#000000;

    %% --- 1. AKTÉŘI (Actors) ---
    User((Uživatel / Admin)):::actor
    Device((GPS Klient<br>HW / APK)):::actor

    %% --- 2. SYSTÉM (Node.js Server) ---
    subgraph System ["SERVER"]
        direction TB

        %% Prezentační Vrstva (Vstup)
        subgraph Interface ["Vstupní Rozhraní"]
            WebUI["Webové GUI & Routes<br>(Prohlížeč)"]:::ui
            API["REST API Endpointy<br>(JSON data)"]:::ui
        end

        %% Bezpečnost
        AuthBlock["Security & Auth<br>(Passport / Middleware)"]:::logic

        %% Aplikační Logika (Sloučené Controllery)
        subgraph BusinessLogic ["Aplikační Logika (Controllers)"]
            Logic_Tracking["Zpracování Polohy & Geofence<br>(Příjem dat, Detekce zón)"]:::logic
            Logic_Mgmt["Správa Zařízení & Nastavení<br>(CRUD operace, Konfigurace)"]:::logic
            Logic_Admin["Administrativní Úkony<br>(Mazání uživatelů, Logy)"]:::logic
        end

        %% Datová Vrstva (Sloučené Modely)
        subgraph DataLayer ["Datová Vrstva (Models)"]
            Entities["Datové Entity<br>(Users, Devices, Locations, Alerts)"]:::data
        end
        
    end

    %% --- 3. EXTERNÍ ZDROJE ---
    DB[("MySQL Databáze")]:::data
    Mail["Email Service"]:::actor

    %% --- VZTAHY A TOKY ---

    %% Interakce Uživatele (Use Cases)
    User -- "Prohlíží mapu, spravuje účet" --> WebUI
    WebUI --> AuthBlock
    AuthBlock --> Logic_Mgmt
    AuthBlock --> Logic_Admin

    %% Interakce Zařízení (Use Cases)
    Device -- "Odesílá polohu, Handshake" --> API
    API --> Logic_Tracking
    
    %% Logické vazby
    Logic_Tracking -- "Detekce poplachu" --> Logic_Mgmt
    Logic_Tracking -- "Notifikace" --> Mail
    
    %% Tok do dat
    Logic_Tracking --> Entities
    Logic_Mgmt --> Entities
    Logic_Admin --> Entities

    %% Persistence
    Entities <--> DB

```