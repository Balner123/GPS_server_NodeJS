## Build a nasazení (PlatformIO)

1. Otevřete root projektu a načtěte jej v VS Code s nainstalovaným PlatformIO.
2. Zkontrolujte `platformio.ini` (výchozí `default_envs = T-Call-A7670X-V1-0` a `src_dir = MAIN`).
3. Inicializujte souborový systém (Upload Filesystem Image) pro `LittleFS` před prvním nasazením.
4. Nahrajte firmware (`Upload`).

## První spuštění a servisní režim

Servisní (OTA) režim slouží pro konfiguraci a registraci zařízení bez nutnosti fyzického přístupu k sériovému rozhraní.

1. Při napájení držte tlačítko (GPIO32) stisknuté minimálně 2 s pro vstup do servisního režimu.
2. Zařízení aktivuje Wi‑Fi AP (výchozí SSID: `lotrTrackerOTA_<DeviceID>`); připojte se a otevřete `http://192.168.4.1`.
3. V rozhraní zadejte přihlašovací údaje a konfiguraci sítě pro OTA/registraci.
4. Po úspěšné registraci zařízení restartujte a ověřte běh v tracker režimu.