# Maturitní projekt - návrh tématu -> LOTR - Locatin Tracker

 > Celý tento návrh je psán s uvědoměním vlastní neznalosti
### Popis a cíl projektu : 
  Mělo by se jednat o **GPS Tracker** (sledovač) který dle nastavení jednou za určitou dobu (odmlka odpočítávána v režimu Hibernace) odešle souřadnice pomocí AT-commands
  : Přejde do aktivního režimu -> zapne modul GPS -> zjistí souřadnice -> zapne SIM/LTE modul -> odešle souřadnice + id zařízení na server --> následně vypne všechny moduly a přejde zět do hibernace

  Server (NodeJS , Django, nebo jiné...) by data ukládal do databáze (např. souborová SQL lite) + dále zpracovával pro zobrazení na mapě (google-maps API atd.) .

  Server by také fungoval jako server webový pro : prohlížení + konfiguraci jednotlivých zařízení -> to by byla možnost změny časové odmlky mezi odesíláním souřadnic ( zařízení by si tedy muselo od serveru vždy při odesílání také vyžádat informaci zda byla jeho konfigurace změněna a pokud ano tak ji přijmout)

navržené schéma : 
![canvas_gps-tracker-250402_1054](https://github.com/user-attachments/assets/b7b05b27-2b20-41fa-aff2-bb8e206cb694)

Hardwarová čast by také mohla být zapozdřena v 3D tisknuté krabičce...

## Demo serverové části
první pokusy o minimální serverovou část (Node.js)
[GPS_server_Node_JS_demo](http://79.72.18.205:5000)
heslo=>"admin123" PS: prosím neměnit!
## Demo kódu pro hardware 
první pokusy o funkční kód pro hardware (ESP32)

[lilygo_Esp32_SIM800l-code](https://github.com/Balner123/GPS_server_NodeJS/blob/main/gps.ino) ## již nefunkční  a zastaralé 

[lilygo t-call v1.0 A7670E](https://github.com/Balner123/GPS_server_NodeJS/blob/LilyGO-T-A76XX-main/MAIN/gps_tracker.ino) ## nová verze pro trocu jinou desku

## Součástky pro hardwarou část

[LilyGO TTGO T-Call V1.4 ESP32 SIM800L WiFi GPRS Modul | LaskaKit](https://www.laskakit.cz/lilygo-ttgo-t-call-v1-3-esp32-sim800l-wifi-gprs-modul/)

[Multi-GNSS polohovací modul – L76K – GPS, BeiDou (BDS), GLONASS, QZSS – Waveshare 23721](https://botland.cz/gps-moduly/22732-multi-gnss-polohovaci-modul-l76k-gps-beidou-bds-glonass-qzss-waveshare-23721.html)

[Li-ion cell charger TP4056 with microUSB protection and STEP-UP booster ](https://www.laskakit.cz/nabijecka-li-ion-clanku-tp4056-boost-mt3608/)

[GeB Li-Ion Battery 1x18650 1S1P 3.7V 3200mAh  | LaskaKit](https://www.laskakit.cz/en/geb-li-ion-baterie-1x18650-1s1p-3-7v-3200mah/)

