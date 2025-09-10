### LOTR - Location Tracker System

## Popis a cíl projektu

Projekt LOTR (Location Tracker) je systém pro GPS sledování, který zahrnuje vlastní hardware, backendový server s webovým rozhraním, a APk pro Android (možná i jiné OS). 

### Klíčové Funkce

*   **Hardware:** Nízkoenergetické zařízení postavené na desce LilyGO T-Call (ESP32 + A7670E SIM modul), které v periodických intervalech zjišťuje polohu a odesílá ji na server.
*   **Server:** Backend v Node.js (Express), který přijímá data, ukládá je do MySQL databáze a poskytuje API pro webové rozhraní.
*   **Webové rozhraní:** Umožňuje vizualizaci aktuální i historické polohy zařízení na mapě a konfiguraci jeho chování. nastavení dohledu (omezení plochy s výstrahou poopupuštění etc.), uživatelské učty + administrativní vhled do DB
*   **Aplikace** funkce stejného rázu jako HW zařízení + funkce "Dohledu" , "zamknutí" + "runaway report"

### Funkce

*   **Bezpečná registrace zařízení:** Zařízení se neregistruje manuálně. Místo toho se v servisním (OTA) režimu pomocí WiFi a webového serveru běžícího přímo na zařízení přihlásí k uživatelskému účtu a tím se bezpečně spáruje.
*   **Inteligentní odesílání dat:** Zařízení podporuje dva režimy odesílání, které lze konfigurovat:
    1.  **Simple Mode:** Zjištění polohy a okamžité odeslání.
    2.  **Batch Mode:** Zařízení nejprve nasbírá určený počet poloh do interní paměti (cachování) a poté je odešle najednou v dávce. Tento režim výrazně šetří baterii snížením počtu síťových připojení.
*   **Odolnost vůči výpadkům:** Díky cachování zařízení neztratí data, pokud dočasně ztratí připojení k síti. Všechny nasbírané body odešle, jakmile je připojení opět dostupné.

## Demo serverové části
pokusy o serverovou část (Node.js)
[GPS_server_Node_JS_demo](https://lotr-system.xyz)

## Technologie a Hardware

### Software
Node.JS -> vybrán pro asynchronost a znalost
  + express -> minimalistiký
  + jakékoliv moduly
Možnost jakýchkoliv frontend frameworků

### Hardware

[lilygo t-call v1.0 A7670E](https://github.com/Balner123/GPS_server_NodeJS/blob/LilyGO-T-A76XX-main/MAIN/gps_tracker.ino)

[Multi-GNSS polohovací modul – L76K – GPS, BeiDou (BDS), GLONASS, QZSS – Waveshare 23721](https://botland.cz/gps-moduly/22732-multi-gnss-polohovaci-modul-l76k-gps-beidou-bds-glonass-qzss-waveshare-23721.html)

[Li-ion cell charger TP4056 with microUSB protection and STEP-UP booster ](https://www.laskakit.cz/nabijecka-li-ion-clanku-tp4056-boost-mt3608/)

[GeB Li-Ion Battery 1x18650 1S1P 3.7V 3200mAh  | LaskaKit](https://www.laskakit.cz/en/geb-li-ion-baterie-1x18650-1s1p-3-7v-3200mah/)

+ knihovny 

### Další součásti
 APK -> pro android a její vyvěšení na Google play (?)
 3D tisknutá schránka pro hardwerovou část (!)

## Postup a vývoj+ milníky

- definování cílů -> základem byl fyzický Tracker -> server minimáně
- přechod na t-cal v1.0  místo v1.4 (lepší SIM modul + zkratování původní desky)
- větší zaměření na serverovou část
- více v "Poznámky k vývoji projektu.pdf" (neaktualizované z data 20.8)
- PLANY.txt
- a jakekoliv readme v podadresářích součástí projektu
- zbylá dokumentace je vedená v "Obsidian" bude exportována průběžně

----



