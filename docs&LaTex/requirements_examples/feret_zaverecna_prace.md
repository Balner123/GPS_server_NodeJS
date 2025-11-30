Zde je kompletnì zpracovanı dokument do formátu **Markdown**. Zachoval jsem strukturu, formátování nadpisù, zvıraznìní kódu (C++/Arduino) a tabulky.

***

# ZÁVÌREÈNÁ STUDIJNÍ PRÁCE
## Dokumentace: Bezpeènostní systém se vzdálenım ovládáním

**Škola:** SŠPU Opava (Støední škola prùmyslová a umìlecká, Opava)  
**Autor:** Jakub Feret  
**Obor:** 18-20-M/01 INFORMAÈNÍ TECHNOLOGIE se zamìøením na poèítaèové sítì a programování  
**Tøída:** IT4  
**Školní rok:** 2017/2018

---

### Podìkování
Dìkuji panu uèiteli Ing. Petru Grussmannovi za cenné rady, panu uèiteli Mgr. Marcelu Godovskému za pomoc se souèástkami a panu uèiteli Mgr. Markovi Luènému za rady a pomoc pøi nahrání aplikace na školní hosting.

### Prohlášení
Prohlašuji, e jsem závìreènou práci vypracoval samostatnì a uvedl veškeré pouité informaèní zdroje.

Souhlasím, aby tato studijní práce byla pouita k vıukovım úèelùm na Støední prùmyslové a umìlecké škole v Opavì, Praskova 399/8.

**V Opavì 31. 12. 2017**  
*(podpis autora práce)*

---

## ANOTACE

Projekt se zabıvá tvorbou bezpeènostního systému s moností bezdrátového ovládání pøes WiFi. Skládá se z hardwarové a softwarové èásti. Základ hardwarové èásti tvoøí hlavnì vıvojová deska NodeMcu. Zaøízení pomocí ultrazvukového senzoru snímá vzdálenost k nejbliší pøekáce, a pokud se tato vzdálenost zmìní, spustí se program. Ten po uplynutí aktivaèní doby upozorní uivatele SMS zprávou na moné narušení bezpeènosti. Zaøízení lze aktivovat i deaktivovat zadáním hesla z klávesnice, popøípadì pomocí webové aplikace. Programová èást bezpeènostního systému je øešena v jazyce Arduino, co je kombinace jazykù C a C++. Druhou èást projektu tvoøí webová aplikace vyvinutá v jazyce PHP s vyuitím Nette Frameworku. Tato aplikace umoòuje po pøihlášení vzdálenì ovládat bezpeènostní zaøízení. Administrátor mùe kromì aktivace nebo deaktivace alarmu také upravovat èasové prodlevy pøed aktivací nebo spravovat uivatelské úèty.

**Klíèová slova:** Bezpeènost; NodeMcu; ESP8266; Nette; WiFi; bezdrátová komunikace; webová aplikace; Arduino; PHP

---

## OBSAH

1. **VİROBA BEZPEÈNOSTNÍHO SYSTÉMU**
2. **PRINCIP FUNGOVÁNÍ VZDÁLENÉHO OVLÁDÁNÍ**
3. **VYUITÉ TECHNOLOGIE**
    *   3.1 Hardware
        *   3.1.1 Seznam souèástek
        *   3.1.2 NodeMcu
        *   3.1.3 Ultrazvukovı senzor HC-SR04
        *   3.1.4 LCD displej 1602
        *   3.1.5 Membránová klávesnice 4x4
        *   3.1.6 Bzuèák a LED
    *   3.2 Napájení
    *   3.3 Software
        *   3.3.1 Jazyk Arduino
        *   3.3.2 Webová aplikace
        *   3.3.3 Arduino IDE 1.8.5
        *   3.3.4 NetBeans 8.2
        *   3.3.5 XAMPP 5.6.32
        *   3.3.6 Fritzing 0.9.3b
4. **ZPÙSOBY ØEŠENÍ A POUITÉ POSTUPY**
    *   4.1 Hardwarové zaøízení
        *   4.1.1 Nahrávání programu
        *   4.1.2 Popis fungování bezpeènostního systému
        *   4.1.3 Ovìøení hesla
        *   4.1.4 Zmìna hesla
        *   4.1.5 Pøipojení k WiFi
        *   4.1.6 Komunikace se serverem
    *   4.2 Webová aplikace
        *   4.2.1 Pøihlášení
        *   4.2.2 Nastavení
        *   4.2.3 Bezdrátová komunikace
5. **VİSLEDKY ØEŠENÍ**
    *   5.1 Podoba hardwarového zaøízení
    *   5.2 Podoba webové aplikace
    *   5.3 Bezdrátová komunikace
*   **ZÁVÌR**
*   **SEZNAM POUITİCH INFORMAÈNÍCH ZDROJÙ**
*   **SEZNAM PØÍLOH**

---

## ÚVOD

Rozhodl jsem se vytvoøit bezpeènostní systém se vzdálenım ovládáním prostøednictvím webové aplikace, protoe mi problematika Internetu vìcí, tedy propojení hardwarovıch zaøízení s Internetem, pøipadala velmi zajímavá a sám jsem si chtìl nìco takového vyzkoušet. Na podobném principu jako mùj bezpeènostní systém toti mùe fungovat napøíklad ovládání celıch chytrıch domácností, kde je moné tøeba z mobilního telefonu zapnout svìtla, nebo postavit na èaj. Bezpeènostní systém upozorní uivatele SMS zprávou, svìtelnım a zvukovım signálem na pohyb pøed senzorem. Zaøízení lze vyuít ke kontrole nemovitostí èi osobních pøedmìtù.

