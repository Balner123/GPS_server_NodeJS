# Analýza Android Aplikace pro Sledování GPS

Tento dokument poskytuje detailní analýzu chování a architektury Android aplikace `gps-reporter-app`.

## 1. Přehled Aplikace

Aplikace je nástroj pro sledování GPS polohy zařízení v reálném čase. Jejím hlavním úkolem je v pravidelných intervalech zjišťovat polohu a odesílat ji na centrální server. Aplikace je navržena tak, aby fungovala spolehlivě na pozadí a zvládala dočasné výpadky internetového připojení.

**Klíčové funkce:**
- Přihlášení uživatele a registrace zařízení.
- Sledování polohy pomocí GPS na pozadí.
- Lokální ukládání (cachování) polohových dat.
- Periodická synchronizace dat se serverem.
- Zobrazení stavu služby a logů v uživatelském rozhraní.
- Zabezpečené ukládání citlivých dat.

## 2. Architektura a Komponenty

Aplikace využívá moderní Android komponenty a knihovny.

### Hlavní Komponenty:

- **`LoginActivity.kt`**:
  - Zajišťuje přihlášení uživatele.
  - Při prvním přihlášení generuje unikátní `installationId` (10 znaků dlouhý SHA-256 hash z UUID), který slouží jako identifikátor zařízení.
  - Komunikuje se serverem na endpointu `/api/apk/login`.
  - Pokud zařízení ještě není na serveru registrováno, provede registraci na `/api/apk/register-device`.
  - Po úspěšném přihlášení/registraci uloží přihlašovací údaje, ID zařízení a konfigurační parametry (intervaly) do šifrovaných `SharedPreferences`.

- **`MainActivity.kt`**:
  - Hlavní obrazovka aplikace.
  - Zobrazuje aktuální stav služby (aktivní/zastavená), stav připojení, odpočet do další aktualizace a počet pozic v mezipaměti.
  - Umožňuje uživateli spustit a zastavit `LocationService` pomocí tlačítka ON/OFF.
  - Zobrazuje konzoli s logy z `ConsoleLogger`.
  - Zajišťuje, že jsou udělena všechna potřebná oprávnění před spuštěním služby.
  - Umožňuje odhlášení uživatele dlouhým stiskem tlačítka ON/OFF.

- **`LocationService.kt`**:
  - Služba běžící na popředí (`Foreground Service`), která je zodpovědná za sběr dat o poloze.
  - Používá `FusedLocationProviderClient` pro efektivní zjišťování polohy.
  - V pravidelných intervalech (nastavených serverem) získává novou polohu.
  - Každou získanou polohu ukládá do lokální Room databáze (`AppDatabase`).
  - Po dosažení určitého počtu uložených pozic (nastaveno serverem) naplánuje `SyncWorker` pro odeslání dat.
  - Informuje `MainActivity` o svém stavu pomocí `LocalBroadcastManager`.

- **`SyncWorker.kt`**:
  - Spolehlivá úloha na pozadí (`WorkManager`), která zajišťuje odeslání nasbíraných dat na server.
  - Spustí se, pouze pokud je zařízení připojeno k internetu.
  - Načte všechny pozice z `AppDatabase`.
  - Odešle je jako JSON pole na serverový endpoint `/api/devices/input`.
  - V případě úspěšného odeslání smaže odeslané pozice z lokální databáze.
  - Pokud server v odpovědi pošle nové konfigurační intervaly, aktualizuje je v `SharedPreferences` a restartuje `LocationService`.
  - V případě chyby (např. server nedostupný) se `WorkManager` postará o opakování úlohy později.

- **`AppDatabase.kt`, `LocationDao.kt`, `CachedLocation.kt`**:
  - Komponenty pro lokální databázi (Room).
  - `CachedLocation` definuje datovou strukturu pro uloženou pozici (souřadnice, rychlost, čas, ID zařízení atd.).
  - `LocationDao` poskytuje metody pro vkládání, čtení a mazání dat.
  - `AppDatabase` je hlavní třída databáze.

