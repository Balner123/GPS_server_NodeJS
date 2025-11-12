# Přehled aplikace

Aplikace slouží ke spolehlivému sběru GPS polohy na zařízení se systémem Android a k dávkovému odesílání nasbíraných pozic na server.

## Cíle
- Foreground služba s minimálními výpadky
- Odolnost proti chybám sítě (dočasné cachování poloh v Room)
- Jednoduché ovládání pro koncové uživatele (ON/OFF, přihlášení/odhlášení)
- Vzdálená konfigurace intervalů skrze serverové odpovědi
- Telemetrie napájecího stavu a respektování serverových `TURN_OFF` instrukcí

## Klíčové komponenty
- **LoginActivity** – přihlášení na `/api/apk/login`, registrace a uložení session/intervalů do EncryptedSharedPreferences
- **LocationService** – foreground sledování polohy, ukládání do DB a spouštění synchronizací; stav UI se synchronizuje s perzistentním `power_status`
- **SyncWorker** – dávkované odesílání na `/api/devices/input`, mazání odeslaných záznamů a aplikace serverových instrukcí (včetně plánování potvrzovacího handshake při `TURN_OFF`)
- **HandshakeManager / HandshakeWorker** – okamžitý i periodický handshake pro refresh konfigurace a potvrzení změn napájecího stavu
- **Room DB (`AppDatabase`)** – tabulka `location_cache` pro lokálně uložené pozice s `powerStatus`
- **MainActivity** – zobrazení stavu, log konzole, odhlášení, reakce na broadcasty o stavu či vynuceném logoutu

## Tok dat
1. `LocationService` ukládá nové GPS fixy do Room a při dosažení limitu plánuje `SyncWorker`.
2. `SyncWorker` odesílá dávky, maže úspěšně odeslané pozice a podle odpovědi serveru upravuje intervaly nebo spouští vypnutí.
3. Při `TURN_OFF` se služba okamžitě zastaví, UI přejde do OFF a handshake je zopakován (synchronně/na pozadí), aby server získal potvrzení.
4. Periodický `HandshakeWorker` udržuje konfiguraci aktuální i bez nových GPS fixů.