Hlavním cílem projektu však bylo propojit zaøízení se zabezpeèenou webovou aplikací a umonit tím jeho vzdálené ovládání. Uivatel se k aplikaci pøipojí pomocí uivatelského jména a hesla. Bìní uivatelé pak mohou systém bezpeènì aktivovat nebo deaktivovat. Administrátor má navíc monost zmìnit v aplikaci dobu do aktivace a do spuštìní alarmu. Zároveò mùe vytváøet nové uivatelské úèty, popøípadì upravovat nebo mazat souèasné.

Protoe se jednalo o mùj první projekt v této oblasti, zvolil jsem pro jeho realizace známé a dobøe zdokumentované technologie. S nìkterımi z nich, jako napøíklad s Nette Frameworkem, jsem se ji setkal ve škole. Hardwarovou èást tvoøí hlavnì vıvojová deska NodeMcu s WiFi modulem ESP8266 a k nìmu pøipojené další komponenty, o kterıch se ještì zmíním v dalších èástech dokumentace. Bezpeènostní zaøízení je naprogramováno v jazyce Arduino, jedná se o kombinaci jazykù C a C++. Webovou aplikaci øeším pomocí PHP frameworku Nette. Komunikace mezi aplikací a bezpeènostním zaøízením probíhá pøes WiFi na principu REST API.

V této dokumentaci podrobnì popisuji vırobu bezpeènostního systému a princip jeho fungování. Na zaèátku se zmiòuji o problémech, se kterımi jsem se setkal pøi vıvoji bezpeènostního zaøízení, pokraèuji popisem technologií nezbytnıch k jeho vırobì i k jeho souèasné funkènosti a rozebírám, jak funguje nejen samotné bezpeènostní zaøízení, ale i webová aplikace potøebná k jeho vzdálenému ovládání. V další èásti vysvìtluji, na jakıch principech funguje jejich vzájemná komunikace, a popisuji jednotlivé úkony obou èástí systému. V závìru se zabıvám souèasnou podobou bezpeènostního systému a hodnotím odvedenou práci.

---

# 1 VİROBA BEZPEÈNOSTNÍHO SYSTÉMU

První èást mého projektu pøedstavovalo sestavení samotného zaøízení. Protoe se jednalo o mou první zkušenost se sestavováním integrovanıch obvodù, vıbìru a nákupu souèástek pøedcházel zdlouhavı vızkum dané problematiky. Nejdøíve jsem se rozhodl jako základ mého zaøízení pouít vıvojovou desku Arduino UNO, zaloenou na mikrokontroléru ATmega328 od firmy Atmel. Pro komunikaci s webovou aplikací jsem vybral WiFi modul ESP8266-01. Toto spojení se však èasem ukázalo jako nepraktické a neefektivní, proto jsem se rozhodl nahradit jak Arduino UNO, tak ESP8266-01 vıvojovou deskou NodeMcu, která ji obsahuje WiFi modul ESP8266.

Vzhledem k tomu, e jsem s nakoupenımi souèástkami nikdy døíve nepracoval, rozhodl jsem se postupovat po malıch krocích. Zapojoval jsem jednu souèástku po druhé do nepájivého pole a hned jsem zkoušel její funkènost pomocí jednoduchıch pøíkladù v Arduino IDE. Finální verzi projektu jsem nejdøíve navrhl v programu Fritzing, kde jsem si odzkoušel rozvrení souèástek na nepájivém poli.

Po zapojení a odzkoušení všech souèástek jsem pøešel k programování samotného bezpeènostního systému. Pro tento úèel jsem zvolil programovací jazyk pøímo pro Arduino, co je kombinace jazykù C a C++. Kdy byla první èást projektu plnì funkèní, èekala mì ta pravá vızva – spojit zaøízení pøes WiFi s webovou aplikací a umonit tak jeho ovládání na dálku, co byl, jak jsem ji zmiòoval, hlavní cíl mého projektu.

Webovou aplikaci jsem se rozhodl vyøešit pomocí PHP frameworku Nette, se kterım jsem ji mìl zkušenost ze školy, spolu s databázovım systémem MySQL. Protoe se jedná o aplikaci urèenou pro ovládání bezpeènostního systému, snail jsem se ji co nejvíce zabezpeèit. Kadı uivatel aplikace se musí nejprve pøihlásit svım uivatelskım jménem a heslem. Administrátor pak mùe vytváøet, upravovat èi mazat uivatele a má také plnou kontrolu nad samotnım bezpeènostním zaøízením – mùe mìnit intervaly pøed aktivací a pøed spuštìním alarmu a samozøejmì také zaøízení na dálku zapnout nebo vypnout. Ostatní uivatelé pak mají monost zmìnit pouze vlastní pøihlašovací údaje a také mohou zapnout nebo vypnout alarm.

---

# 2 PRINCIP FUNGOVÁNÍ VZDÁLENÉHO OVLÁDÁNÍ

Propojení ESP8266 a webové aplikace jsem nejdøíve øešil tak, e jsem v aplikaci mìnil hodnoty v MySQL databázi a k nim jsem pak pøistupoval z ESP8266 pomocí knihovny MySQL Connector. To se ukázalo jako nevyhovující, jednak kvùli bezpeènosti a také kvùli tomu, e by toto øešení spolehlivì fungovalo pouze na lokální úrovni.

