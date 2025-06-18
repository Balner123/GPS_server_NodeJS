# Maturitní projekt -> LOTR - Location Tracker

## Popis a cíl projektu : 

#### Hardware
  Mělo by se jednat o **GPS Tracker** (sledovač) který dle nastavení jednou za určitou dobu (odmlka odpočítávána v režimu Hibernace) odešle souřadnice pomocí AT-commands
  : Přejde do aktivního režimu -> zapne modul GPS -> zjistí souřadnice -> zapne SIM/LTE modul -> odešle souřadnice + id zařízení na server --> následně vypne všechny moduly a přejde zět do hibernace
#### Software
  Server (NodeJS , Django, nebo jiné...) by data ukládal do databáze (např. souborová SQL lite) + dále zpracovával pro zobrazení na mapě (google-maps API atd.) .

  Server by také fungoval jako server webový pro : prohlížení + konfiguraci jednotlivých zařízení -> to by byla možnost změny časové odmlky mezi odesíláním souřadnic ( zařízení by si tedy muselo od serveru vždy při odesílání také vyžádat informaci zda byla jeho konfigurace změněna a pokud ano tak ji přijmout).
  
Hardwarová čast by také mohla být zapozdřena v 3D tisknuté krabičce...

## Demo serverové části
první pokusy o serverovou část (Node.js)
[GPS_server_Node_JS_demo](https://lotr-system.xyz)

heslo=>"lotrlotr" PS: "Heslo neměň, neb stihne tě trest!"
## Technologie a Hardware

### Software
Node.JS -> vybrán pro asynchronost a znalost
  + express -> minimalistiký
  + jakékoliv moduly
Možnost jakýchkoliv forntend frameworků
### Hardware

[lilygo t-call v1.0 A7670E](https://github.com/Balner123/GPS_server_NodeJS/blob/LilyGO-T-A76XX-main/MAIN/gps_tracker.ino) ## nová verze pro trocu jinou desku

[Multi-GNSS polohovací modul – L76K – GPS, BeiDou (BDS), GLONASS, QZSS – Waveshare 23721](https://botland.cz/gps-moduly/22732-multi-gnss-polohovaci-modul-l76k-gps-beidou-bds-glonass-qzss-waveshare-23721.html)

[Li-ion cell charger TP4056 with microUSB protection and STEP-UP booster ](https://www.laskakit.cz/nabijecka-li-ion-clanku-tp4056-boost-mt3608/)

[GeB Li-Ion Battery 1x18650 1S1P 3.7V 3200mAh  | LaskaKit](https://www.laskakit.cz/en/geb-li-ion-baterie-1x18650-1s1p-3-7v-3200mah/)

### Další součásti
 APK -> pro android a její vyvěšení na Google play (?)
 3D tisknutá schránka pro hardwerovou část (!)

## Postup a vývoj+ milníky

- definování cílů -> základem byl fyzický Tracker -> server minimáně
- přechod na t-cal v1.0  místo v1.4 (lepší SIM modul + zkratování původní desky)
- větší zaměření na serverovou část


----
navržené schéma : 
![canvas_gps-tracker-250402_1054](https://github.com/user-attachments/assets/b7b05b27-2b20-41fa-aff2-bb8e206cb694)



