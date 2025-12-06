# Stav dokumentace (LaTeX)

Tento soubor popisuje aktuální obsah a strukturu hlavního zdrojového souboru `Balner_LOTR_system.tex`.

## Základní metadata
- **Třída dokumentu:** Report (oboustranný tisk)
- **Autor:** Štěpán Balner
- **Název práce:** LOTR - LOcation TRacking System
- **Školní rok:** 2025/26

## Struktura a obsah

### 0. Úvodní náležitosti
- **Titulní strana:** Kompletní (loga, škola, autor).
- **Formality:** Poděkování a Prohlášení jsou připraveny.
- **Anotace:** Sepsána. Shrnuje cíl projektu (IoT sledovací systém), použité technologie (ESP32, Node.js, Kotlin) a výsledek.
- **Klíčová slova:** Definována.

### Úvod (nečíslovaná kapitola)
- **Stav:** Sepsáno.
- **Obsah:** Motivace autora, historie myšlenky (od nahrávání videa k trackingu), stručné představení tří hlavních částí systému (HW, Server, App).

### 1. Kapitola: Fyzické zařízení "tracker"
- **1.1 Teoretická východiska:** Sepsáno.
    - Popis ESP32 (SoC, Deep Sleep).
    - Mobilní komunikace (LTE, AT příkazy).
    - GPS (NMEA protokol).
    - RTOS (FreeRTOS úlohy).
    - LittleFS (odolnost proti výpadku napájení).
- **1.2 Návrh hardware:** Částečně hotovo.
    - Obsahuje vložená schémata (blokové schéma, Power Latch).
    - Sepsán popis Power Latch modulu (řízení napájení).
    - *Chybí:* Text k výběru komponent.
- **1.3 Implementace firmware:** Sepsáno.
    - Architektura (Arduino + FreeRTOS).
    - Použité knihovny (TinyGSM, TinyGPS++, ArduinoJson).
    - Popis pracovního cyklu (Wake-up -> GPS -> Save -> Send -> Sleep).
    - Správa úložiště (Cache, Config).
- **1.4 Komunikace a data:** Pouze nadpisy podkapitol.
- **1.5 Konfigurace a servisní režim:** Pouze nadpisy podkapitol.

### 2. Kapitola: Serverová část
- **2.1 Úvod a koncepce:** Pouze nadpisy podkapitol.
- **2.2 Teoretická východiska:** Sepsáno.
    - Node.js a Event Loop.
    - Relační databáze (MySQL) a ORM (Sequelize).
    - Autentizace (OAuth 2.0).
    - Principy REST API (Stateless).
- **2.3 Návrh a architektura:** Pouze nadpisy podkapitol.
- **2.4 Implementace funkcí:** Pouze nadpisy podkapitol.
- **2.5 Frontend:** Pouze nadpisy podkapitol.

### 3. Kapitola: Aplikace pro Android
- **3.1 Koncept a cíle:** Pouze nadpisy podkapitol.
- **3.2 Použité technologie:** Sepsáno.
    - Kotlin a Coroutines (asynchronní programování).
    - Android komponenty (Foreground Service, WorkManager).
    - Databáze Room (SQLite wrapper).
    - Bezpečnost (EncryptedSharedPreferences).
- **3.3 Architektura:** Pouze nadpisy podkapitol.
- **3.4 Implementace funkcí:** Pouze nadpisy podkapitol.
- **3.5 Uživatelské rozhraní:** Pouze nadpisy podkapitol.

### Závěr a přílohy
- **Závěr:** Připraveny nadpisy (Zhodnocení, Budoucí vývoj).
- **Literatura:** Vyplněn seznam zdrojů (Datasheety ESP32/SIMCOM, Dokumentace Node.js/Kotlin).
- **Seznamy:** Generované seznamy obrázků a tabulek.
- **Přílohy:** Připravena struktura pro vkládání příloh.
