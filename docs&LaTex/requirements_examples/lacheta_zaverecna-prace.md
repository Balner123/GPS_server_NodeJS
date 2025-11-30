Zde je kompletnì zpracovanı dokument do formátu **Markdown**. Zachoval jsem strukturu nadpisù, zvıraznìní kódu (C++) a formátování seznamù.

***

# ZÁVÌREÈNÁ STUDIJNÍ PRÁCE
## Dokumentace: Robotická ruka s vyuitím EMG

**Škola:** SŠPU Opava (Støední škola prùmyslová a umìlecká, Opava)  
**Autor:** Václav Lacheta  
**Obor:** 18-20-M/01 INFORMAÈNÍ TECHNOLOGIE se zamìøením na poèítaèové sítì a programování  
**Tøída:** IT4  
**Školní rok:** 2021/2022

---

### Podìkování
Dìkuji doc. Ing. Petru Èermákovi, Ph.D. za odborné konzultace a rady, které mi poskytl bìhem øešení mého projektu.

### Prohlášení
Prohlašuji, e jsem závìreènou práci vypracoval samostatnì a uvedl veškeré pouité informaèní zdroje.

Souhlasím, aby tato studijní práce byla pouita k vıukovım úèelùm na Støední prùmyslové a umìlecké škole v Opavì, Praskova 399/8.

**V Opavì 31. 12. 2021**  
*(podpis autora práce)*

---

## ANOTACE

Souèástí práce bylo sestavení protetické ruky InMoov v ivotní velikosti ze souèástek vytisknutıch na 3D tiskárnì. Umìlá ruka je ovládána pomocí elektromyografickıch (EMG) senzorù, díky nim je moné získávat elektrické svalové signály a pøevádìt je na mechanické pohyby napodobující chování skuteèné lidské ruky. Ruka je upevnìna na podstavci obsahujícím nezbytnı hardware vèetnì displeje a rotaèního enkodéru, kterı lze pouít k ovládání. Zaøízení je moné ovládat manuálnì (natoèit kadı prst do libovolného úhlu), pomocí EMG senzorù nebo zvolit nìkteré z naprogramovanıch gest.

**Klíèová slova:** EMG, elektromyografie, InMoov, myoelektrická protéza, rotaèní enkodér, servomotor, Arduino, 3D tisk, displej

---

## OBSAH

1. **PROTÉZY**
    *   1.1 Historie protéz
    *   1.2 Klasifikace protéz
    *   1.3 Pasivní protézy
    *   1.4 Aktivní protézy
        *   1.4.1 Protézy pohánìné tìlem
        *   1.4.2 Myoelektrické protézy
        *   1.4.3 Hybridní protézy
2. **ELEKTROMYOGRAFIE**
    *   2.1 Svaly horní konèetiny
    *   2.2 EMG signály
    *   2.3 Snímání EMG signálù
3. **MONÉ ZPÙSOBY ZPRACOVÁNÍ EMG SIGNÁLU A JEJICH IMPLEMENTACE V PROTÉZÁCH**
    *   3.1 Mikrokontrolery
    *   3.2 Senzory
    *   3.3 Pøíklady protéz
        *   3.3.1 Inteligentní humanoidní robotická ruka Sain
        *   3.3.2 Protetická ruka InMoov
4. **SESTROJENÍ RUKY**
    *   4.1 InMoov ruka
    *   4.2 Ovládaní servo motorù
    *   4.3 Ovládaní ruky pomocí EMG
    *   4.4 Displej a uivatelské ovládaní
    *   4.5 Podstavec
    *   4.6 Vyuité souèástky
*   **ZÁVÌR**
*   **SEZNAM POUITİCH INFORMAÈNÍCH ZDROJÙ**
*   **SEZNAM PØÍLOH**

---

## ÚVOD

Nad vıbìrem závìreèné práce jsem pøemıšlel dlouhou dobu. Hledal jsem takovı projekt, pøi jeho øešení bych mohl uplatnit své znalosti programování mikrokontrolerù a vyuít i rozmanitou zásobu elektronickıch souèástek, které jsem nashromádil v prùbìhu svého studia na støední škole. Zároveò jsem si pøál pustit se také do nìèeho nového, co by pøedstavovalo zajímavou vızvu pro mì samotného a pøípadnì bylo pøínosné i pro druhé.

Jednoho dne jsem zhlédl video s ukázkou robotické ruky, která se ovládá pomocí EMG senzorù. V tu chvíli jsem se rozhodl, e právì to bude téma mého závìreèného projektu. Navíc jsem vdy tento typ protézy povaoval za nìco, co si nemùe normální smrtelník sestavit doma, take jsem byl i hodnì zvìdavı, zda se mi to povede.

Nyní tedy pøedkládám vısledek své práce, která trvala nìkolik mìsícù. Podaøilo se mi dosáhnout vìtšiny dílèích cílù, které jsem si vytyèil. Z finanèních dùvodù jsem si bohuel nemohl dovolit poøídit více EMG senzorù a musel jsem si vystaèit pouze s jedním, pomocí kterého dokái monitorovat sevøení nebo otevøení pìsti a následnì tento pohyb pøevést na robotickou ruku.

V praxi se s mım øešením moc nesetkáme, tento zpùsob se spíše vyuívá ve svìtì medicíny a bioinformatiky pro diagnostiku. Vyspìlejší protézy se spíše zamìøují na umístìní elektrod uvnitø svalu, jeliko jsou získávány mnohem pøesnìjší signály.

V úvodní kapitole své dokumentace se zabıvám vıvojem protéz v historii a popisuji nìkterá zajímavá technická øešení, která se objevila v minulosti i ta, která se pouívají dnes. Další èást je zamìøena na problematiku elektromyografie, je studuje strukturu kosterní svaloviny a elektrické biosignály, které ze svalù vycházejí. Díky poznatkùm tohoto oboru mùeme vyuívat EMG senzory a snímat pomocí nich impulzy lidského tìla. Nejdùleitìjší èást mé práce je podrobnìji vìnována technickému a programovému øešení projektu InMoov ruky.

