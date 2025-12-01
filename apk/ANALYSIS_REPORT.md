# Analýza kódu vs. Upřesněný Protokol

Díky za upřesnění. Tento nový pohled ("First Location -> Handshake" a "Input -> Handshake") mění interpretaci některých částí kódu. Zde je revidovaná analýza.

## 1. Shoda s protokolem (Co je správně)

**Sekvence: INPUT_DATA -> HANDSHAKE**
Váš požadavek: *"v časových intervalech postup :: INPUT_DATA -> a poté -> HANDSHAKE"*
Stav v kódu (`SyncWorker.kt`):
```kotlin
// 1. Odeslání dat (INPUT_DATA)
val response = ApiClient.sendBatch(...)
// ...
// 2. Handshake po dokončení (HANDSHAKE)
HandshakeManager.launchHandshake(applicationContext, reason = "sync_complete")
```
**Závěr:** Toto chování je v kódu **již implementováno správně**. `SyncWorker` skutečně volá Handshake až *po* odeslání dávky. Moje předchozí připomínka k "chybějícímu handshaku před daty" byla založena na starém pochopení. Tento kód tedy **neměnit**.

## 2. Kritické chyby a odchylky (Co je třeba opravit)

### A. Zablokování odeslání dat při vypnutí (Stuck Cache)
**Problém:** *"po vypnutí něco v cachi zlstane"*
I v novém kontextu je toto **hlavní chyba**.
V `SyncWorker.kt`:
```kotlin
if (SharedPreferencesHelper.isTurnOffAckPending(applicationContext)) {
    // ... return Result.success()
}
```
Tato podmínka způsobí, že když se aplikace vypíná (a má nastaven příznak `pendingAck`), `SyncWorker` (spuštěný jako "Final Flush") se okamžitě ukončí a **neodešle** závěrečná data.
**Řešení:** Tuto podmínku je nutné **odstranit**. `SyncWorker` musí odeslat data i (a hlavně) v případě, že se aplikace vypíná. Odeslání dat s `power_status: OFF` je totiž součástí potvrzovacího procesu.

### B. Pořadí při startu (Startup Sequence)
**Požadavek:** *"po registraci - záskání přvní polohy -> poté -> HANDSHAKE"*
**Stav v kódu:** `LocationService` nejprve provede Handshake (pro získání configu) a až poté spustí sledování polohy.
**Řešení:** Pro dodržení zadání je třeba v `LocationService.initializeAndStart`:
1.  Načíst lokální konfiguraci (defaults).
2.  Spustit sledování polohy (`startLocationUpdates`).
3.  Počkat na první polohu (nebo naplánovat Handshake asynchronně).
*Poznámka: Současný stav (Handshake -> Poloha) je technicky bezpečnější (máme čerstvý config), ale pokud trváte na "Poloha -> Handshake", je třeba prohodit volání v `initializeAndStart`.*

### C. Manuální vypnutí a Power Status
**Požadavek:** *"při vypnutí (manuálním) získat závěrečnou polohu a odeslat i spolu se změnou power_status:OFF"*
**Analýza:**
V `LocationService.onDestroy`:
1.  Získá se `lastLocation`.
2.  Volá se `persistLocationToDb(location)`.
3.  Tato metoda čte aktuální `PowerState` ze `SharedPreferences`.
**Riziko:** Pokud uživatel vypne aplikaci (nebo systém), `SharedPreferences` mohou mít stále stav `ON` v momentě, kdy se ukládá poslední poloha. Do DB se tak uloží poloha s `power_status: ON`. Následný `SyncWorker` ji odešle jako `ON`, a až poté Handshake pošle `OFF`.
**Řešení:** V `onDestroy` je nutné explicitně nastavit `PowerState` na `OFF` (nebo jej předat do `persistLocationToDb`) **předtím**, než se uloží poslední poloha. Tím zajistíme, že poslední bod v dávce bude mít správný flag `OFF`.

## 3. Shrnutí oprav (Action Plan)

Pro stabilizaci a dodržení upřesněného protokolu navrhuji:

1.  **V `SyncWorker.kt`:** Odstranit blokující podmínku `isTurnOffAckPending`. Umožnit odeslání dat vždy.
2.  **V `LocationService.kt` (onDestroy):** Zajistit nastavení `PowerState.OFF` **před** uložením poslední polohy do DB.
3.  **V `LocationService.kt` (Start):** (Volitelně) Přesunout úvodní Handshake až za spuštění GPS, pokud je to striktní požadavek.

Tímto se vyřeší "stuck cache", zajistí se správný "final flush" s `OFF` statusem a zachová se vámi požadovaná sekvence `Input -> Handshake`.
