# Build a spuštění

Tento dokument popisuje základní požadavky a postup pro sestavení a spuštění Android klienta pro vývoj a testování.

## Požadavky

- Android Studio (Giraffe nebo novější).
- Android SDK 35.
- Cílová zařízení: Android 8.0 (API 26) a vyšší.

## Postup sestavení a nasazení

1. Otevřete projekt v Android Studiu (adresář projektu s modulem `apk/main`).
2. Nechte stáhnout a synchronizovat závislosti Gradle.
3. Sestavte aplikaci a nasazení proveďte na fyzickém zařízení nebo emulátoru s povolenými Google Play služby, pokud jsou vyžadovány.
4. Při prvním spuštění udělte požadovaná oprávnění (především lokalizace a oprávnění pro provoz na pozadí, pokud je cílové API vyžaduje).
5. Přihlaste se; pokud je zařízení neregistrované, proběhne automatická registrace vůči serveru.

## Konfigurace serveru

- Výchozí `API_BASE_URL` je definován v {login screen}; hodnota se uloží do `EncryptedSharedPreferences` pod klíčem `server_url`.