Rozhodl jsem se radìji vytvoøit jednoduché REST API. V aplikaci vypisuji hodnoty do JSON vıstupu a k tomu pøistupuji z ESP8266 pomocí HTTP GET poadavku. Pøijatá data pak pomocí knihovny ArduinoJson dekóduji a ukládám do promìnnıch, se kterımi pak mùu dále pracovat. Díky tomu jsem schopen alarm na dálku zapnout, popøípadì zmìnit jeho nastavení. Bylo však také potøeba zajistit, aby se server dozvìdìl o pøípadném manuálním vypnutí alarmu z klávesnice a zmìnil pak pøíslušnou hodnotu v databázi. Tento problém jsem vyøešil pomocí poadavku POST. Opìt vytváøím JSON vıstup, tentokrát ho však posílám do Nette webové aplikace, kde ho dekóduji a ukládám do databáze. Ani tento postup však není pøíliš vhodnı, zejména kvùli potøebì posílat v pravidelnıch intervalech poadavky na server (napøíklad kadıch deset vteøin, nejlépe ještì èastìji) a zjišovat, zda se hodnoty nezmìnily. To vede k velkému odbìru elektrické energie, co mi znemoòuje napájet zaøízení z baterie, jak jsem pùvodnì plánoval.

To by bylo moné, pokud bych zaøízení propojil se serverem bez nutnosti posílat na nìj kadou chvíli poadavky. Mohl bych tak uvést zaøízení do reimu spánku, dokud by nedostalo impuls k probuzení, napøíklad zmìnìním urèité hodnoty. Tím bych vıraznì sníil spotøebu elektrické energie. Chtìl jsem proto opìt zmìnit princip komunikace mezi webovou aplikací a ESP8266, konkrétnì jsem mìl v plánu pouít komunikaèní protokol MQTT, kterı umoòuje propojení se serverem bez nutnosti neustálého posílání poadavkù. Protoe však Nette MQTT nijak nepodporuje, bylo by nutné kompletnì pøepsat webovou aplikaci, nejlépe do jiného jazyka (napøíklad Pythonu), co by se mi bohuel nepodaøilo stihnout pøed termínem odevzdání projektu, a tak jsem zaøízení ponechal v souèasném funkèním, avšak ne zcela vyhovujícím stavu.

---

# 3 VYUITÉ TECHNOLOGIE

## 3.1 Hardware

### 3.1.1 Seznam souèástek
*   Vıvojová deska NodeMcu,
*   ultrazvukovı senzor HC-SR04,
*   LCD displej 1602,
*   LCD I2C sériové rozhraní
*   membránová klávesnice 4x4,
*   I2C sbìrnice PCF8574P,
*   5 V bzuèák,
*   èervená LED,
*   rezistor 330 ?,
*   obousmìrnı osmi-kanálovı pøevodník logickıch úrovní,
*   napájecí modul nepájivého pole,
*   2 nepájivé pole se 400 kontakty.

### 3.1.2 NodeMcu
Základ projektu tvoøí vıvojová deska NodeMcu (obrázek è. 1). Firmware obstarává WiFi modul ESP8266 od spoleènosti Espressif Systems, hardware je zaloen na modulu ESP-12E, ovšem s šesti GPIO piny navíc. NodeMcu tedy obsahuje 12 digitálních GPIO pinù a jeden analogovı pin (obrázek è. 2). Pro program je k dispozici pamì o velikosti 128 kB. Na rozdíl od vìtšiny ostatních komponentù, NodeMcu pracuje s napìtím 3,3 V.
*Obrázek è. 1 NodeMcu | Obrázek è. 2 Piny NodeMcu*

### 3.1.3 Ultrazvukovı senzor HC-SR04
Bezpeènostní systém funguje na principu ultrazvukovıch vln, které mìøí vzdálenost k nejbliší pøekáce. To zajišuje ultrazvukovı senzor HC-SR04, kterı je schopnı pomocí ultrazvukovıch vln zmìøit vzdálenost od dvou do 400 cm s pøesností plus mínus tøi milimetry. Úhel mìøení je 15 stupòù. Senzor po aktivaci automaticky pošle osm 40 kHz vln a èeká na odraenı signál. Pokud odraenı signál dorazí zpìt, senzor zaznamená èas od vyslání vlny k jejímu návratu. Vzdálenost se pak vypoèítá jako `doba od vyslání vlny k jejímu návratu * rychlost zvuku / 2` (obrázek è. 3). Pøi vymıšlení principu fungování bezpeènostního zaøízení jsem se rozhodoval mezi ultrazvukovım senzorem a pohybovım èidlem. Pro ultrazvukovı senzor jsem se rozhodl hlavnì proto, e pohybové èidlo po spuštìní snímá celou místnost a zaznamená jakıkoliv pohyb v dané místnosti. Nehodí se proto do domácností s volnì se pohybujícími zvíøaty. Ultrazvukovı senzor naproti tomu snímá pouze urèitou oblast pøímo pøed sebou, take pokud se nainstaluje na správné místo, je senzor schopen zaznamenat napøíklad otevøení dveøí, avšak zvíøe procházející kolem dveøí u nezaznamená.

```cpp
// Custom function for the Ultrasonic sensor
long getDistance() {
  // Clears the trigPin
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  // Sets the trigPin on HIGH state for 10 micro seconds
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  // Reads the echoPin, returns the sound wave travel time in microseconds
  duration = pulseIn(echoPin, HIGH);
  // Calculating the distance
  distance = duration * 0.034 / 2;
  return distance;
}
```
*Obrázek è. 3 Funkce pro získání vzdálenosti z ultrazvukového senzoru*

