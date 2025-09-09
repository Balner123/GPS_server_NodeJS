# Návod pro Implementaci do Android Studia

Tento dokument poskytuje detailní postup, jak zprovoznit kód této aplikace v novém, čistém projektu v prostředí Android Studio.

## Předpoklady

- Nainstalované **Android Studio** (poslední stabilní verze).
- Základní znalost prostředí Android Studia.
- Fyzické zařízení s Androidem nebo nastavený emulátor pro testování.

---

## Krok 1: Vytvoření nového projektu

1.  Otevřete Android Studio a zvolte **"New Project"**.
2.  Vyberte šablonu **"Empty Views Activity"** a klikněte na **Next**.
3.  Nastavte následující parametry:
    *   **Name:** `GPS Reporter App` (nebo název dle vaší volby)
    *   **Package name:** `com.example.gpsreporterapp` (Důležité: Pokud zvolíte jiný, musíte ho opravit ve všech `.kt` souborech na prvním řádku).
    *   **Save location:** Adresář vaší volby.
    *   **Language:** `Kotlin`
    *   **Minimum SDK:** `API 26: Android 8.0 (Oreo)` (Doporučeno pro `WorkManager` a `Foreground Services`).
    *   **Build configuration language:** `Kotlin DSL (build.gradle.kts)`
4.  Klikněte na **Finish** a počkejte, než Android Studio připraví projekt.

---

## Krok 2: Přidání potřebných závislostí a pluginů

Tento krok je rozdělen na dvě části: úpravu hlavního `build.gradle.kts` souboru pro celý projekt a úpravu souboru pro specifický modul `:app`.

### 2a: Úprava hlavního `build.gradle.kts` (v kořeni projektu)

Tímto krokem řekneme Gradlu, kde má najít KSP plugin, který je nutný pro fungování databáze Room.

1.  V projektové struktuře (doporučený pohled **"Project"**) otevřete soubor `build.gradle.kts`, který je v **nejvyšší úrovni** vašeho projektu (ne ten ve složce `app`).
2.  Ujistěte se, že blok `plugins` na začátku souboru vypadá následovně (klíčové je přidání `id("com.google.devtools.ksp")`):

    ```kotlin
    // Top-level build file
    plugins {
        id("com.android.application") version "8.2.2" apply false
        id("org.jetbrains.kotlin.android") version "1.9.22" apply false
        // Přidejte tento řádek pro KSP plugin
        id("com.google.devtools.ksp") version "1.9.22-1.0.17" apply false
    }
    ```

### 2b: Úprava `build.gradle.kts` modulu `:app`

Nyní aplikujeme KSP plugin a přidáme konkrétní závislosti pro náš aplikační modul.

1.  Otevřete soubor `build.gradle.kts`, který se nachází ve složce `app`.
2.  Na začátek souboru, do bloku `plugins`, přidejte `id("com.google.devtools.ksp")`:
    ```kotlin
    plugins {
        id("com.android.application")
        id("org.jetbrains.kotlin.android")
        id("com.google.devtools.ksp") // Přidejte tento řádek
    }
    ```
3.  Nahraďte celý blok `dependencies { ... }` následujícím obsahem:
    ```kotlin
    dependencies {

        implementation("androidx.core:core-ktx:1.12.0")
        implementation("androidx.appcompat:appcompat:1.6.1")
        implementation("com.google.android.material:material:1.11.0")
        implementation("androidx.constraintlayout:constraintlayout:2.1.4")
        testImplementation("junit:junit:4.13.2")
        androidTestImplementation("androidx.test.ext:junit:1.1.5")
        androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")

        // Služby polohy od Google
        implementation("com.google.android.gms:play-services-location:21.2.0")

        // Room - pro lokální databázi (cache)
        val room_version = "2.6.1"
        implementation("androidx.room:room-runtime:$room_version")
        ksp("androidx.room:room-compiler:$room_version")
        implementation("androidx.room:room-ktx:$room_version")

        // WorkManager - pro úlohy na pozadí
        val work_version = "2.9.0"
        implementation("androidx.work:work-runtime-ktx:$work_version")

        // Pro lokální broadcasty (komunikace mezi Service a Activity)
        implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")
    }
    ```
4.  Po všech úpravách klikněte na **"Sync Now"** v liště, která se objeví nahoře v Android Studiu.

---

## Krok 3: Zkopírování zdrojových souborů

1.  Smažte soubor `MainActivity.kt`, který Android Studio vygenerovalo automaticky.
2.  Nakopírujte **všechny soubory s koncovkou `.kt`** z adresáře `/apk/main/java/` tohoto projektu do zdrojového adresáře vašeho nového projektu v Android Studiu. Cílová cesta bude typicky:
    `[Váš Projekt]/app/src/main/java/com/example/gpsreporterapp/`

---

## Krok 4: Zkopírování Resource souborů

1.  Nakopírujte obsah adresáře `/apk/main/res/` z tohoto projektu do adresáře `[Váš Projekt]/app/src/main/res/` ve vašem novém projektu.
2.  Pokud se vás systém zeptá, zvolte **"Overwrite"** (Přepsat) pro všechny soubory.

---

## Krok 5: Úprava `AndroidManifest.xml`

1.  Otevřete soubor `app/src/main/AndroidManifest.xml`.
2.  Ujistěte se, že obsahuje následující oprávnění (měla by být vložena před tag `<application>`):

    ```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    ```

3.  Uvnitř tagu `<application>` zaregistrujte `LocationService`:

    ```xml
    <service
        android:name=".LocationService"
        android:foregroundServiceType="location" />
    ```

---

## Krok 6: Oprava importů

1.  Po zkopírování souborů je pravděpodobné, že Android Studio bude hlásit chyby u některých tříd, protože nebudou naimportovány.
2.  Otevřete postupně všechny zkopírované `.kt` soubory.
3.  Pro každý červeně označený název třídy:
    *   Klikněte na něj kurzorem.
    *   Stiskněte `Alt + Enter` (Windows/Linux) nebo `Option + Enter` (macOS).
    *   Z menu vyberte **"Import"**.
    *   Opakujte, dokud všechny červené chyby nezmizí.

---

## Krok 7: Sestavení a spuštění

1.  V horním menu Android Studia zvolte **Build -> Rebuild Project**. Tím se projekt kompletně vyčistí a znovu sestaví. Tento krok je důležitý, aby se správně spustil Room a vygeneroval potřebný kód.
2.  Po úspěšném sestavení můžete aplikaci spustit na emulátoru nebo fyzickém zařízení pomocí tlačítka **"Run 'app'"** (zelená šipka).

Po dokončení těchto kroků byste měli mít plně funkční a sestavitelný projekt v Android Studiu.