---

# 1. PROTÉZY

Protézu lze definovat jako „umìlé zaøízení, které nahrazuje nebo doplòuje chybìjící èi narušenou èást lidského tìla“.

V dnešní dobì existuje mnoho rùznıch typù protéz. Ty se pohybují od kosmetickıch ozdob pøes jednoduché pasivní mechanické pomùcky, jako jsou rùzné háky a podobnì, a po elektricky pohánìné protézy, které mohou alespoò èásteènì obnovit funkci chybìjící konèetiny.

## 1.1 Historie protéz
Myšlenka umìlého nahrazení ztracenıch konèetin existuje ji tisíce let. Existují protézy, které jsou více ne 3000 let staré. Pøíkladem je takzvanı „káhirskı prst“, kterı byl nalezen u egyptské mumie a mìl nahradit ztracenı palec u nohy. Protézy, jako je tato, byly kdysi vyrábìny pomocí pøírodních surovin: kùe, døeva èi lnu.

*Obrázek 1: Káhirskı prst*

V roce 300 pøed naším letopoètem byla Øímany vyrobena první známá protetická noha, takzvaná „noha Capua“. Byla vyrobena ze eleza a bronzu a mìla døevìné jádro. Bìhem této doby se objevily protézy, jako jsou ruèní háky a kolíkové nohy, které umoòovaly chùzi nebo drení štítù. Ty byly sestrojeny pøevánì ze eleza a oceli.

V dobì renesance udìlala anestezie a léèba ran velikı pokrok, amputace proto byly bezpeènìjší ne kdy døíve. S novımi monostmi amputace se zaèaly šíøit vynálezy, jakım byl napøíklad tzv. turniket, které pomohly zastavit tìké krvácení v prùbìhu amputace. Vznikaly nové typy protéz - napøíklad „elezná ruka rytíøe Götz von Berlichingen“, s ní bylo moné pohybovat a manipulovat pomocí pruinového mechanismu uvnitø ruky. V této dobì se na protézy pouívalo pøedevším elezo, ocel, mìï a døevo.

V období americké obèanské války, ale i bìhem svìtovıch válek zaila protetika velkı posun vpøed vyplıvající z vysokého poètu zmrzaèenıch vojákù. Kromì toho byl vyvinut i zcela novı materiál - pry, kterı doplòoval døívìjší protézy ze døeva a kùe.

V letech po druhé svìtové válce bylo objeveno mnoho dalších materiálù, díky kterım se døevo a kùe staly nepotøebnımi. Patøí mezi nì pryskyøice, polykarbonát, plast a lamináty. Díky jejich pouití se protézy staly lehèí a odolnìjší.

Materiálové sloení se v posledních letech dále zdokonaluje a v souèasnosti vznikají vysoce vıkonné protézy, které mají vyšší stabilitu, pohodlí a niší hmotnost. Kromì toho mohou bıt souèástí protéz senzory umoòující aktivní ovládaní pomocí mikroprocesorù. Vıvoj moderních protéz se mùe opøít i o nové vırobní procesy, jako je 3D tisk, kterı umoòuje vyrobit velmi jednoduché i levné protézy.

*Obrázek 1.2: Noha Capua | Obrázek 1.3: Ruka Götz von Berlichingen*

## 1.2 Klasifikace protéz
Protézy mùeme rozdìlit na:

1.  **Pasivní.** Protézy, které nemají ádné pohyblivé èásti. Ty se vìtšinou pouívají pro estetické úèely. Existují také protézy urèené pro speciální úkoly, jako je zahradnièení nebo sport.
2.  **Aktivní.** Ty jsou naopak urèeny k podpoøe vyšší produktivity a funkènosti. Mají pohyblivé èásti, které jsou pohánìny buï samotnım tìlem, nebo vnìjší energií. Navíc existují ještì hybridní kombinace, které jsou pohánìny èásteènì tìlem a èásteènì akèními èleny.

*Obrázek 1.4: Rozdìlení protéz*

Protézy mohou plnit dva rùzné úkoly, které se mohou zásadnì lišit. Na jednu stranu, protézy mají obnovit funkce, které byly ztraceny ztrátou konèetiny a na druhou stranu se protézy pouívají k optické obnovì „normálního stavu“ tìla. Protézy, které vizuálnì pøipomínají chybìjící konèetinu, mají èasto omezenou funkènost, zatímco funkèní protézy nejsou moc dobré po vizuální stránce. Proto existuje mnoho pacientù, kteøí mají nìkolik rùznıch protéz, napøíklad jednu, která vizuálnì pøipomíná chybìjící konèetinu, a druhou, která je maximálnì funkèní.

## 1.3 Pasivní protézy
Kosmetické pouití protéz je velmi dùleité, protoe zejména horní konèetiny jsou èasto pouívané v sociálních interakcích, jako jsou gesta nebo bìhem komunikace. Vizuálnì nenápadnı vzhled tak mùe pomoci vyhnout se psychickému stresu z dùvodu odlišnosti od ostatních. To platí zejména v pøípadì, kdy amputací není postieno pouze pøedloktí, ale i pae. Nejlepší reprezentace pøirozené ruky poskytují pasivní kosmetické protézy. Lze je pøizpùsobit pacientovi pomocí tvaru a barvy; napøíklad napodobit barvu kùe a anatomické rysy, jako jsou znaménka, nebo dokonce ochlupení na paích. Estetické protézy lze také pouít pro jednoduché manuální úkoly, jako je fixace papíru pøi psaní. Obecnì jsou velmi lehké a mají vysokı komfort nošení.

*Obrázek 1.5: Pøíklad pasivní protézy*

