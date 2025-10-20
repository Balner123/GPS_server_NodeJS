# GPS Tracker Firmware

Tento adresář obsahuje firmware pro hardwarovou GPS jednotku postavenou na desce LilyGO T-Call A7670E.

## Klíčové Funkce

- Periodické zjišťování GPS polohy.
- Komunikace se serverem přes GPRS (HTTPS).
- Inteligentní cachování dat a odesílání v dávkách pro úsporu energie.
- Odolnost vůči výpadkům sítě (data se neztratí).
- Dva provozní režimy: normální a servisní (OTA).

## Kompilace a Nahrání (PlatformIO)

1.  Otevřete tento adresář (`LilyGO-T-A76XX-main`) ve Visual Studio Code s nainstalovaným doplňkem PlatformIO.
2.  Ujistěte se, že v souboru `platformio.ini` je jako `default_envs` nastavena vaše deska (`T-Call-A7670X-V1-0`).
3.  **Důležité:** Před prvním nahráním je nutné inicializovat souborový systém. Spusťte úlohu `Upload Filesystem Image`.
4.  Nahrajte firmware do zařízení pomocí úlohy `Upload`.

## První Spuštění a Registrace Zařízení

Zařízení se již neregistruje manuálně na serveru. Místo toho se používá bezpečný proces párování.

1.  **Přepněte zařízení do servisního (OTA) režimu** pomocí hardwarového přepínače (pin GPIO23 na 3.3V).
2.  Zapněte zařízení. Zařízení vytvoří WiFi síť s názvem `GPS_Tracker_OTA`.
3.  Připojte se k této WiFi síti (heslo je "password", pokud nebylo změněno v kódu).
4.  Otevřete v prohlížeči adresu `http://192.168.4.1` (nebo IP adresu, kterou uvidíte v sériovém monitoru).
5.  Zobrazí se vám servisní stránka, která ukazuje stav připojení k mobilní síti.
6.  Vyplňte do formuláře své přihlašovací jméno a heslo k vašemu účtu na serveru a klikněte na "Register Device".
7.  Stránka vám zobrazí výsledek operace.
8.  Po úspěšné registraci **vypněte zařízení, přepněte přepínač zpět do normálního režimu a zařízení znovu zapněte**.

Zařízení je nyní spárované s vaším účtem a začne v normálním režimu odesílat data.