- **`SharedPreferencesHelper.kt`**:
  - Pomocná třída pro práci s `EncryptedSharedPreferences`.
  - Zajišťuje bezpečné uložení citlivých dat jako session cookie, ID zařízení a autentizační stav.

### Knihovny a Závislosti:

- **`androidx.room`**: Pro lokální databázi.
- **`androidx.work`**: Pro spolehlivé úlohy na pozadí.
- **`com.google.android.gms:play-services-location`**: Pro získávání polohy.
- **`androidx.security:security-crypto`**: Pro šifrování `SharedPreferences`.
- **`com.google.code.gson`**: Pro práci s JSON.
- **`org.jetbrains.kotlinx:kotlinx-coroutines`**: Pro asynchronní operace.

## 3. Chování Aplikace

### 3.1. První Spuštění a Přihlášení

1.  Aplikace zobrazí `LoginActivity`.
2.  Uživatel zadá jméno a heslo.
3.  Aplikace vygeneruje a uloží unikátní `installationId`.
4.  Odešle přihlašovací údaje a `installationId` na server.
5.  Server ověří údaje.
    - Pokud je zařízení nové, aplikace ho zaregistruje.
6.  Server vrátí session cookie a konfigurační parametry (`gps_interval_seconds`, `sync_interval_count`).
7.  Aplikace uloží tyto údaje do šifrovaných `SharedPreferences` a přesměruje uživatele na `MainActivity`.

### 3.2. Sledování Polohy

1.  Uživatel v `MainActivity` stiskne tlačítko "ON".
2.  Aplikace zkontroluje, zda má potřebná oprávnění (přístup k poloze i na pozadí) a zda je GPS zapnuté.
3.  Spustí se `LocationService` jako služba na popředí (zobrazí se notifikace).
4.  Služba začne v nastaveném intervalu (`gps_interval_seconds`) přijímat aktualizace polohy.
5.  Každá nová poloha je uložena do Room databáze.
6.  Počet uložených pozic se inkrementuje.

### 3.3. Synchronizace Dat

1.  Jakmile počet uložených pozic dosáhne hodnoty `sync_interval_count`, `LocationService` naplánuje spuštění `SyncWorker`.
2.  `WorkManager` spustí `SyncWorker`, jakmile je k dispozici internetové připojení.
3.  `SyncWorker` načte všechny pozice z databáze a odešle je na server.
4.  Pokud server odpoví úspěšně (HTTP 200), `SyncWorker` smaže odeslané pozice z lokální databáze.
5.  Pokud server vrátí nové nastavení intervalů, `SyncWorker` je uloží a restartuje `LocationService`, aby se změny projevily.
6.  Pokud odeslání selže, `WorkManager` se pokusí úlohu zopakovat později, čímž je zajištěna odolnost proti výpadkům sítě.

## 4. Oprávnění

Aplikace vyžaduje následující oprávnění:
- `INTERNET`: Pro komunikaci se serverem.
- `ACCESS_NETWORK_STATE`: Pro zjištění stavu sítě.
- `ACCESS_FINE_LOCATION`: Pro přesnou GPS polohu.
- `ACCESS_COARSE_LOCATION`: Pro přibližnou polohu.
- `FOREGROUND_SERVICE` a `FOREGROUND_SERVICE_LOCATION`: Pro běh služby na pozadí na novějších verzích Androidu.
- `ACCESS_BACKGROUND_LOCATION`: Pro sledování polohy, i když aplikace není aktivní (Android 10+).

## 5. Zabezpečení

- **Šifrovaná Komunikace**: Aplikace komunikuje se serverem přes HTTPS (dle `API_BASE_URL`).
- **Ukládání Dat**: Citlivé informace (session cookie, ID zařízení, přihlašovací stav) jsou ukládány pomocí `EncryptedSharedPreferences`, což je chrání před neoprávněným přístupem na zařízení.
- **Autentizace**: Každý požadavek na odeslání dat je autentizován pomocí session cookie získané při přihlášení.