## 1.4 Aktivní protézy
Nejèastìji se vyskytují protézy aktivní. Tyto mají pohyblivé èástí, které jsou pohánìny buï tìlem, nebo vlastním zdrojem energie. S tìlesnì pohánìnımi protézami se ovládání provádí pohybem svalu v blízkosti amputované konèetiny. U myoelektrickıch protéz jsou akèní potenciály svalu monitorovány senzory a pouity pro pohyb protézy. Aktivní protézy mohou mít mnoho podob, jako napøíklad ruce, pohyblivé háky nebo speciální tvary pro konkrétní pacienty. Tento druh protéz je obvykle tìší ne pasivní, jeliko jsou pro nì urèeny vìtší zátìe. Díky tomu jsou èasto vyrobeny z tìších, ale odolnìjších materiálù, jako jsou kov nebo tvrzenı plast. Úkolem aktivních protéz je obnovit funkènost postienıch konèetin, a zejména ruka má velkı vıznam pro manipulaci s objekty. Pomocí takovıch protéz je moné uchopovat pøedmìty a zvládat èinnosti v kadodenním ivotì.

### 1.4.1 Protézy pohánìné tìlem
Protézy pohánìné tìlem jsou èasto oznaèovány jako „ovládané kabelem“, protoe vyadují ocelové kabely bìhem provozu. Obvykle jsou tyto postroje konstruovány tak, e popruh prochází pøes lopatku a pøipojuje se k tanému lanku, které ovládá protézu. Protoe protézy pohánìné tìlem jsou pøímo spojeny napøíklad s pohybem ramena, mají tak vysokou úroveò zpìtné vazby na základì napìtí na ovládacím kabelu. Dalšími vıhodami tìchto protéz je, e jsou ve vìtšinì pøípadù vodotìsné a snadno se èistí. Jejich jednoduchı design umonuje postienım osobám se je rychleji nauèit ovládat, a navíc stojí vıraznì ménì ve srovnání s aktivnì øízenımi.

Nevıhodou tìchto protéz je, e k ovládání potøebují postroj k ovládání. To znamená, e postiené osoby musí mít urèitou sílu a svobodu pohybu, aby mohly takové zaøízení ovládat. Navíc jsou tyto protézy èasto vizuálnì ménì pøitalivé ve srovnání s elektricky pohánìné, a to kvùli postroji.

Protézy s takovım mechanickım pøenosem síly jsou oblíbenìjší ne ty elektrické. Devadesát procent lidí, kteøí mají aktivní protézu, pouívají protézu pohánìnou tìlem. Jejich nejvìtšími klady jsou nízká hmotnost, odolná konstrukce a lepší haptická odezva generovaná kabely.

*Obrázek 1.6: Pøíklad protézy pohánìné tìlem*

### 1.4.2 Myoelektrické protézy
Tyto protézy jsou pøevánì elektrické. Mají externí zásobník energie, kterı napájí vestavìné akèní èleny. Obecnì se energie ukládá ve formì akumulátoru. Tato zaøízení lze ovládat více vstupy, jako jsou elektromyografické (EMG) signály, zpìtná vazba motorù a také vyhrazené spínaèe. Takové fyzické spínaèe jsou zvláštì uiteèné u vánıch amputací. Je to proto, e v takovıch pøípadech obvykle existuje mnoho rùznıch motorù, jsou zapotøebí rùzné spoje a je tøeba je ovládat samostatnì.

Nicménì myoelektrické protézy se ještì èastìji pouívají u ménì vánıch amputací. Myoelektrické protézy jsou zaloeny na mìøení elektrického vzruchu ve svalech. Elektrody pøipojené ke svalùm mìøí elektrické signály z kontrakcí kosterního svalstva. Zmìny elektromagnetickıch polí, které vznikají pøi napnutí svalu, zachycuje povrch elektrody a jsou v podobì napìovıch signálù posílány do mikrokontroleru.

Ve vìtšinì pøípadù jsou elektrody pøipevnìny ke dvìma svalùm, které vykonávají pohyb v urèitém smìru, jako je extenzor zápìstí a flexor zápìstí. Pro tento úèel se pouívá jeden sval pro jeden smìr pohybu protézy. Napøíklad napnutím jednoho svalu se otevøe dlaò a napnutí protikusu se dlaò uzavøe. Aby se zabránilo nedobrovolnım pohybùm, jsou pro signály EMG nastaveny prahové hodnoty. Teprve po pøekroèení urèitého prahu se protéza zaène pohybovat.

Jednou z vıhod takové myoelektrické protézy je, e umoòuje vìtší uchopovací síly ve srovnání s protézami pohánìnımi tìlem. V nìkterıch pøípadech to mùe bıt vıhodné pøi drení objektù na delší dobu. Kromì toho nejsou pro úèely ovládání potøeba ádné postroje. To dovoluje ovládání více os a kloubù souèasnì. Absence postroje také umoòuje, aby vypadaly více jako skuteèné konèetiny.

Existují však také dùvody, proè jsou protézy pohánìné tìlem 10krát populárnìjší ne myoelektrické. Je to dáno pøedevším vyšší poøizovací cenou takovıch zaøízení. Navíc jsou ménì robustní a kvùli vestavìné elektronice jen èásteènì vodotìsné. Protoe mezi nimi není ádné mechanické spojení zbıvající konèetiny s protézou, je haptická zpìtná vazba horší. Nìkdy je pro postiené tìší, aby správnì vyhodnotili a pouili poadovanou uchopovací sílu. Kromì toho se tyto protézy kvùli sloité konstrukci snadnìji lámou a musí bıt èastìji servisovány.