### 3.1.4 LCD displej 1602
Jako vıstupní zaøízení jsem pouil LCD displej 1602, kterı dokáe zobrazit 32 znakù na dvou øádcích (16 x 2). Kvùli omezenému poètu pinù na NodeMcu jsem pro pøipojení vyuil I2C sériové rozhraní, které mi umonilo pøipojit displej pouze dvìma vodièi. Funkènost displeje obstarává knihovna `LiquidCrystal_I2C`.

### 3.1.5 Membránová klávesnice 4x4
Uivatelskı vstup øeším pomocí membránové klávesnice o šestnácti klávesách (4 øádky a 4 sloupce). Pro fungování klávesnice je potøeba osm vodièù, pro které jsem však nemìl k dispozici dostatek pinù. Nejdøíve jsem se proto rozhodl zredukovat osm digitálních pinù na jeden analogovı, a to pomocí pole rezistorù. Vyuil jsem toho, e funkce `analogRead()` dokáe pøiøadit vstupní napìtí od 0 do 3,3 V èíselnım hodnotám od 0 do 1024. Díky rezistorovému poli bude po zmáèknutí kadé klávesy tato hodnota vdy jiná. Napsal jsem si tedy jednoduchou knihovnu v jazyce C++, která ke kadé hodnotì, kterou získám funkcí `analogRead()` z analogového pinu, pøiøadí danou klávesu. Bohuel po pøechodu z Arduino Uno na NodeMcu toto øešení vyústilo v øadu problémù, zejména kvùli nedokonalému vyvedení analogového pinu NodeMcu, na kterém jsem namìøil èetné vıkyvy signálu zpùsobující nepøedvídatelné chování kláves. Rozhodl jsem se proto vyøešit zapojení klávesnice pomocí I2C sbìrnice PCF8574P, podobnì jako u LCD displeje.

Protoe je díky I2C sbìrnici klávesnice pøipojená ke stejnım pinùm jako LCD displej, zbıvá mi dostatek pinù pro ostatní komponenty. Aby to však bylo moné, nesmí mít LCD displej a klávesnice stejnou I2C adresu. Pomocí jednoduchého Arduino programu jsem zjistil, e displej pouívá adresu 0x27, staèilo tak nastavit pro klávesnici jakoukoliv jinou adresu, s èím mi pomohla tabulka na obrázku è. 4. Zvolil jsem adresu 0x21, take bylo nutné u I2C sbìrnice PCF8574P uzemnit piny A2 a A1 a pin A0 pøipojit k napìtí 3,3 V.

**ADDRESS REFERENCE**

| INPUTS | | | I2C-BUS SLAVE ADDRESS |
| :---: | :---: | :---: | :--- |
| **A2** | **A1** | **A0** | |
| L | L | L | 32 (decimal), 20 (hexadecimal) |
| L | L | H | 33 (decimal), 21 (hexadecimal) |
| L | H | L | 34 (decimal), 22 (hexadecimal) |
| L | H | H | 35 (decimal), 23 (hexadecimal) |
| H | L | L | 36 (decimal), 24 (hexadecimal) |
| H | L | H | 37 (decimal), 25 (hexadecimal) |
| H | H | L | 38 (decimal), 26 (hexadecimal) |
| H | H | H | 39 (decimal), 27 (hexadecimal) |

*Obrázek è. 4 Tabulka pro urèení I2C adresy*

Funkènost klávesnice obstarává knihovna `Keypad_I2C`. Hodnoty kláves se zapisují do dvourozmìrného pole (obrázek è. 5).

```cpp
char keypressed;
const byte ROWS = 4;
const byte COLS = 4;
char hexaKeys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};
byte rowPins[ROWS] = {0, 1, 2, 3};
byte colPins[COLS] = {4, 5, 6, 7};
Keypad_I2C customKeypad(makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS, 0x21);
```
*Obrázek è. 5 Deklarace promìnnıch pro klávesnici*

Dále je potøeba klávesnici inicializovat ve funkci `setup()` (obrázek è. 6).
```cpp
// keypad inicialization
customKeypad.begin();
```
*Obrázek è. 6 Inicializace klávesnice*

Vdy, kdy je potøeba v nìjaké funkci zjišovat, zda byla stisknuta nìjaká klávesa, musí se z knihovny Keypad_I2C zavolat funkce `getKey()` (obrázek è. 7).
```cpp
// get pressed key
keypressed = customKeypad.getKey();
```
*Obrázek è. 7 Zapsání stisknuté klávesy do promìnné keypressed*

### 3.1.6 Bzuèák a LED
Souèástí zaøízení je také 5 V bzuèák o frekvenci 2,3 kHz, kterı slouí k upozornìní na stisknutí tlaèítka a také jako bezpeènostní prvek, kterı má hlasitım zvukem vylekat pøípadného narušitele. Jako další bezpeènostní prvek slouí èervená LED, která po spuštìní alarmu zaène jasnì svítit.

## 3.2 Napájení
Problém nastal pøi øešení napájení jednotlivıch komponentù, zejména proto, e vıvojová deska NodeMcu a WiFi modul ESP8266 pracují s jinım napìtím, ne ostatní souèástky. Konkrétnì NodeMcu vyaduje napìtí 3,3 V, zatímco ostatní komponenty 5 V. Tento problém jsem se rozhodl vyøešit pomocí obousmìrného osmi-kanálového pøevodníku logickıch úrovní, kterı je schopen pøevádìt 5 V na 3,3 V a naopak.

