# Postup Integrace Kódu do Android Studia a Kompilace Podepsané APK

Tento dokument vás provede procesem integrace upraveného kódu Android aplikace do vašeho stávajícího projektu v Android Studiu, jeho kompilací a vytvořením podepsané APK připravené k distribuci.

## 1. Předpoklady

-   Máte nainstalované **Android Studio**.
-   Máte existující **projekt Android Studio**, do kterého chcete kód integrovat.
-   Máte základní znalosti práce s Android Studiem a Kotlinem.

## 2. Integrace Kódu do Projektu

### Krok 1: Přesun Souborů

Zkopírujte následující soubory do vašeho Android Studio projektu, do správných umístění:

-   **Kotlin soubory:**
    -   `apk/main/java/com/example/gpsreporterapp/LoginActivity.kt`
    -   `apk/main/java/com/example/gpsreporterapp/MainActivity.kt`
    -   `apk/main/java/com/example/gpsreporterapp/LocationService.kt`
    -   `apk/main/java/com/example/gpsreporterapp/FirstFragment.kt` (pokud existuje a je potřeba)
    -   `apk/main/java/com/example/gpsreporterapp/SecondFragment.kt` (pokud existuje a je potřeba)

    **Cíl:** `váš_projekt/app/src/main/java/com/example/gpsreporterapp/` (nebo odpovídající balíček vašeho projektu).

-   **Layout soubor:**
    -   `apk/main/res/layout/activity_login.xml`

    **Cíl:** `váš_projekt/app/src/main/res/layout/`.

### Krok 2: Aktualizace `AndroidManifest.xml`

Otevřete soubor `váš_projekt/app/src/main/AndroidManifest.xml` a proveďte následující úpravy:

1.  **Deklarace `LoginActivity`:** Ujistěte se, že je `LoginActivity` deklarována uvnitř `<application>` tagu:

    ```xml
    <activity
        android:name=".LoginActivity"
        android:exported="false" />
    ```

2.  **Ověření `LocationService`:** Zkontrolujte, zda je `LocationService` správně deklarována (měla by již být, ale ověřte):

    ```xml
    <service
        android:name=".LocationService"
        android:enabled="true"
        android:exported="false"
        android:foregroundServiceType="location" />
    ```

3.  **Ověření Oprávnění:** Ujistěte se, že jsou přítomna všechna potřebná oprávnění (měla by již být, ale zkontrolujte):

    ```xml
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    ```

### Krok 3: Aktualizace `build.gradle` (modul `app`)

Otevřete soubor `váš_projekt/app/build.gradle` a ujistěte se, že jsou v sekci `dependencies` přítomny následující knihovny. Pokud chybí, přidejte je:

```gradle
// build.gradle (Module :app)

dependencies {
    // ... vaše stávající závislosti

    implementation 'androidx.core:core-ktx:1.x.x' // Použijte nejnovější stabilní verzi
    implementation 'androidx.appcompat:appcompat:1.x.x' // Použijte nejnovější stabilní verzi
    implementation 'com.google.android.gms:play-services-location:21.x.x' // Použijte nejnovější stabilní verzi
    implementation 'androidx.localbroadcastmanager:localbroadcastmanager:1.x.x' // Použijte nejnovější stabilní verzi
    implementation 'androidx.core:core-splashscreen:1.x.x' // Použijte nejnovější stabilní verzi, pokud používáte SplashScreen

    // Pro JSON manipulaci (JSONObject je součástí Android frameworku, ale pro robustnější řešení lze použít např. Gson/Jackson)
    // Pokud narazíte na chyby s JSONObject, zvažte přidání:
    // implementation 'org.json:json:20231013' // Příklad, pokud by byl problém s vestavěným
}
```

### Krok 4: Synchronizace Projektu

Po provedení všech změn v souborech Gradle synchronizujte projekt. V Android Studiu klikněte na **File > Sync Project with Gradle Files**.

## 3. Kompilace a Vytvoření Podepsané APK

Pro distribuci aplikace (např. na Google Play Store nebo pro testování mimo Android Studio) potřebujete podepsanou APK.

### Krok 1: Generování Podepisovacího Klíče (pokud ještě nemáte)

1.  V Android Studiu jděte do **Build > Generate Signed Bundle / APK...**.
2.  Vyberte **APK** a klikněte na **Next**.
3.  V okně **Key store path** klikněte na **Create new...**.
4.  Vyplňte požadované informace:
    -   **Key store path:** Cesta k souboru `.jks`, který bude obsahovat váš klíč (uložte ho na bezpečné místo).
    -   **Key store password:** Heslo pro přístup k úložišti klíčů.
    -   **Key alias:** Jméno vašeho klíče (např. `my_app_key`).
    -   **Key password:** Heslo pro váš konkrétní klíč.
    -   **Certificate:** Vyplňte údaje o certifikátu (jméno, organizace, země atd.).
5.  Klikněte na **OK**.

### Krok 2: Podepsání APK

1.  V okně **Generate Signed Bundle or APK** se ujistěte, že je vybrán váš nově vytvořený (nebo existující) **Key store path**, **Key alias** a zadejte **Key store password** a **Key password**.
2.  Vyberte **Build Variants**: Pro produkční APK zvolte `release`.
3.  **Signature Versions:** Doporučuje se zaškrtnout obě možnosti:
    -   `V1 (Jar Signature)`: Kompatibilní se všemi verzemi Androidu.
    -   `V2 (Full APK Signature)`: Rychlejší instalace a lepší integrita, vyžaduje Android 7.0 (API 24) a vyšší.
4.  Klikněte na **Finish**.

### Krok 3: Nalezení Podepsané APK

Po úspěšné kompilaci a podepsání se v dolní části Android Studia objeví notifikace s odkazem **locate**. Kliknutím na něj se dostanete do složky, kde je podepsaná APK uložena. Typicky to bude ve složce `váš_projekt/app/release/`.

## 4. Důležité Poznámky

-   **HTTPS:** Pro produkční prostředí je **nezbytné** zajistit, aby váš server používal HTTPS. Aplikace je sice nastavena na `https://lotr-system.xyz`, ale ujistěte se, že váš server má platný SSL certifikát.
-   **Testování:** Po integraci kódu a kompilaci APK důkladně otestujte aplikaci na fyzickém zařízení, abyste ověřili funkčnost přihlášení, registrace zařízení a odesílání polohy.
-   **Chybové Hlášky:** Kód obsahuje základní zpracování chyb. Pro produkční aplikaci zvažte robustnější mechanismy pro logování chyb a jejich hlášení.