Elektrody jsou jejich další nevıhodou, nebo se mùe stát, e se pohnou nebo ztratí kontakt. V tìchto pøípadech nelze protézy správnì provozovat. Konstantní kontakt s elektrodami mùe také zpùsobit podrádìní kùe nebo nepøíjemnı pocit, pokud protéza není správnì upravená. Pøesto se tyto protézy neustále vyvíjejí a mohly by bıt v budoucnu více rozšíøené.

*Obrázek 1.7: Myoelektrická protéza*

### 1.4.3 Hybridní protézy
Existují i protézy, které se skládají z kombinace tìlesnì pohánìnıch a myoelektrickıch. Tato kombinace umoòuje vyuít vıhody obou typù, napøíklad mohou dosáhnout vysokıch uchopovacích sil pøi zachování nízké hmotnosti protézy. Navíc tento pøístup mùe usnadnit ovládání protézy.

---

# 2. ELEKTROMYOGRAFIE

## 2.1 Svaly horní konèetiny
Kosterní svaly jsou souèástí svalstva odpovìdné za aktivní pohyby tìla, a tedy i souèástí jednoho ze tøí hlavních typù svalù. Stejnì jako srdeèní svaly patøí kosterní svaly do skupiny pøíènì pruhovanıch svalù a oznaèují se také jako dobrovolné svaly. A na pár vıjimek, jsou tyto svaly napojeny na kost šlachami. Èasto existují v párech, pøièem první sval je primárním hybatelem a druhı je jeho antagonistou. Napøíklad, biceps a triceps jsou taková dvojice antagonistù. Kdy se jeden z nich stáhne, druhı se uvolní a umoní pohyb a naopak.

Kosterní svaly mají sloitou strukturu. Skládají se z fasciklù, které jsou svazky prodlouenıch svalovıch vláken. Samotná svalová vlákna se skládají ze svazkù myofibril. Samotné myofibrily jsou tvoøeny z myozinovıch a aktinovıch vláken. Tato dvì vlákna jsou naskládaná v pravidelnì se opakujících sestavách a jsou zodpovìdná za samotnou kontrakci svalù klouzáním proti sobì navzájem. Tato myozinová pole se nazıvají sarkomery. Motorické neurony, které øídí kontrakci, jsou spojeny ve snopci svalovıch vláken a spoleènì se nazıvají motorická jednotka.

**Nejdùleitìjší svaly jsou:**
1.  *Musculus pectoralis major* (velkı sval prsní)
2.  *Musculus deltoideus* (deltovı sval)
3.  *Musculus bizeps brachii* (dvojhlavı sval paní)
4.  *Musculus trizeps brachii* (trojhlavı sval paní)
5.  *Musculus brachioradialis* (sval vøetenní)
6.  *Musculus flexor digiti* (sval kterı zajištuje ohıbaní prstù)

*Obrázek 2.1: Svaly horní konèetiny*

Motorické neurony se nacházejí uvnitø mozkového kmene a míchy a jsou spojeny se svalem pøes axony, kterı mohou pøenášet excitaèní signál na velké vzdálenosti. Aktivace svalovıch vláken se dìje elektrickımi potenciály bunìènıch membrán. Díky otevíráním a zavíráním iontovıch kanálù umoòují membrány pohyb iontù a vytvoøit tak signál elektromagnetického pole. Tento signál cestuje podél axonù jako vlna a skonèí v motorickém neuronu. Místo, kde se motorické neurony spojují se svalovımi vlákny, se nazıvá neuromuskulární spojení. To je místo, kde vlákna zaènou reagovat na signál motorického neuronu a tím zaènou kontrakce.

*Obrázek 2.2: Struktura kosterního svalu*

## 2.2 EMG signály
Akèní potenciály se vytváøejí bìhem kontrakce kosterní svaloviny. Tyto akèní potenciály se dají mìøit a jsou také základem EMG signálù. EMG signály jsou pouívané pro analızu a klinickou diagnostiku v biomedicínskıch aplikacích, jako jsou rehabilitace pohybovıch vad. Elektrické proudy generované bìhem procesu flexe lze mìøit pomocí elektrod na svalu nebo uvnitø svalu. EMG signály jsou pomìrnì komplikované, protoe jsou závislé na anatomii fyziologické vlastnosti svalu. Neèistoty tìchto signálù jsou zcela bìné a hromadí se pøi cestování tìlem. Signál EMG je také sumou nìkolika motorickıch jednotek, které vysílají ve stejnou dobu, a tak mùe docházet k interakcím mezi tìmito rùznımi signály.

Intervaly, ve kterıch se vyskytují akèní potenciály konkrétní motorické jednotky, jsou náhodné. Samotnı akèní potenciál motorické jednotky je kombinací akèních potenciálù svalovıch vláken patøící k jedné motorické jednotce. Lze to popsat vzorcem níe:

$$x(n) = \sum_{r=0}^{N-1} h(r)e(n-r) + w(n)$$

V tomto vzorci je:
*   `x(n)` vıslednı EMG signál,
*   `e(n)` impuls odpalu n,
*   `h(r)` akèní potenciál motorické jednotky,
*   `w(n)` aditivní bílı Gaussùv šum,
*   `N` poèet støel motorickıch jednotek.

*Obrázek 2.3: Dekompozice EMG signálu*

## 2.3 Snímání EMG signálù
EMG signály jsou snímány elektrodami, které jsou buï umístìny na kùi nad svalem, nebo uvnitø svalu. Obì varianty mají svá pro a proti. Pøi pouití intramuskulárních senzorù musí bıt prostøedí a senzory sterilizovány, protoe se jedná o invazivní postup, kterı nese velké riziko pøenosu nemoci nebo spuštìní infekce. Na druhou stranu, jakmile je elektroda umístìna, tak nezpùsobuje ádné nepohodlí a signály nejsou zkresleny tkánìmi svalù a kùe. Tento proces vede k vìtší èistosti signálu nad šumem.