Samotné napájení je øešeno pomocí napájecího modulu nepájivého pole, kterı dokáe pøipojit napájení do dvou napìovıch vìtví. U kadé z nich lze jumperem zvolit, jaké napìtí do ní bude pøivedeno (buï 3,3 V, nebo 5 V). Modul vyaduje vstupní napìtí od 6,5 V do 12 V, které lze pøivést kabelem z elektrické sítì nebo pomocí USB z poèítaèe. Maximální vıstupní proud je 700 mA, co je dostaèující pro napájení vìtšiny souèástek.

Všechny komponenty jsem pøipojil na dvì nepájivá pole, kadé z nich disponuje 400 kontakty.

## 3.3 Software
### 3.3.1 Jazyk Arduino
Program slouící k ovládání hardwarovıch souèástek jsem napsal v jazyce Arduino, kterı je, a na drobné úpravy, velmi podobnı jazyku C nebo C++. Jazyk Arduino byl pøímo vytvoøen k programování integrovanıch obvodù.

### 3.3.2 Webová aplikace
Webovou aplikaci jsem øešil v jazyce PHP, konkrétnì jsem vyuil PHP frameworku Nette ve verzi 2.4. Pøi tvorbì uivatelského rozhraní jsem pouil framework Bootstrap v3.3.4, kterı mi usnadnil práci s HTML5 a CSS, hlavnì v oblasti responzibility. Vzhled uivatelského rozhraní jsem øešil pomocí kaskádovıch stylù CSS3 a také pomocí javascriptové knihovny jQuery. K provozu aplikace vyuívám databázovı systém MySQL, ve kterém ukládám jak uivatelské údaje, tak data nutná pro ovládání samotného bezpeènostního zaøízení. Celá aplikace bìí na Apache HTTP Serveru.

### 3.3.3 Arduino IDE 1.8.5
Jako vıvojové prostøedí jsem pro Arduino program zvolil Arduino IDE 1.8.5, které je pøímo uzpùsobeno pro nahrávání programù do vıvojovıch desek jako Arduino nebo NodeMcu.

### 3.3.4 NetBeans 8.2
Pro vıvoj PHP webové aplikace jsem zvolil integrované vıvojové prostøedí NetBeans 8.2, kvùli jeho pøehlednému uivatelskému rozhraní a jeho podpoøe mnoství programovacích jazykù.

### 3.3.5 XAMPP 5.6.32
Pøi vıvoji webové aplikace byl nezbytnı multiplatformní softwarovı balíèek XAMPP, díky kterému je moné vytvoøit lokální webovı server. Konkrétnì jsem pouil verzi 5.6.32. Balíèek obsahuje serverovou aplikaci Apache, databázi MariaDB a skriptovací jazyk PHP. XAMPP jsem zvolil kromì jeho jednoduchosti a intuitivního ovládání také proto, e vìtšina webovıch serverù vyuívá stejné komponenty jako XAMPP, take je pøechod z lokálního testovacího serveru na ivı server velmi jednoduchı.

### 3.3.6 Fritzing 0.9.3b
Pro návrh bezpeènostního zaøízení jsem pouil open-source program Fritzing ve verzi 0.9.3b. Ten umoòuje graficky sestavit zapojení jednotlivıch souèástek na nepájivém poli, co pomáhá k lepší pøedstavì o vısledném rozloení. Program dále usnadòuje tvorbu schématu zaøízení, podle kterého lze pak navrhnout desku plošnıch spojù, její vırobu je moné pøímo v programu objednat.

---

# 4 ZPÙSOBY ØEŠENÍ A POUITÉ POSTUPY

## 4.1 Hardwarové zaøízení
### 4.1.1 Nahrávání programu
Bezpeènostní zaøízení je umístìno v uzavøené krabièce, pøípadná úprava programu pøes sériovı port je proto znaènì problematická a v bìném provozu prakticky nemoná. Tento problém jsem vyøešil zprovoznìním OTA (over the air) pøenosu pomocí knihovny ArduinoOTA, která mi umoòuje nahrát firmware do ESP8266 bezdrátovì pøes WiFi. Po zapnutí zaøízení je vyèlenìn èas, ve kterém je moné bezdrátovì nahrát novı program (obrázek è. 8) a teprve po uplynutí tohoto èasu zaène bezpeènostní systém pracovat.

```cpp
//over the air transfer
if(ota == true) {
  //after the reboot, over the air transfer can be used for certain time
  while (otaTransfer < otaTime) {
    otaCurrent = millis();
    if (otaCurrent - otaPrevious >= otaInterval) {
      otaPrevious = otaCurrent;
      otaTransfer++;
    }
    ArduinoOTA.handle();
    yield();
  }
  //when over the air transfer ended, the ledBlink() function is called
  ledBlink();
  ota = false;
}
```
*Obrázek è. 8 Odpoèítávání èasu, ve kterém je moné bezdrátovì nahrát novı firmware*

### 4.1.2 Popis fungování bezpeènostního systému
Po zapnutí NodeMcu se automaticky spustí funkce `setup()`. Ta se pøipojí k WiFi pomocí knihovny WiFiManager a zavolá funkci `loop()`, která nejprve na nìkolik vteøin umoní bezdrátovì nahrát novı program pomocí OTA (over the air) pøenosu (obrázek è. 8), poté vypíše na displej zprávu a zavolá funkci `enterPassword()`. Po zadání správného hesla se spustí funkce `activateAlarm()`, která odpoèítává èas do aktivace systému. Tento èas slouí k opuštìní hlídaného prostoru. Uivatel má zároveò monost odpoèet zrušit, a to stisknutím klávesy C a zadáním správného hesla, èím se opìt zavolá funkce `loop()`. Po uplynutí èasu se spustí funkce `alarmCheck()` (obrázek è. 9), která pomocí funkce `getDistance()` aktivuje ultrazvukovı senzor a zaène mìøit vzdálenost k nejbliší pøekáce.

