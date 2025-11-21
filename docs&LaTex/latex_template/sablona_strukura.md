# Struktura šablony `sablona-zaverecne-prace.tex`

## 1. Nastavení dokumentu (Preambule)
- **Třída dokumentu:** `report`
- **Parametry:** `12pt`, `a4paper`, `twoside` (oboustranný tisk), `openright` (kapitoly začínají vpravo).

## 2. Uživatelské proměnné (Makra)
Šablona definuje následující proměnné pro snadné vyplnění údajů:
- `\obor`: INFORMAČNÍ TECHNOLOGIE
- `\kodOboru`: 18-20-M/01
- `\zamereni`: se zaměřením na počítačové sítě a programování
- `\skola`: Střední škola průmyslová a umělecká, Opava
- `\trida`: IT4
- `\jmenoAutora`: Jméno autora
- `\skolniRok`: 2023/24
- `\datumOdevzdani`: Datum
- `\nazevPrace`: Název práce

## 3. Použité balíčky (Packages)
### Formátování a vzhled
- `geometry`: Nastavení okrajů (top=2.5cm, bottom=2.5cm, left=3.5cm, right=1.5cm).
- `titlesec`: Úprava stylu nadpisů kapitol a sekcí.
- `tocloft`: Úprava vzhledu obsahu.
- `fancyhdr`: Záhlaví a zápatí stránek.
- `linespread`: Řádkování 1.25.

### Čeština a fonty
- `babel` (czech), `inputenc` (utf8), `fontenc` (T1), `cmap`.
- Fonty: `helvet`, `mathptmx` (Times New Roman), `Oswald`.

### Matematika a symboly
- `amsmath`, `amsfonts`, `esint`, `mathrsfs`, `upgreek`.

### Grafika a média
- `graphicx`, `subcaption` (podobrázky), `pdfpages` (vkládání celých PDF).

### Zdrojový kód (Listings)
- `listings`, `xcolor`.
- **Definované styly:**
    - `Python` (zvýraznění syntaxe, barvy).
    - `JavaScript` / `ES6`.

### Ostatní
- `hyperref` (odkazy v PDF).
- `booktabs` (profesionální tabulky).
- `lipsum` (výplňový text).

## 4. Struktura obsahu (`document`)

### Úvodní část (Front Matter)
1.  **Číslování:** Římské číslice (`Roman`).
2.  **Titulní strana:**
    - Logo školy (`image/logo-skoly.png`).
    - Název práce, typ práce (Závěrečná studijní práce).
    - Obrázek na titulce (`image/programovani-02.jpg`).
    - Tabulka s údaji o autorovi, oboru a škole.
3.  **Poděkování a Prohlášení:**
    - Samostatná stránka.
    - Místo pro podpis.
4.  **Abstrakt (Anotace):**
    - Česká verze + Klíčová slova.
    - Anglická verze (Abstract) + Keywords.
5.  **Obsah:** `\tableofcontents`.

### Hlavní část (Main Matter)
1.  **Číslování:** Arabské číslice (`arabic`), restart na 1.
2.  **Úvod:** Nečíslovaná kapitola (`\chapter*`), ale ručně přidaná do obsahu.
3.  **Kapitola 1:** Typografický systém LaTeX (teorie, struktura, formátování).
4.  **Kapitola 2:** Tipy k psaní (praktické ukázky tabulek, obrázků, kódů).
5.  **Kapitola 3:** Když dokončuji práci (rady pro kontrolu).
6.  **Závěr:** Nečíslovaná kapitola.

### Závěrečná část (Back Matter)
1.  **Literatura:** `thebibliography` (ručně psané záznamy `\bibitem`).
2.  **Seznamy:**
    - Seznam obrázků (`\listoffigures`).
    - Seznam tabulek (`\listoftables`).
3.  **Přílohy:**
    - `\appendix`
    - Změna formátování nadpisů pro přílohy.
    - Příloha A (Ukázka).