Na druhou stranu, povrchové elektrody mohou bıt kdykoliv pøemístìny, pokud poloha není vhodná a nepotøebuje k tomu ádné invazivní postupy. Vìtšinou se povrchové elektrody vyuívají pro krátká mìøení. Je velmi dùleité elektrody správnì umístit a pouívat elektrody pro konkrétní úkol, vıbìr místa toti velice ovlivní získanı signál. Chceme-li získat nejvyšší sílu signálu, tak elektrody musí bıt umístìny uprostøed svalu ve smìru svalovıch vláken. Nejèastìjší pouívané elektrody jsou Ag/AgCL, protoe nejsou polarizovatelné a umonují proudovı tok kùe. Ve vìtšinì pøípadù jsou pøipevnìny pomocí vodivého gelu pro sníení impedanci kùe.

Obvykle se pouívají `2n + 1` elektrody. Dvì pro kadı kanál `n` a jedna referenèní (uzemòovací) elektroda, která je umístìna na elektricky nesouvisející tkání.

Poté, co je signál zachycen, je obvykle zesílen, protoe jeho amplituda je pomìrnì malá. Pro první etapu zesílení se bìnì pouívá diferenciální zesilovaè. Diferenciální zesilovaè se pouívá k eliminaci spoleènıch proudù. Signál je snímán na tøech místech, dvì detekèní elektrody a jedna referenèní, která definuje neutrální zem, kterou sdílejí další dvì elektrody. Jakıkoliv spoleènı signál pro tyto dvì elektrody bude odstranìn, naopak signály, které nesdílejí, budou poté zesíleny.

Poté se pouije zesilovaè k dalšímu zvıšení amplitudy signálu. Pro eliminaci vysokého šumu se pouívá pláš nízko propustného filtru frekvence. Dále lze pouít usmìrnìní signálu pro pøeklopení èástí negativního signálu na pozitivní. Nakonec je pouit A/D pøevodník, aby poèítaè nebo mikrokontroler mohl pracovat se signálem EMG.

*Obrázek 2.4: Schéma nahrávaní EMG*

---

# 3. MONÉ ZPÙSOBY ZPRACOVÁNÍ EMG SIGNÁLU A JEJICH IMPLEMENTACE V PROTÉZÁCH

## 3.1 Mikrokontrolery
Je na vıbìr nìkolik moností. První moností je pouít mikrokontroler k mìøení svalové aktivity a vyhodnocování signálu. Napøíklad Arduino Uno je zaloeno na èipu ATMEL ATmega328, pracuje na frekvenci 16 MHz a mùe komunikovat s ostatními zaøízeními pøes UART, SPI a I2C. Kromì toho vstupní a vıstupní (GPIO) piny lze pouít k ovládání rùznıch dalších periferií nebo ke ètení analogovıch a digitálních signálù díky vestavìnému 10bitovému A/D pøevodníku. Další vıhodou tìchto vıvojovıch desek je, e je lze jednoduše programovat a nevyadují vyhrazené pøístupy a bitové manipulace jednotlivıch registrù, navíc jsou takové desky dost rozšíøené, snadno dostupné a existuje velké mnoství u vytvoøenıch kódù a dokumentací pro další usnadnìní programování.

Nevıhodou však bıvá vıkon pouitıch procesorù, protoe musí bıt co nejmenší a energeticky efektivní, mají èasto jen omezenı vıkon. To znamená, e na tìchto zaøízeních lze provádìt pouze jednoduché matematické operace, a to mùe mít vıznamnı dopad na vıkon celého systému, zejména pro aplikace v reálném èase, jako je EMG analıza. Kvùli nízkému vıkonu nemusí bıt signály naèteny vèas a zpracování mùe trvat déle, co má za následek velké zpodìní v celém systému nebo omezenou funkènost, proto je lepší se dívat po dalších vıkonnìjších mikrokontrolerech.

## 3.2 Senzory
Prvním krokem pøi získávání dat je identifikace správnıch pozic pro elektrody. Aby bylo moné správnì rozeznávat pohyby jednotlivıch prstù, je potøeba pouít nìkolik svalovıch signálù. Na monitorování kadého prstu je potøeba minimálnì 4 senzory èili 4 kanály. Jeden pro palec, jeden pro prostøedníèek, jeden pro ukazováèek a jeden senzor pro prsteníèek a malíèek dohromady. Nejlépe je pouít 5 senzorù, aby mìl kadı prst vyhrazenı kanál.

Celkem máme tedy 11 elektrod. Pìt párù po dvou elektrodách a další referenèní elektrodu. Tato referenèní elektroda je umístìna na zadní stranì pøedloktí v úrovni loktu, protoe tam se dá oèekávat malá svalová aktivita, nebo na kosterní èásti ruky. Senzory jsou poté pøipojeny k samotnım elektrodám, aby zesílily a pøenesly signál do mikrokontroleru.

V dnešní dobì jsou EMG senzory pomìrnì dost rozšíøené a máme na vıbìr hned nìkolik rùznıch senzorù od rùznıch firem. Ve své práci jsem pouil senzory **MyoWare od Advancer Technologies**. Tyto senzory lze provozovat pro napìtí 3,3 V nebo 5 V. Logika zpracování svalového signálu je øešena pøímo na senzorech, tudí z nich mùeme èíst obálku signálu. Pokud je pro tuto funkci nechceme pouit, mùeme zachytit i surovı EMG signál a zpracování si øešit potom sami. Zesílení signálu lze nastavit pomocí potenciometru. Vıstupní analogovı signál u potom èteme a zpracováváme na mikrokontroleru.

*Obrázek 3.1: Myoware muscle sensor*

## 3.3 Pøíklady protéz

### 3.3.1 Inteligentní humanoidní robotická ruka Sain
Tato robotická ruka se dá velmi snadno pouívat, protoe u je pøedem sloená.

*Obrázek 3.2: Sain Smart 5-DOF*