```cpp
currentDistance = getDistance() + 30;
if (currentDistance < initialDistance) {
  danger = true;
  check = false;
  warning = warn;
  countdown = 0 - 1;
  while (warning != 0 - 1) {
    if (message == 0) {
      lcd.clear();
      lcd.setCursor(4, 0);
      lcd.print("WARNING");
      message = 1;
    }
    active = false;
    activateMessage = false;
    alarmMessage = false;
    cancelMessage = false;
    warningMessage = true;
    deactivate = true;
    enterPassword();
    yield();
  }
  alarmActivated();
}
```
*Obrázek è. 9 Ukázka kódu funkce alarmCheck()*

Pokud se tato vzdálenost zmìní, aktivuje se odpoèet do spuštìní alarmu, pomocí funkce `ledBlink()` se rozbliká LED a zavolá se funkce `enterPassword()`, co dává uivateli monost zadat platné heslo a tím odpoèet zrušit. Pokud to neudìlá, zavolá se po uplynutí odpoètu funkce `alarmActivated()`. Ta spustí naplno bzuèák a jasnì rozsvítí èervenou LED. Zároveò se informace o spuštìní alarmu odešle na server a webová aplikace zajistí odeslání SMS uivateli. Nakonec se zavolá funkce `enterPassword()`, ve které lze zadáním správného hesla alarm deaktivovat.

### 4.1.3 Ovìøení hesla
Stìejní funkcí programu je funkce `enterPassword()`. Pøi tvorbì zaøízení pro mì byla bezpeènost systému velmi dùleitá, proto musí bıt naprostá vìtšina poadavkù ovìøená zadáním hesla. Na zaèátku se zavolá funkce `eepromRead()`, která zpøístupní souèasné platné heslo uloené v EEPROM pamìti pro porovnání se zadanım heslem. Pak pøijde na øadu funkce `temporaryPassword()`, její úkolem je èíst hodnotu stisknuté klávesy a ukládat ji do promìnné. Po stisknutí klávesy `*` se ve funkci `enterPassword()` tato promìnná porovná s platnım heslem uloenım v EEPROM pamìti. Následující akce se odvíjejí od souèasné situace alarmu – pokud je alarm vypnutı a je zadáno platné heslo, spustí se funkce pro aktivaci alarmu `activateAlarm()`. Pokud je alarm ji zapnutı a je zadáno platné heslo, zavolá se naopak funkce pro deaktivaci alarmu `deactivateAlarm()`. Uivatel má také monost zrušit probíhající odpoèet do aktivace alarmu a i v tomto pøípadì funkce `enterPassword()` zajistí po zadání hesla deaktivaci alarmu. Pøi pokusu o deaktivaci alarmu pøed vypršením èasu do spuštìní má uivatel tøi pokusy na zadání platného hesla. Pokud se mu to nepodaøí, je okamitì zavolána funkce `alarmActivated()` a alarm se spustí.

### 4.1.4 Zmìna hesla
Uivatel má také monost souèasné heslo zmìnit, stará se o to funkce `changePassword()`. Funkci lze vyvolat, pokud alarm není aktivován, stisknutím klávesy B. Funkce vyaduje zadání souèasného a nového hesla. Nové heslo musí mít ètyøi a šest èísel a kvùli zamezení pøípadnım pøeklepùm je nutné ho zadat dvakrát. Pokud jsou všechny podmínky splnìny, zavolá se funkce `eepromWrite()`, která nové heslo uloí do EEPROM pamìti.

### 4.1.5 Pøipojení k WiFi
Pro snadnìjší pøipojení k WiFi jsem vyuil knihovnu WiFiManager pro ESP8266. Díky ní se zaøízení po zapnutí automaticky pokusí o pøipojení k ji nakonfigurované WiFi síti. Pokud se to nepodaøí, nebo pokud ještì ádná sí nakonfigurována nebyla, automaticky vytvoøí web server, na kterém uivatel zadá heslo ke své WiFi a ESP8266 se k ní pak bude automaticky pøipojovat.

### 4.1.6 Komunikace se serverem
Pro vzdálené ovládání bezpeènostního zaøízení je nutná jeho komunikace se serverem. Tu zajišuji pomocí HTTP GET a POST poadavkù z ESP8266 na server.

**Získávání hodnot**
Získávání dat ze serveru øeším pomocí HTTP GET poadavku z ESP8266. Funkce `getValues()` se pøipojí k serveru a získá HTML stránku, která obsahuje JSON s daty. Následnì se zbaví hlavièky stránky a pomocí knihovny ArduinoJson dekóduje JSON data. Ta se pak uloí do promìnnıch, se kterımi lze dále pracovat (obrázek è. 10).

```cpp
//read response from the server
String section = "header";
while (client.available()) {
  String content = client.readStringUntil('\r');
  //Serial.print(content);
  //get rid of the header
  if (section == "header") {
    Serial.print(".");
    if (content.charAt(1) == '9') {
      section = "json";
    }
  }
  else if (section == "json") {
    Serial.println("");
    section = "ignore";
    String json = content;
    //parse JSON
    StaticJsonBuffer<200> jsonBuffer;
    JsonObject& json_parsed = jsonBuffer.parseObject(json);
    if (!json_parsed.success()) {
      Serial.println("Parsing failed!");
      return;
    }
    //save values into variables
    countdown = json_parsed["settings"]["countdown"];
    warning = json_parsed["settings"]["warning"];
    count = json_parsed["settings"]["countdown"];
    warn = json_parsed["settings"]["warning"];
    activate = (json_parsed["settings"]["activate"]).as<String>();
```
*Obrázek è. 10 Ukázka kódu z funkce pro získání JSON dat ze serveru*

