# 7. Zpracování GPS dat (Agregace)

Tento dokument detailně popisuje proces, jakým server zpracovává a agreguje (shlukuje) surová GPS data pro přehlednější zobrazení v historii trasy.

- **Hlavní logika**: `controllers/deviceController.js`

## 7.1. Cíl a princip

Když vozidlo nebo zařízení delší dobu stojí na jednom místě (např. na parkovišti), GPS modul stále posílá data s mírnými odchylkami polohy. Zobrazení všech těchto bodů na mapě by bylo nepřehledné. Cílem agregace je tyto "stacionární" body dynamicky sloučit do jednoho reprezentativního bodu, který zastupuje delší časový úsek.

**Princip**: Zpracování probíhá "On-Read" – tedy v momentě, kdy si frontend vyžádá data o historii. **Původní data v databázi se nikdy nemění**, což zaručuje jejich integritu a možnost budoucího alternativního zpracování.

## 7.2. Průběh zpracování

```mermaid
graph TD
    A[Frontend žádá o historii] -- GET /api/devices/data --> B(Controller: getDeviceData);
    B --> C{DB: Načti všechny lokace pro zařízení (seřazené dle času)};
    C --> D[Controller: clusterLocations(data)];
    D --> E{Výpočet vzdálenosti mezi body (Haversine)};
    E --> F[Seskupení bodů do shluků (clusterů)];
    F --> G[Nahrazení původních bodů jedním "cluster" objektem];
    G --> H[API vrací zpracované pole (mix bodů a clusterů)];
    H --> I[Frontend zobrazí data];
```

1.  **Žádost o data**: Frontend zavolá endpoint `GET /api/devices/data` s ID zařízení.
2.  **Načtení dat**: Funkce `getDeviceData` načte z tabulky `locations` všechny záznamy pro dané zařízení, seřazené vzestupně podle časové značky.
3.  **Agregace**: Pole surových dat je předáno funkci `clusterLocations`.

## 7.3. Algoritmus Agregace

Logika je implementována ve funkci `clusterLocations(locations, distanceThreshold)`.


  1.  Funkce iteruje polem seřazených bodů.
  2.  Pro každý bod se pokusí vytvořit "shluk" (cluster) s následujícími body.
  3.  Vzdálenost mezi posledním bodem ve shluku a dalším bodem v pořadí se vypočítá pomocí **Haversinova vzorce** (funkce `getHaversineDistance`), který přesně počítá vzdálenost na sféře (Zemi).
  4.  Pokud je vzdálenost **menší** než `25 metrů`, další bod je přidán do shluku a proces se opakuje.
  5.  Pokud je vzdálenost **větší**, shluk se uzavře.
  6.  **Vytvoření cluster objektu**: Pokud má shluk více než jeden bod, všechny původní body jsou nahrazeny jediným objektem, který má:
      - `type: 'cluster'`
      - `latitude`, `longitude`: Průměrná poloha všech bodů ve shluku.
      - `startTime`: Časová značka prvního bodu ve shluku.
      - `endTime`: Časová značka posledního bodu ve shluku.
      - `originalPoints`: Pole obsahující všechny původní body (pro případné detailní zobrazení na klientovi).
  7.  Pokud shluk obsahuje jen jeden bod, je tento bod ponechán v původní podobě.

## 7.4. Výstup a zobrazení

Výsledkem je pole, které je směsí standardních objektů polohy a nových "cluster" objektů. Frontend (logika v `public/js/device.js`) toto pole přijme a při vykreslování na mapu a do tabulky kontroluje vlastnost `point.type`. Pokud se jedná o `cluster`, zobrazí časové rozmezí (`startTime` - `endTime`) místo jednoho času a průměrnou polohu.
