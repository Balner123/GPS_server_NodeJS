# Přehled aplikace

Aplikace slouží ke spolehlivému sběru GPS polohy na zařízení se systémem Android a k dávkovému odesílání nasbíraných pozic na server.

Cíle:
- Běžet spolehlivě na pozadí jako foreground služba
- Odolnost proti výpadkům sítě (dočasné cachování do Room DB)
- Jednoduché ovládání uživatelem (ON/OFF, přihlášení/odhlášení)
- Možnost vzdáleně měnit intervaly sběru/odesílání (z odpovědi serveru)

Hlavní části:
- Login a registrace zařízení
- Sledování polohy (`LocationService`)
- Lokální databáze (Room)
- Synchronizace (`SyncWorker` + WorkManager)
- UI (`MainActivity`, přehled stavu, konzole logů)