**Odesílání hodnot**
Odesílání dat na server mi zajišuje funkce `postValues()`. Ta zakóduje data do JSON vıstupu, pøipojí se na server a pomocí HTTP POST poadavku tato data odešle (obrázek è. 11). Zbytek obstará samotná webová aplikace.

```cpp
//create JSON
StaticJsonBuffer<200> jsonBuffer;
JsonObject& json_created = jsonBuffer.createObject();
json_created["activate"] = activate;
json_created["alarm"] = alarm;
char jsonMessageBuffer[200];
json_created.printTo(jsonMessageBuffer, sizeof(jsonMessageBuffer));
//send POST request to the server
client.println(String("POST ") + postPath+" HTTP/1.1");
client.println(String("Host: ") + host);
client.println("Connection: close");
client.println("Content-Type: application/json");
client.print("Content-Length: ");
client.println(strlen(jsonMessageBuffer));
client.println();
client.println(jsonMessageBuffer);
```
*Obrázek è. 11 Ukázka kódu z funkce pro odesílání JSON dat na server*

## 4.2 Webová aplikace
Pøi tvorbì webové aplikace mi znaènì usnadnil práci Nette Framework, kterı ji obsahuje èetná bezpeènostní opatøení. Napøíklad pro pøihlašování uivatelù tedy vyuívám funkce, které ji Nette v základu má. Pøi øešení designu aplikace mi pomohl framework Bootstrap, díky kterému je uivatelské rozhraní plnì responzivní. Dùleitou èástí aplikace je databázovı systém MySQL, do kterého prostøednictvím Nette ukládám data, ke kterım pak mùu pøistupovat.

### 4.2.1 Pøihlášení
Do aplikace je nejprve vdy nutné se pøihlásit pomocí uivatelského jména a hesla (obrázek è. 12).
*Obrázek è. 12 Pøihlašovací okno do webové aplikace*

Po pøihlášení se pomocí údajù v databázi rozhodne, zda se pøihlásil bìnı uivatel nebo administrátor. Na tom závisí, jaká práva bude danı uivatel v aplikaci mít.

### 4.2.2 Nastavení
Bìnı uivatel mùe upravit své osobní údaje jako jméno nebo heslo (obrázek è. 13) a také mùe aktivovat nebo deaktivovat alarm.
*Obrázek è. 13 Formuláø pro zmìnu hesla*

Administrátor mùe kromì ji zmínìného také upravovat údaje ostatních uivatelù, popøípadì pøidávat nové uivatele nebo mazat souèasné (obrázek è. 14).
*Obrázek è. 14 Administrace uivatelù*

Má právo také upravovat dobu do aktivace a dobu do spuštìní alarmu (obrázek è. 15).
*Obrázek è. 15 Nastavení bezpeènostního zaøízení*

### 4.2.3 Bezdrátová komunikace
Dùleitım úkolem webové aplikace je také komunikace s hardwarovım zaøízením. Ta je øešena pomocí REST API. Za úèelem poskytování dat pro ESP8266 jsem vytvoøil funkci, která získá data z databáze a vytvoøí z nich JSON vıstup. Ten si potom snadno stáhne a dekóduje samotné zaøízení pomocí HTTP GET poadavku. Získávání dat z ESP8266 jsem vyøešil pomocí HTTP POST poadavku ze zaøízení, ve kterém posílám JSON vıstup. Tato data pak v aplikaci zpracuji, JSON dekóduji a hodnoty uloím do databáze.

---

# 5 VİSLEDKY ØEŠENÍ

## 5.1 Podoba hardwarového zaøízení
Bezpeènostní zaøízení je v souèasné dobì plnì funkèní, po nìkolika denním testování splòuje mé poèáteèní oèekávání a všechny jeho funkce bez problému fungují. Z dùvodu èastıch úprav je zaøízení umístìno na dvou nepájivıch polích. Do budoucna by bylo vhodné vytvoøit pevnı plošnı spoj na poli pájivém, zejména kvùli køehkosti souèasného øešení. Systém jsem umístil do jednoduché krabièky s vyvrtanımi otvory pro napájecí kabel a pro ultrazvukovı senzor. Jak jsem ji døíve v dokumentaci zmiòoval, napájení kabelem z elektrické sítì není u bezpeènostního systému vhodné, protoe by pøípadnému narušiteli staèilo vytrhnout napájecí kabel z elektrické zásuvky. Lepší by bylo napájet zaøízení vıkonnou baterií schovanou v krabièce, popøípadì systém umístit napevno do zdi a pøímo pøipojit k elektrické síti.
*Obrázek è. 16 Bezpeènostní zaøízení ve vıvoji*

## 5.2 Podoba webové aplikace
Webová aplikace spolehlivì splòuje svùj úèel, uivatelé se bez problému pøihlásí a následnì mohou v aplikaci dìlat pøesnì to, co jim dovolují jejich uivatelská práva. Bìní uivatelé se proto nedostanou k administrátorskım nastavením nebo k jinım nepøístupnım èástem aplikace. Administrátor naopak mùe kdykoliv mìnit všechny údaje: své vlastní, údaje ostatních uivatelù a samozøejmì nastavení bezpeènostního zaøízení. Aplikace je také plnì responzivní, lze ji proto pouívat i na mobilních telefonech nebo tabletech. Do budoucna bych rád pøidal více moností nastavení jako napøíklad automatickou aktivaci bezpeènostního systému v urèité dobì a podobnì.
*Obrázek è. 17 Tlaèítko pro deaktivaci alarmu | Obrázek è. 18 Tlaèítko pro aktivaci alarmu*