### 3.3.2 Protetická ruka InMoov
Protetická ruka InMoov nabízí lepší zpùsob zobrazení pohybù. Je souèástí projektu s otevøenım zdrojovım kódem, kterı zaloil francouzskı sochaø a designér Gael Langevin. Projekt InMoov se skládá ze stovek 3D tisknutıch dílù, které lze pøipojit k pohonùm a vytvoøit tak robota v ivotní velikosti. Jednotlivé konèetiny lze ovládat a rozpohybovat pomocí motorù. Stejnì jako u ruky Sain Smart lze prsty ovládat jednotlivì. To se také provádí pomocí 5 serv, které se montují do pøedloktí a ovládají prst pøes provázky. Jedno servo mùe bıt pouito k otáèení ruky kolem zápìstí. Ve srovnání s rukou Sain Smart pouívají InMoov vìtší a mnohem silnìjší serva. Kromì toho návrh prošel nìkolika designovımi iteracemi a neustále se pøizpùsobuje a zlepšuje.

*Obrázek 3.3: Robot InMoov*

---

# 4. SESTROJENÍ RUKY

Kompletní sestrojení ruky se rozdìlovalo na více èástí.
*   Sestrojení mechanické èasti ruky.
*   Ovládaní servo pohonù na ruce.
*   Ovládání pomocí EMG senzorù.
*   Ovládaní pøes uivatelské rozhraní.
*   Sestrojení podstavce pro zlepšení vzhledu a manipulace.

## 4.1 InMoov ruka
Pro svùj projekt jsem zvolil sestrojení protetické ruky InMoov. Na InMoov webu jsou dostupné všechny díly a také podrobnı návod jak ruku sloit. Celá ruka se skládá z 50 rùznıch dílù. Díly jsou vytisknuté z PETG materiálu. Vìtšinou se díly lepily k sobì, ale nìkteré jsou i našroubované.

Ve spodní èásti ruky je pøimontovanıch pìt MG995 servo pohonù, které pohybují s prsty. Další MG995 servo je pøimontované v zápìstí pro otáèení dlanì.

Èlánky prstù jsou k sobì lepené a pro klouby je vyuita válcovitá tyè o prùmìru 3 mm, která slouí jako èep. Èlánky prstu jsou pøes pomocné vodicí díry propleteny vdy dva stejnì dlouhé rybáøské pletence. Na koneècích prstù jsou dva provázky svázané k sobì, aby utvoøily jeden.

Dále jsou provázky propletené pøes dlaò a po zápìstí a tam jsou navázané na serva, které je napínají a tím napodobují funkci šlachy: kdy servo zatáhne za jeden konec provázku, prst se ohne a kdy zatáhne za druhı, tak se prst znova otevøe.

*Obrázek 4.1: Díly k ruce | Obrázek 4.2: Spodní èást ruky | Obrázek 4.3: Servo na otáèení dlanì | Obrázek 4.4: Dlaò | Obrázek 4.5: Koneèky prstù | Obrázek 4.6: Propletení provázku pøes ruku*

Provázky jsou namotané na krouky servo motorù a pomoci dvou šroubkù se provázek napne. Všechna serva ovládá Micro Maestro 6-Channel od Pololu, kterı komunikuje s Arduinem pøes protokol UART.

*Obrázek 4.7: Sestavená ruka*

## 4.2 Ovládaní servo motorù
Micro Maestro, které ovládá servo pohony a Arduino spolu komunikují pomocí protokolu UART èili pøes RX a TX piny na desce. Protoe Arduino UNO má dva vyhrazené RX a TX piny, které jsou potøeba pro nahrávání kódu, tak si je simuluji na jinıch pinech pomocí knihovny `SoftwareSerial.h`.

Díky knihovnì pro Micro Maestro u šlo samotné programování pohybu serv jednoduše. Pro zefektivnìní a pro lepší pøehlednost kódu jsem vytvoøil tøidu `Arm`, která obsahuje veškeré potøebné metody k ovládaní serv, jako jsou `openIndex()`, `closeIndex()`, `getIndexPos()` a další.

```cpp
void Arm::openPinky()const{
    maestro.setTarget(this->pinky,this->open);
    return;
}

void Arm::closeThumb()const{
    maestro.setTarget(this->thumb, close);
    return;
}
```

## 4.3 Ovládaní ruky pomocí EMG
Mım cílem bylo monitorovat kadı prst, ale v prùbìhu jsem zjistil, e tento cíl je dosti vzdálenı z dùvodu nedostatku financí. Cena tìchto senzorù je pomìrnì dost vysoká.

Rozhodl jsem se proto pro jednodušší øešení pouze s jedním senzorem a monitorování otevøení a sevøení pìsti. Èást kódu, která se stará o ovládání ruky pomoci EMG senzorù, je pomìrnì dost jednoduchá. Kdy si necháme vypisovat hodnoty ze senzorù na graf, tak dostaneme takovıto vısledek.

Z grafu jde vidìt, e kdy zatneme pìst, tak hodnota rapidnì vzroste, protoe v tu chvíli projde pøes senzor elektrickı proud. Poté jsou hodnoty zase nízké, i kdy dríme zatnutou pìst. Hodnota opìt vzroste, kdy pìst uvolníme.

Èili kdy hodnota bude vìtší ne naše nastavená prahová hodnota, tak se pohne servy tak, aby utvoøily pìst.

*Obrázek 4.8: Graf EMG hodnot | Obrázek 4.9: Graf EMG hodnot (detail)*

Problémem je, e nevíme, kdy má uivatel sevøenou pìst a kdy ne, protoe nárùsty hodnot jsou témìø stejné v obou pøípadech. Èili pro moje øešení jsem pouil jednoduchı pøepínaè, kterı pøepíná mezi stavy pìst a dlaò. Nárùst hodnoty trvá nìjakou chvílí, take ještì pøed pøepnutím stavu se poèká 250 ms, ne k nìmu dojde.

