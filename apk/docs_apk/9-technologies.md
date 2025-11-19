# Technologie, Principy a Implementační Techniky

Tento dokument slouží jako technický průvodce projektem. Je určen nejen zkušeným vývojářům, ale i nováčkům, kteří chtějí pochopit, jak moderní Android aplikace funguje "pod kapotou" a proč byla zvolena konkrétní řešení.

## 1. Jazyk a Vývojové Prostředí

### Kotlin
Celá aplikace je napsána v jazyce **Kotlin**.
- **Proč Kotlin?**: Oproti starší Javě je Kotlin modernější, bezpečnější (řeší problém s `NullPointerException`) a stručnější. Umožňuje psát méně kódu se stejnou funkcionalitou.
- **Využití**: V projektu využíváme pokročilé vlastnosti jako *Extension functions* a *Data classes* (např. pro `CachedLocation`), které automaticky generují metody pro porovnávání a tisk objektů.

### Gradle (Kotlin DSL)
Pro sestavování aplikace (build) používáme systém Gradle s konfiguračními soubory psanými v Kotlinu (`build.gradle.kts`).
- **Výhoda**: Díky Kotlin DSL nám vývojové prostředí (Android Studio) napovídá při psaní konfigurace a chyby odhalíme dříve než při samotném kompilování.

---

## 2. Asynchronní Programování a Vlákna

Mobilní aplikace nesmí nikdy provádět těžké operace (síťová komunikace, zápis do databáze) na hlavním vlákně (Main Thread), jinak by uživatelské rozhraní "zamrzlo".

### Kotlin Coroutines
Místo starších `Thread` nebo `AsyncTask` používáme **Coroutines**.
- **Princip**: Korutiny jsou "lehká vlákna". Umožňují psát asynchronní kód, který vypadá jako sekvenční (řádek po řádku), ale neblokuje aplikaci.
- **V projektu**: Všimněte si klíčových slov `suspend fun` (funkce, která se může pozastavit) a `CoroutineScope(Dispatchers.IO).launch` (spuštění úlohy na pozadí, např. v `LocationService` při ukládání polohy).

---

## 3. Architektura a Design Patterns

Aby se v kódu dalo vyznat i po letech, dodržujeme ověřené architektonické vzory.

### Separation of Concerns (Oddělení odpovědností)
Kód je rozdělen do logických vrstev:
1.  **Data Layer** (`AppDatabase`, `ApiClient`): Stará se o to, kde jsou data uložena (server nebo disk).
2.  **Domain/Business Logic** (`PowerController`, `HandshakeManager`): Rozhoduje, co se má stát (např. "Kdy vypnout GPS?").
3.  **UI Layer** (`MainActivity`, `FirstFragment`): Pouze zobrazuje data uživateli.

### Repository Pattern & Reactive UI
- **Repository**: Třída `ServiceStateRepository` funguje jako jediný zdroj pravdy o stavu aplikace.
- **StateFlow**: Používáme reaktivní datový tok. UI se neptá "jaký je stav?", ale přihlásí se k odběru změn. Jakmile se změní stav v repozitáři, UI se automaticky překreslí.

### Singleton
Objekty jako `ApiClient` nebo `ConsoleLogger` jsou definovány jako `object`. To zaručuje, že v celé aplikaci existuje vždy jen **jedna instance** těchto tříd, což šetří paměť a zabraňuje konfliktům při přístupu k síti.

---

## 4. Práce s Daty a Sítí

### Room Database (Lokální Persistence)
Pro ukládání GPS souřadnic používáme knihovnu **Room**.
- **Co to je**: Je to moderní obálka nad klasickou SQL databází (SQLite).
- **Offline-First přístup**: Aplikace se nespoléhá na to, že má internet.
    1. Získá polohu -> 2. Ihned ji uloží do Room DB -> 3. Teprve poté se `SyncWorker` pokusí data odeslat.
    - Tím je zaručeno, že ani při jízdě tunelem nebo výpadku signálu se data neztratí.

### Vlastní HTTP Klient (`ApiClient`)
Většina aplikací používá knihovnu *Retrofit*. My jsme se rozhodli pro vlastní implementaci nad `HttpURLConnection`.
- **Edukativní hodnota**: Prohlédněte si třídu `ApiClient.kt`. Ukazuje, jak funguje HTTP komunikace na nejnižší úrovni – jak se sestavují hlavičky, jak se posílá JSON body a jak se čtou cookies. Je to efektivní řešení, které nepřidává do aplikace zbytečné megabajty externích knihoven.

---

## 5. Android Komponenty a Služby

### Foreground Service (`LocationService`)
Android systém rád "zabíjí" aplikace na pozadí, aby šetřil baterii.
- **Řešení**: Používáme tzv. "Službu na popředí". Ta musí zobrazovat trvalou notifikaci v liště ("GPS Reporter Active"). Tím dáváme systému najevo, že aplikace je pro uživatele důležitá a nesmí být ukončena.

### WorkManager (`SyncWorker`)
Pro odesílání dat používáme **WorkManager**.
- **Výhoda**: Je to inteligentní plánovač. Pokud aplikace spadne nebo se restartuje telefon, WorkManager si pamatuje, že měl odeslat data, a udělá to, jakmile to bude možné (např. až se obnoví připojení k internetu).

### EncryptedSharedPreferences
Nikdy neukládáme citlivá data (jako Session ID) do obyčejných textových souborů. Používáme šifrované úložiště, které využívá bezpečnostní čip v telefonu (Keystore) k ochraně klíčů.

---

## 6. Diagnostika a Ladění

### ConsoleLogger
Vytvořili jsme vlastní nástroj pro logování (`ConsoleLogger.kt`).
- **Funkce**: Kromě výpisu do systémové konzole (Logcat) ukládá logy do paměti a zobrazuje je přímo na obrazovce telefonu (`SecondFragment`). To je klíčové pro testování v terénu, kdy nemáte telefon připojený k počítači kabelem.