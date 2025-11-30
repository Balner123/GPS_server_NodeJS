# Analýza struktury a stylu závěrečných prací (SŠPU Opava)

Tento dokument shrnuje formální požadavky, strukturu a stylistická doporučení pro psaní závěrečné maturitní práce na základě analýzy školních pravidel a vzorových prací (Feret 2018, Lahodný 2022, Lacheta 2022).

## 1. Obecná struktura dokumentu

Práce musí striktně dodržovat následující pořadí částí:

1.  **Titulní list** (nečíslovaný)
    *   Název školy, název práce, autor, obor, třída, školní rok.
2.  **Poděkování** (nepovinné, nečíslované)
    *   Poděkování vedoucímu práce a konzultantům.
3.  **Prohlášení** (nečíslované)
    *   Formule o samostatném vypracování, datum, podpis.
4.  **Anotace (Abstrakt)**
    *   Stručné shrnutí obsahu, cílů a výsledků práce (cca 1 odstavec).
    *   **Klíčová slova:** Seznam 5–10 klíčových pojmů.
5.  **Obsah**
    *   Generovaný seznam kapitol a podkapitol.
6.  **Úvod** (nečíslovaná kapitola)
    *   Motivace k výběru tématu.
    *   Definice cílů práce.
    *   Stručný popis obsahu následujících kapitol.
    *   Rozsah: cca 1 strana.
7.  **Hlavní textová část** (číslované kapitoly)
    *   Dělení na Teoretickou (rešerše, technologie) a Praktickou (návrh, realizace) část.
8.  **Závěr** (nečíslovaná kapitola)
    *   Zhodnocení splnění cílů.
    *   Přínos práce, možnosti dalšího rozvoje.
9.  **Seznam použitých informačních zdrojů**
    *   Citace dle normy (ISO 690).
10. **Seznam příloh**
    *   Seznam obrázků, tabulek, grafů či externích souborů.

## 2. Styl psaní a jazyk

*   **Osoba:**
    *   **Ich-forma (1. osoba jednotného čísla):** Je běžná a akceptovaná, zejména v Úvodu, Závěru a pasážích popisujících vlastní rozhodnutí či postup (např. *"Rozhodl jsem se použít..."*, *"Aplikaci jsem navrhl tak, aby..."*).
    *   **Pasivum/Neosobní styl:** Vhodné pro čistě technické popisy a teorii (např. *"Komunikace je zajištěna pomocí..."*, *"Zařízení se skládá z..."*).
*   **Tón:** Odborný, formální, ale srozumitelný. Vyhýbat se hovorovým výrazům.
*   **Čas:**
    *   Minulý čas pro popis realizace (*"Vytvořil jsem...", "Bylo nutné vyřešit..."*).
    *   Přítomný čas pro popis funkčnosti výsledného systému (*"Aplikace umožňuje...", "Modul odesílá data..."*).

## 3. Typická struktura kapitol (Vzor pro LOTR)

Na základě analyzovaných prací (kombinace HW a SW) se doporučuje následující osnova:

### Úvod
*   Proč jsem si téma vybral (osobní motivace, vztah k tématu).
*   Co je cílem (vytvořit komplexní sledovací systém).
*   Stručný přehled kapitol.

### 1. Teoretická část / Analýza
*   Rozbor problematiky (např. existující řešení GPS trackerů).
*   Popis použitých technologií (HW komponenty, přenosové protokoly, frameworky).
    *   *Příklad:* "Pro backend byl zvolen Node.js díky jeho asynchronní povaze..."

### 2. Návrh řešení (Hardware & Firmware)
*   Výběr komponent (ESP32, GPS modul, baterie) – zdůvodnění výběru.
*   Popis zapojení (schémata).
*   Popis logiky firmware (stavové automaty, úsporné režimy).
*   *Vzor Feret:* "Problém s napájením jsem vyřešil pomocí..."

### 3. Serverová část a Backend
*   Architektura systému (klient-server, databáze).
*   Návrh databáze (ER diagramy).
*   API rozhraní (komunikace mezi trackerem a serverem).
*   *Vzor Lahodný:* Popis autentizace, databázových modelů.

### 4. Klientská aplikace (Android/Web)
*   Uživatelské rozhraní (UI/UX).
*   Implementace klíčových funkcí (zobrazení mapy, správa zařízení).

### 5. Výsledky a testování
*   Fotodokumentace hotového zařízení.
*   Popis funkčnosti, ukázka dat z reálného provozu.
*   Zhodnocení spolehlivosti a výdrže.

### Závěr
*   Shrnutí: "Podařilo se vytvořit funkční prototyp..."
*   Kritické zhodnocení (co by šlo lépe).
*   Plány do budoucna.

## 4. Práce s prvky v textu

*   **Obrázky:** Musí mít číslovaný popisek pod obrázkem (např. *Obrázek č. 3: Schéma zapojení*). V textu se na ně musí odkazovat (*"viz Obrázek č. 3"*).
*   **Kód:** Používat `listing` prostředí. Ukázky by měly být krátké a ilustrativní (ne celé soubory). Musí mít popisek.
*   **Citace:** Odkazovat na zdroje v hranatých závorkách nebo číslem, které odpovídá seznamu literatury.

## 5. Specifika pro LaTeX (šablona)
*   Dodržet hierarchii nadpisů (`\chapter`, `\section`, `\subsection`).
*   Každá hlavní kapitola (`\chapter`) začíná na nové stránce.
*   Úvod a Závěr jsou nečíslované (`\chapter*`), ale v obsahu být mají (použít `\addcontentsline`).

---
*Tento dokument slouží jako referenční bod pro generování obsahu do souboru `FINAL_latex/Balner_LOTR_system.tex`.*