```cpp
void sensor() {
    // Read the values from EMG sensor
    sensorValue = analogRead(A0);
    unsigned long currentMillis = millis();

    // Swap for fist flag
    if (sensorValue >= sensorTreshold && sensorFist == 0) {
        // Wait some time to prevent unwanted switching
        if (currentMillis - prevMillis > sensInterval) {
            sensorFist = 1;
            prevMillis = currentMillis;
        }
    } else if (sensorValue >= sensorTreshold && sensorFist == 1) {
        if (currentMillis - prevMillis > sensInterval) {
            sensorFist = 0;
            prevMillis = currentMillis;
        }
    }
}
```

## 4.4 Displej a uivatelské ovládaní
Ruka má k dispozici i uivatelské ovládání, kdy si na displeji mùe pomocí rotaèního enkodéru uivatel vybrat mezi rùznımi módy ovládání:

1.  **Manuální** – v tomto modu si mùe uivatel natoèit jednotlivı prst do urèitého úhlu ruènì.
2.  **EMG** – zde se bude ruka ovládat pomocí EMG senzorù. Uivatel zde mùe vidìt i aktuální hodnotu senzoru a také si upravit hranièní hodnotu, pøi které má ruka sevøít pìst.
3.  **Gesta** – zde si mùe uivatel vybrat mezi rùznımi pøed-programovanımi gesty.

*Obrázek 4.11: Ukázka uivatelského ovládaní*

## 4.5 Podstavec
Myšlenka podstavce se zrodila hlavnì proto, aby došlo k zapouzdøení hardwaru, ale také z dùvodu efektnìjší prezentace funkènosti celého zaøízení. Ruka drí na podstavci pomocí kvalitního suchého zipu, ze kterého se ruka v pøípadì potøeby jednoduše uvolní. Na boèní stranì podstavce jsou konektory, které slouí pro jednoduché a rychlé pøipojení servomotorù k celému systému. Kromì konektoru pro serva je dostupnı rovnì konektor pro pøipojení EMG senzorù.

*Obrázek 4.9: Hotová ruka na podstavci*

## 4.6 Vyuité souèástky
*   Arduino UNO R3
*   InMoov ruka
*   Pololu Micro Maestro 6-channel
*   6xMG995 servo
*   Myoware muscle sensor Advancer Technologies
*   Ag/AgCL elektrody
*   Rotaèní enkodér
*   0.96" OLED displej 128x64 I2C
*   Pasivní bzuèák
*   Li-pol 2250mAh 7.4V 25C
*   2x10 k? rezistor
*   Napìovı regulátor na 5V
*   Pøepínaè

*Obrázek 4.10: Schéma zapojení*

---

# ZÁVÌR
Jak u jsem zmínil v úvodu, tak moje práce splnila vìtšinu mıch dílèích cílù, jako tøeba bylo sestavení robotické ruky InMoov. Aby byl projekt o nìco více zajímavìjší, tak se mi povedlo pøidat uivatelské rozhraní, které umoòuje 3 zpùsoby ovládaní.

Z dùvodu nedostatkù financi, jsem si nemohl dovolit koupit více EMG senzorù, které by mi umonily monitorovaní všech prstù. V mojí práci jsem si teda musel vystaèit pouze s jedním, ale i tak jsem s vısledkem sledovaní sevøení a otevøení pìsti velice spokojen.

V prùbìhu jsem narazil na øadu problémù, díky kterım jsem si rozšíøil znalosti v elektrotechnice a programovaní mikrokontroleru. Nejvìtší problém byl vıkon mikrokontroleru. Vzhledem k tomu, e u jde takøka o real-time aplikaci, poohlíel jsem se i po nìjakıch procesorech s architekturou ARM. Nejlepším adeptem byl Arduino DUE, ale jeho nevıhodou byla vysoká cena. Nakonec jsem se rozhodl sáhnout po absolutním vıkonnostním minimu, koupit Arduino UNO, a to hlavnì díky jeho nízké cenì a vyšší vzorkovací frekvenci na A/D pøevodníku, která èiní 9600 Hz a doporuèuje se pøi pouití s EMG senzory. Bohuel i tak ho enu na úplnı okraj vıkonnosti; musel jsem proto pøizpùsobit kód, abych ušetøil co nejvíce pamìti RAM.

Projekt má stále mnoho prostoru pro rùzná vylepšení, jak u u mechanické ruky samotné, jako tøeba zlepšit napnutí provázkù, aby byli pohyby prstù co nejlepší nebo vylepšit kód pro ovládaní ruky s EMG a taky samotné snímaní EMG, nebo taky vylepšit podstavec a uivatelské rozhraní.

Do budoucna bych se moná chtìl k tomuto projektu a docílit snímaní všech jednotlivıch prstù a aby celı program bìel na ARM procesoru.

---

# SEZNAM POUITİCH INFORMAÈNÍCH ZDROJÙ

