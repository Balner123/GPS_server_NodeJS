
###### Princip aplikace serveru 

-  **Docker** kontejner s portem **":5000"**
- **Nginx** web server ve funkci **REVERSE_PROXY**
- pro doménu *"lotr-system.xyz"*
- **Certbot** pro SSL certfikáty s automatickou obnovou


---
### HARMONOGRAM VÝVOJE
---
- nápad 
- diskuze nad součástkami -> modul + deska + charger + batery // deska(+all moduls) + charger +batery
- nákup + dodání [esp32](https://www.laskakit.cz/lilygo-ttgo-t-call-v1-3-esp32-sim800l-wifi-gprs-modul/)
- pokusy s AT příkazy :[AT_requests_example](https://www.aeq-web.com/sim800-gprs-http-post-get-request-at-commands/?lang=en)
- knihovny : ArduinoJSON, EspSoftwareSerial, TinyGPSPlus, TinyGSM
- ---
- Oracle Cloud -> hosting
- Node.JS -> asynchronost (výhoda pro více zařízení) 
- MySql -> jednoduchá a jsem s ní nejvíce seznámen
- Docker -> pro snadné nasazení
---

**HISTORIE - PRECHODY**
přechod mezi deskami
//only HTTP --> HTTP SSL support


WEB SETUP
---
ORACLE_cloud, ubuntu 
domena (spaceship.com)
letsencrypt
reverseproxy
---

**problémy** 
- SIM800L nezvládá SSL certifikáty, tudíž komunikace probíhá pouze na HTTP (?)
- OTA aktualizace -> buď aktualizace : celého kodu (i s OTA funkcí) NEBO jenom GPS+SIM kod (potřeba special partitioning on ESP32)

---
**Zapojení** 
![[schema.png]]

**problémy** : NPN ovládání země není dobrá volba : bylo by potřeba ovládat VCC do GPS, (potřeba mosfet)

**GPT-5** postoj a analýza : [[Fungování zapojení - c7e29965f.pdf]]

> [!NOTE] analyza
>  Přerušená zem přes NPN: vypínat zem zařízení je špatná praxe – vzniká falešné napájení přes signálové piny a dělá to problémy s referencí. Všechny GND musí být trvale společné. Pokud chcete GPS vypínat, vypínejte VCC high‑side spínačem (P‑MOSFET nebo hot‑swap/ load‑switch), nebo použijte pin EN/PWR na modulu GPS. - UART úrovně: A7670E pracuje s I/O 1.8 V, zatímco většina GPS modulů má 3.3 V. Přímé propojení RX/TX GPS → A7670E může A7670E poškodit. Vložte obousměrný převod úrovní 3.3 V ↔ 1.8 V, anebo připojte GPS přímo k ESP32 (3.3 V) a s modemem nepropojujte. - Back‑powering při vypnuté GPS: pokud budete GPS vypínat, zajistěte, aby se přes RX/TX nevracel proud (např. sériové odpory 1–4.7 k nebo odpojování signálů, ideálně level‑shifter to řeší). - Decoupling: na napájení GPS dejte co nejblíže kondenzátory (min. 100 nF + 4.7–10 μF).


---

- přechod na **T-Call A7670** (z důvodu zkratu, a výhod : SSL podpory + LTE podpora)
- návrh krabičky pro GPS Tracker (3D tisk)
- APK pro android -> pouze odesílaní na pevnou adresu (přes internetové spojení)
	- tvořena v : ***ANDROID STUDIO***
- dva Přepínače na trackeru : ON/OFF + OVA. web server s OTA možností
- grafický redump systému
- koupě domény -> setup serveru + reverse proxy pro https ([lotr-system.xyz](https://lotr-system.xyz))

---

- uživatelské účty v systému
- administrační náhled do DB pro "root:root" uživatele
- registrace a přihlášení uživatelů , správa jejich zařízení , Nutnost registrace zařízení k uživateli (zatím HW ID : 9-místné číslo)
- přidání registraci, přihlášení pomocí E-mailové adresy
- Ověření e-mailové adresy pomocí 4-místného kodu 
	 Gmail adresa pro server : lotr-system.cz@gmail.com 
	```"nodemailer" : "^1.14"```
- nastavení uživatelského účtu 
		možnost změny : 
			- emailové adresy
			- hesla
			- uživatelského jména
		odstranění účtu + jeho dat a zařízení
- webový server OTA režimu zařízení zobrazuje ID zařízení vytvořené z MAC adresy

problémy
 - nevyřešeny funkce a principy fungování APK pro android

---
- instalace APK -> login (username/email :password) -> samotná služba
- možnost "Log Out"
-  APK ID (nyní UUID) závislé na instalaci
- login != registrace na serveru
- server upraven pro komunikaci s APK (routy+controllers)

Problémy:

---
Poznámky:
	- ***geminy2.5*** začíná ztrácet se v komplexnosti programu
	- je tedy každý pokrok promítnout do **README.md** souborů
	- popis -> APK, Serveru, HW .ino, DB
	- musí být zachována struktura.
Plány: 
	- Sloučení funkcí HW  a APK ? 
	- **HW v OTA režimu** -> Login stejný jako u aplikace, vyřešilo by to registraci
	- registrace = automatická , veškerá funkce Manuální registrace na serveru odpadá

---

AKTUÁLNÍ PLÁNK FUNKČNOSTI
	- sledování hloupých aut
	- sledování dětí
	- firemních mobilů
	- firemních automobilů
	- kamionů (přilepit na nápravu)
	- atd.

PLÁNY 
	APK 
		- zamknutí -> "runaway detection"
		- odeslání reportu při odinstalaci
		- menu : logout, Lock_device
		- větší adaptivnost : rekce na špatný signál, bez intenetu -> "cachovaní pozic"
		- mnohostní odesílání po znonabytí spojení 
		- záloha signálu s SMSkami ???
		- Grafická uprava !!!
	SERVER
		- Schopnost příjmu "cachovanych" pozic ze zařízení  --> OK
		- při reportu vydat výstražný e-mail
		- možnost změny NÁZVU zařízení a možnost přidání popisku
		- E-SIM ???
		-  grafická uprava !!!
		- funkce přídaní zony na mapu k zařízení -> detekce opuštení přidělené zony zařízením -> výstražný e-mail 
	HARDWARové ZAŘÍZENÍ
		- cachování ? 
		- možnost změnu modu -> odesílání jednotlivých poloh v pravidelných intervalech
		- NEBO odesílání dávek poloh v intervalu (co 10 pozic 1 odeslání)
		- lepší responzivita na selhání odeslání -> přejít do "cache" režimu
		- registrace zařízení pomocí přihlášení // nebude potřebné zadání ID na serveru, (automatické)
		- guma pro zavření krabičky
		- + její samotné složení


---
- registrace HW update -> OTA server -> login username:password
- server dokáže přijímat "bulks" dat 

- další bude  cachování + funkce mapy ohraničení + APk zámek, grafika + statistiky lepší

---

- funkce geo-fence přidána


* plán pro 3. režim kdy zařízení cachuje neustále a porovnává zda se poloha změnila o nezanedbatelnou vzdálenost, pokud ne tak neodešle nic (aktualizuje posldni polohu) a čeká na další zisk.


---

- přidán pre-processing dat při cestě na frontend -> clustrace bodu na mapě i vy výpisu pokud je lze považovat za neměnou polohu v určitém časovém období

- přidána /docs s dokumentací pro analýzy a kontext

- revidován přístup k "cable-managmentu" a schránce jako takové 
- je potřeba nová nebo aktualizovaná schránka a její kontrukce,
- otevřený bok s dobrým přístupem pro konfiguraci

---

- přídána "third party authentification" --> GOOGLE, GITHUB
- nasazeno na server --> možnost napojení n8n a hloupého chatbota s pomocí Gemini API klíče
- zkouška latexu



---
- power modul for graceful shutdown -> klopný obvod push-on /push-off-with delay
- funkce pro analýzu GPX dat z trackerů

---


problémy :
	- logování apk -> neodpovídá skutečnosti , seká se , výchozí stav je po registraci ON ale služba se nespustí
	- Posílání ALERT emailu pouze jednou ne v cyklu, nefunguje zrušení alertu (+ přidat email po navrácení zpět do oblasti geofence)
	- Cluster se nezobrazuje správně na mapě , jeho průměrné souřadnice se nepočítají a proto zůstane na zžejmě výchozí pozici 0,0 (oceán u afriky)

modely pro krabičku : [[Assembly1.iam – zástupce.lnk]]
![[Pasted image 20250817164326.png]]