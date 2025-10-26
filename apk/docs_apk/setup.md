# Build a spuštění

## Požadavky
- Android Studio (Giraffe+)
- Android SDK 35
- Zařízení s Android 8.0 (API 26) a vyšší

## Kroky
1. Otevřete projekt v Android Studiu (složka `apk/main`).
2. Nechte stáhnout závislosti Gradle.
3. Sestavte a spusťte na zařízení.
4. Při prvním spuštění povolte oprávnění k poloze (včetně na pozadí pro Android 10+).
5. Přihlaste se, případně zaregistrujte zařízení (probíhá automaticky po přihlášení, pokud je potřeba).

## Server URL
- Výchozí `API_BASE_URL` je z `build.gradle.kts`.
- Pro testování můžete dlouhým stiskem názvu aplikace na login obrazovce zobrazit a změnit URL serveru; hodnota se uloží do `server_url` (EncryptedSharedPreferences).

## Tipy
- Pro produkci zvažte vypnutí `usesCleartextTraffic` v manifestu a použití pouze HTTPS.
- Pokud chcete rychle otestovat synchronizaci, snižte `sync_interval_count` na serveru (nebo v SharedPrefs) a sledujte konzoli logů.
