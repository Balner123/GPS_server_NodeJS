# Uživatelský manuál - GPS Reporter App

Tato aplikace slouží pro sledování polohy zařízení a její odesílání na centrální server. Je navržena tak, aby fungovala spolehlivě na pozadí i při vypnuté obrazovce.

## 1. První spuštění a Přihlášení

Při prvním spuštění vás uvítá přihlašovací obrazovka.

1.  **Server URL:** Ve výchozím stavu je nastavena produkční adresa.
    *   *Tip:* Pokud potřebujete změnit URL serveru, **dlouze podržte nadpis "GPS Reporter"** v horní části obrazovky. Zobrazí se skryté pole pro editaci URL.
2.  **Přihlašovací údaje:** Zadejte své uživatelské jméno a heslo.
3.  **Installation ID:** Aplikace si automaticky vygeneruje unikátní 10místné ID zařízení. Toto ID se při prvním přihlášení zaregistruje k vašemu účtu.

## 2. Hlavní obrazovka a Ovládání

### Spuštění sledování (START)
Stiskněte velké tlačítko **ON**. Aplikace provede sérii kontrol:
1.  **Zapnutá GPS:** Pokud je GPS vypnutá, budete vyzváni k jejímu zapnutí.
2.  **Oprávnění:** Postupně se zobrazí žádosti o oprávnění.
    *   **Poloha (Přesná):** Nutné pro fungování.
    *   **Notifikace:** Nutné pro zobrazení stavu v liště (Android 13+).
    *   **Poloha na pozadí (DŮLEŽITÉ):** Aplikace vás vyzve k nastavení "Povolit vždy" (Allow all the time). **Bez tohoto oprávnění nebude aplikace fungovat, když zhasnete displej.**

### Zastavení sledování (STOP)
Stiskněte tlačítko **OFF**.
*   **Standardní režim:** Sledování se okamžitě ukončí.
*   **Řízený režim:** Pokud server vyžaduje potvrzení ukončení jízdy, tlačítko se změní na stav "Čekám na potvrzení". Aplikace se nevypne úplně, dokud server (dispečer) ukončení nepotvrdí nebo dokud neuplyne časový limit.

### Odhlášení
Pro odhlášení uživatele **dlouze podržte tlačítko ON/OFF**.

## 3. Informační panel

Na hlavní obrazovce vidíte několik důležitých údajů:

*   **Status:** Aktuální stav služby (např. "Tracking active", "Waiting for GPS").
*   **Last Connection:** Výsledek posledního pokusu o spojení se serverem.
*   **Countdown:** Odpočet do příštího odeslání dat.
*   **Cached positions:** Počet bodů uložených v telefonu, které čekají na odeslání (např. když není signál).
    *   *Pokud je číslo vysoké (>100), zkontrolujte připojení k internetu.*

## 4. Diagnostika a Řešení problémů

### Konzole (Logy)
Ve spodní části obrazovky běží výpis událostí (logů).
*   **Možnosti zobrazení:** Dlouhým stisknutím oblasti logů (karty) otevřete menu, kde můžete filtrovat úroveň detailů (INFO, DEBUG, ERROR) nebo logy smazat.

### Časté problémy

**Aplikace přestala sledovat po zhasnutí displeje:**
*   Příčina: Pravděpodobně nemáte povoleno oprávnění "Poloha na pozadí" nebo systém Android aplikaci uspal pro úsporu baterie.
*   Řešení: Jděte do Nastavení telefonu -> Aplikace -> GPS Reporter -> Oprávnění -> Poloha a ujistěte se, že je zaškrtnuto **"Povolit vždy"**.

**Stav "Waiting for TURN_OFF confirmation" nezmizí:**
*   Příčina: Aplikace odeslala požadavek na ukončení, ale server neodpovídá (žádný signál) nebo dispečer jízdu neukončil.
*   Řešení: Zkontrolujte internet. Pokud problém přetrvává, kontaktujte dispečink.

**Chyba "Device not registered":**
*   Pokud se zobrazí tato hláška, vaše instalace byla na serveru smazána nebo zablokována. Aplikace vás automaticky odhlásí. Je nutné se znovu přihlásit (což provede novou registraci).

## 5. Technické detaily

*   **Databáze:** Data se ukládají lokálně do SQLite. Při ztrátě signálu se data neztratí, odešlou se, jakmile bude síť dostupná.
*   **Intervaly:** Interval snímání GPS (default 60s) a odesílání (default po 1. bodu) jsou řízeny centrálně serverem. Po přihlášení se mohou změnit.