## 5.3 Bezdrátová komunikace
Komunikace mezi webovou aplikací a hardwarovım zaøízením na principu REST API funguje spolehlivì. Pro bezpeènostní zaøízení však není nejvhodnìjší, jak z hlediska bezpeènosti, tak samotné funkènosti, jeliko je nezbytné zasílat ze zaøízení poadavky na server v pravidelnıch èasovıch intervalech a mezi tìmito intervaly se zaøízení nemá jak dozvìdìt o pøípadnıch zmìnách v aplikaci (napøíklad o impulsu k aktivaci alarmu). Vhodnìjší by proto pro tento konkrétní pøípad bylo vyuití jiné technologie, napøíklad protokolu MQTT, kterı by zaøízení se serverem spojil trvale a reagoval by pouze na zmìny. Rád bych také komunikaci lépe zabezpeèil proti pøípadnım pokusùm o narušení, napøíklad pomocí protokolu HTTPS.

---

# ZÁVÌR
Cílem projektu bylo vytvoøit funkèní bezpeènostní systém s moností ovládat jej na dálku prostøednictvím webové aplikace. Vytyèené cíle byly splnìny, bezpeènostní zaøízení i webová aplikace bez problému fungují. Pøi vıvoji mì nicménì napadl nespoèet monıch zmìn, které by zaøízení vylepšily, jako napøíklad napájení z baterie nebo lepší zpùsob komunikace mezi aplikací a zaøízením. Na tato vylepšení mi ji bohuel nestaèil èas pøed termínem odevzdání práce, proto se jim budu vìnovat pozdìji. Rád bych také pøidal více moností nastavení do webové aplikace, jako napøíklad monost automaticky aktivovat alarm v urèitou dobu a podobnì. Samotné souèástky bych rád umístil na desku plošnıch spojù místo dvou nepájivıch polí, èím bych vyøešil problém s køehkostí celého zaøízení.

---

# SEZNAM POUITİCH INFORMAÈNÍCH ZDROJÙ

1.  ESP8266 Quick Start Guide [online]. [cit. 2017-12-28]. Dostupné z: http://rancidbacon.com/files/kiwicon8/ESP8266_WiFi_Module_Quick_Start_Guide_v_1.0.4.pdf
2.  Logic Level Shifting [online]. [cit. 2017-12-28]. Dostupné z: http://www.instructables.com/id/A-Quick-Guide-on-Logic-Level-Shifting/
3.  ESP8266 Full Communication From Anywhere in the World [online]. In: 12. 12. 2015 [cit. 2017-12-28]. Dostupné z: https://www.youtube.com/watch?v=uWbLpMJ8jiA
4.  Nette autentifikace [online]. [cit. 2017-12-28]. Dostupné z: https://doc.nette.org/cs/2.4/quickstart/authentication
5.  Nette autentizace [online]. [cit. 2017-12-28]. Dostupné z: https://doc.nette.org/cs/2.4/access-control
6.  Nette Tracy [online]. [cit. 2017-12-28]. Dostupné z: https://tracy.nette.org/cs/
7.  Drahak REST API, chránìná komunikace [online]. [cit. 2017-12-28]. Dostupné z: https://www.itnetwork.cz/php/nette/diskuzni-forum-php-nette-framework/drahak-rest-api-chranena-komunikace-5767f69a2b12b
8.  JSON decode [online]. [cit. 2017-12-28]. Dostupné z: http://php.net/manual/en/function.json-decode.php
9.  ArduinoJson [online]. [cit. 2017-12-28]. Dostupné z: https://github.com/bblanchon/ArduinoJson
10. ESP8266 Internet Controlled LED [online]. [cit. 2017-12-28]. Dostupné z: http://blog.nyl.io/esp8266-led-arduino/
11. Arduino multitasking [online]. [cit. 2017-12-28]. Dostupné z: https://learn.adafruit.com/multi-tasking-the-arduino-part-1/using-millis-for-timing
12. I2C Keypad [online]. [cit. 2017-12-28]. Dostupné z: https://www.hackster.io/venkatesh_rao/i2c-keypad-73a012
13. Insert JSON into database using PHP REST [online]. In: 18. 1. 2016 [cit. 2017-12-28]. Dostupné z: https://www.youtube.com/watch?v=4QYt2Yqo5TA
14. ESP8266 EEPROM [online]. [cit. 2017-12-28]. Dostupné z: https://circuits4you.com/2016/12/16/esp8266-internal-eeprom-arduino/
15. Over the Air transfer [online]. [cit. 2017-12-28]. Dostupné z: https://randomnerdtutorials.com/esp8266-ota-updates-with-arduino-ide-over-the-air/

---

# SEZNAM PØÍLOH
**Pøíloha è. 1: Fotodokumentace**
*   První verze bezpeènostního zaøízení sloená z Arduino UNO a ESP8266-01
*   Detail na rezistorové pole slouící k zapojení klávesnice pøes jeden analogovı pin, pozdìji nahrazené I2C sbìrnicí
*   Vıroba krabièky na bezpeènostní zaøízení
*   Finální podoba bezpeènostního zaøízení