1.  History, Travel, Arts, Science, People, Places Smithsonian Magazine. History, Travel, Arts, Science, People, Places Smithsonian Magazine [online]. Copyright © 2021 Smithsonian Magazine [cit. 25.12.2021]. Dostupné z: https://www.smithsonianmag.com/smart-news/study-reveals-secrets-ancient-cairo-toe180963783/.
2.  Ancient Origins. Ancient Origins | Reconstructing the story of humanity's past [online]. Copyright © 2013 [cit. 25.12.2021]. Dostupné z: https://www.ancient-origins.net/history-famous-people/16thcentury-prosthetic-iron-hand-story-gotz-von-berlichingen-006153
3.  Arduino Fast(er) Sampling Rate. Wildan's Blog [online]. Copyright © 2017 [cit. 25.12.2021]. Dostupné z: https://blog.wildan.us/2017/11/03/arduino-fast-er-sampling-rate/
4.  Skeletal muscle structure and function – Musculoskeletal Genetics. Newcastle University Blogging Service [online]. Dostupné z: https://blogs.ncl.ac.uk/katarzynapirog/skeletal-muscle-structure-and-function/
5.  16th Century Prosthetic Iron Hand: The Story of Gotz von Berlichingen | Ancient Origins. Ancient Origins | Reconstructing the story of humanity's past [online]. Copyright © 2013 [cit. 25.12.2021]. Dostupné z: https://www.ancient-origins.net/history-famous-people/16th-century-prosthetic-iron-hand-story-gotz-von-berlichingen-006153
6.  Upper Limb Prostheses | Encyclopedia.com. Encyclopedia.com | Free Online Encyclopedia [online]. Copyright © 2019 [cit. 25.12.2021]. Dostupné z: https://www.encyclopedia.com/medicine/encyclopedias-almanacs-transcripts-and-maps/upper-limb-prostheses
7.  Timeline: Prosthetic Limbs Through the Years | UPMC HealthBeat. Expert Health Information and Articles | UPMC HealthBeat [online]. Dostupné z: https://share.upmc.com/2015/03/timeline-prosthetic-limbs-years/
8.  The Usefulness of Mean and Median Frequencies in Electromyography Analysis | IntechOpen. IntechOpen - Open Science Open Minds | IntechOpen [online]. Copyright © 2012 The Author [cit. 25.12.2021]. Dostupné z: https://www.intechopen.com/chapters/40123
9.  Hand and Forarm – InMoov. InMoov – open-source 3D printed life-size robot [online]. Dostupné z: http://inmoov.fr/hand-and-forarm/
10. How I Designed & Built a Prosthetic Arm - YouTube. YouTube [online]. Copyright © 2021 Google LLC [cit. 25.12.2021]. Dostupné z: https://www.youtube.com/watch?v=CIqzeBxkRws&list=PLYJ6xc5oEtviBMOvdvupa6gBtBWiD_kFk&ab_channel=MahdiDesigns
11. [online]. Dostupné z: https://www.science.org/doi/10.1126/scirobotics.aaw6339
12. Advancer Technologies, LLC: MyoWare Muscle Sensor. Advancer Technologies, LLC [online]. Dostupné z: http://www.advancertechnologies.com/p/myoware.html
13. [online]. Dostupné z: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3214794/
14. Electromyography (EMG) | Johns Hopkins Medicine. Johns Hopkins Medicine, based in Baltimore, Maryland [online]. Copyright © [cit. 25.12.2021]. Dostupné z: https://www.hopkinsmedicine.org/health/treatment-tests-and-therapies/electromyography-emg
15. Pololu Maestro Servo Controller User’s Guide. Pololu Robotics and Electronics [online]. Copyright © 2001 [cit. 25.12.2021]. Dostupné z: https://www.pololu.com/docs/0J40
16. Základy sportovní kineziologie | Fakulta sportovních studií. Informaèní systém [online]. Dostupné z: https://is.muni.cz/do/1451/e-learning/kineziologie/elportal/pages/funkce_svalu.html
17. Šlacha – Wikipedie. [online]. Dostupné z: https://cs.wikipedia.org/wiki/%C5%A0lacha
18. Myofibrila – WikiSkripta. [online]. Dostupné z: https://www.wikiskripta.eu/w/Myofibrila
19. Akèní potenciál – Wikipedie. [online]. Dostupné z: https://cs.wikipedia.org/wiki/Akèní_potencíal
20. Pictorial outline of the decomposition of the surface EMG signal into... | Download Scientific Diagram. ResearchGate | Find and share research [online]. Copyright © 2008 [cit. 25.12.2021]. Dostupné z: https://www.researchgate.net/figure/Pictorial-outline-of-the-decomposition-of-the-surface-EMG-signal-into-its-constituent_fig1_6886902
21. Electromyography with MyoWare Muscle Sensor & Arduino. How To Electronics | Engineering Projects & Tutorials [online]. Copyright © Copyright 2021, All Rights Reserved [cit. 25.12.2021]. Dostupné z: https://how2electronics.com/electromyography-emg-with-myoware-muscle-sensor-arduino/

---

# SEZNAM PØÍLOH

*   Obrázek 1.1 https://www.smithsonianmag.com/smart-news/study-reveals-secrets-ancient-cairo-toe-180963783/
*   obrázek 1.2 https://wellcomecollection.org/works/kyjgqfuh
*   obrázek 1.3 https://commons.wikimedia.org/wiki/File:Berlichingen_Eiserne_Hand_1.jpg
*   obrázek 1.5 https://www.armdynamics.com/our-care/prosthetic-options
*   obrázek 1.6 https://www.ottobock-export.com/en/prosthetics/upper-limb/solution-overview/arm-prostheses-body-powered/
*   obrázek 1.7 https://www.ottobockus.com/prosthetics/upper-limb-prosthetics/solution-overview/myoelectric-prosthetics/
*   obrázek 2.1 https://www.vut.cz/www_base/zav_prace_soubor_verejne.php?file_id=192502
*   obrázek 2.2 https://www.vut.cz/www_base/zav_prace_soubor_verejne.php?file_id=192502
*   obrázek 2.3 https://www.researchgate.net/figure/Pictorial-outline-of-the-decomposition-of-the-surface-EMG-signal-into-its-constituent_fig1_6886902
*   obrázek 2.4 https://how2electronics.com/electromyography-emg-with-myoware-muscle-sensor-arduino/
*   obrázek 3.1 http://www.advancertechnologies.com/p/myoware.html
*   obrázek 3.2 https://www.amazon.com/Humanoid-Fingers-Metal-Manipulator-Servos/dp/B076Q4DYPN
*   obrázek 3.3 http://inmoov.fr/gallery-v2/
