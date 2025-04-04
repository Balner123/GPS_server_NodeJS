#define TINY_GSM_MODEM_SIM800 // Není přímo použito, ale může být relevantní pro knihovny

#include <Arduino.h>
#include <TinyGPS++.h>
// #include <ArduinoJson.h> // Není potřeba pro sestavení JSON stringu ručně

// --- Konfigurace ---
// Piny pro GPS modul (UART2)
#define GPS_TX 14           // ESP32 pin připojený k RX pinu GPS
#define GPS_RX 13           // ESP32 pin připojený k TX pinu GPS
#define GPS_POWER_PIN 25    // Pin pro napájení GPS
#define SATTELITES_NEEDED 4 // Sníženo pro rychlejší testování, můžete vrátit na 5
#define GPRS_TRIES_COUNT 3  // Počet pokusů o připojení GPRS

// Piny pro SIM800L (UART1) - Podle schématu T-Call V1.4
#define SIM800_TX 26        // ESP32 pin připojený k RX pinu SIM800L
#define SIM800_RX 27        // ESP32 pin připojený k TX pinu SIM800L
#define SIM800_PWRKEY 4     // Není použito v tomto kódu, ale definováno
#define SIM800_RST 5        // Pin pro reset SIM800L
#define SIM800_POWER 23     // Pin pro ovládání napájení SIM800L

// Nastavení APN a serveru
const char apn[] = "internet.t-mobile.cz"; // Vaše APN
const char gprsUser[] = "gprs";            // GPRS uživatel (pokud je potřeba)
const char gprsPass[] = "gprs";            // GPRS heslo (pokud je potřeba)
const char* serverUrl = "http://129.151.193.104:5000/device_input"; // Váš server endpoint
int deviceId = 200;                        // ID vašeho zařízení

// Definice časového intervalu pro deep sleep (1 minuta)
#define SLEEP_HOURS 0
#define SLEEP_MINUTES 1
#define SLEEP_SECONDS 0
// --- Konec Konfigurace ---


// Inicializace sériových portů
HardwareSerial SerialGPS(2); // GPS na UART2
HardwareSerial SerialAT(1);  // SIM800L na UART1
TinyGPSPlus gps;             // Objekt pro práci s GPS

// Globální proměnné pro GPS data
float latitude = 0.0;
float longitude = 0.0;
int numSats = 0;
float gpsSpeed = 0.0;
float gpsAltitude = 0.0;
float gpsHdop = 100.0; // Defaultní vysoká hodnota

// Výpočet času pro deep sleep v mikrosekundách
unsigned long convertToMicroseconds(int hours, int minutes, int seconds) {
  return (hours * 3600ULL + minutes * 60ULL + seconds) * 1000000ULL;
}
unsigned long deepSleepTime = convertToMicroseconds(SLEEP_HOURS, SLEEP_MINUTES, SLEEP_SECONDS);

// Funkce pro čtení odpovědi z modemu s timeoutem
String readSerialResponse(unsigned long timeout = 1000) {
  String response = "";
  unsigned long startTime = millis();
  while (millis() - startTime < timeout) {
    while (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
    }
  }
  // Vyčistit buffer pro jistotu
  while(SerialAT.available()) { SerialAT.read(); }
  Serial.print("Recv <-: "); // Vypíše přijatou odpověď
  Serial.println(response);
  return response;
}

// Funkce pro odeslání AT příkazu a čekání na specifickou odpověď
bool sendATCommand(String command, String expectedResponse, unsigned long timeout = 5000) {
  Serial.print("Send ->: ");
  Serial.println(command);
  // Vyčistit příchozí buffer před odesláním
  while(SerialAT.available()) { SerialAT.read(); }
  SerialAT.println(command);

  String response = "";
  unsigned long startTime = millis();
  bool result = false;

  while (millis() - startTime < timeout) {
    while (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
      // Optimalizace: Kontrolujeme průběžně, ne až na konci
      if (response.indexOf(expectedResponse) != -1) {
          result = true;
          // break; // Můžeme přerušit vnitřní smyčku
      }
      // Případně kontrola na ERROR
      if (response.indexOf("ERROR") != -1) {
          result = false;
          goto end_loop; // Ukončíme čekání, pokud nastane chyba
      }
    }
    if (result) break; // Přerušíme vnější smyčku, pokud jsme našli očekávanou odpověď
    delay(50); // Krátká pauza, aby se nezahltil procesor
  }

end_loop:
  // Přečteme zbytek odpovědi, pokud nějaký je (krátký timeout)
  response += readSerialResponse(200);

  Serial.print("Recv <-: ");
  Serial.println(response); // Vypíšeme kompletní (nebo částečnou) odpověď

  if (!result) {
      Serial.print("Chyba: Očekávaná odpověď '");
      Serial.print(expectedResponse);
      Serial.println("' nenalezena.");
  }
  return result;
}

// Funkce pro čekání na specifickou odpověď (bez odesílání příkazu)
bool waitForResponse(String expected, unsigned long timeout = 5000) {
  String response = "";
  unsigned long startTime = millis();
  bool found = false;
  Serial.print("Čekám na '");
  Serial.print(expected);
  Serial.print("' (timeout ");
  Serial.print(timeout);
  Serial.println("ms)...");

  while (millis() - startTime < timeout) {
    while (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
      Serial.write(c); // Průběžný výpis na Serial Monitor
      if (response.indexOf(expected) != -1) {
        found = true;
        break; // Našli jsme, konec vnitřní smyčky
      }
      // Můžeme přidat i kontrolu na ERROR zde
      if (response.indexOf("ERROR") != -1) {
          Serial.println("\nDetekována chyba 'ERROR'.");
          return false; // Ukončíme čekání s chybou
      }
    }
    if (found) break; // Našli jsme, konec vnější smyčky
    delay(50);
  }
  Serial.println(); // Nový řádek po výpisu
  if (!found) {
      Serial.println("Timeout nebo chyba při čekání na odpověď.");
  }
  // Přečteme zbytek, pokud něco zbylo v bufferu
  readSerialResponse(200);
  return found;
}


// Inicializace modemu SIM800L
bool initModem() {
  Serial.println("--- Inicializace Modemu ---");

  // Hardwarový reset modemu
  Serial.println("Resetuji modem...");
  pinMode(SIM800_RST, OUTPUT);
  digitalWrite(SIM800_RST, LOW);
  delay(200); // Krátký impuls stačí
  digitalWrite(SIM800_RST, HIGH);
  Serial.println("Čekám 8 sekund po resetu modemu..."); // <<<<<< ZMĚNA <<<<<<
  delay(8000); // <<<<<< ZMĚNA <<<<<<

  // Vypnutí echo - DOČASNĚ ZAKOMENTUJEME PRO TEST
  // Serial.println("Vypínám echo (ATE0)...");
  // if (!sendATCommand("ATE0", "OK", 3000)) {
  //   Serial.println("Nepodařilo se vypnout echo.");
  //   // Můžeme pokračovat i bez vypnutí echa pro test
  // }

  // Kontrola komunikace - POUZE AT S DELŠÍM TIMEOUTEM
  Serial.println("Posílám základní AT příkaz...");
  if (!sendATCommand("AT", "OK", 10000)) { // <<<<<< ZMĚNA TIMEOUTU <<<<<<
    Serial.println("Modem neodpovídá na AT příkaz!");
    return false;
  }
  Serial.println("Modem odpověděl na AT.");

  // Pokud AT projde, můžeme zkusit zbytek inicializace
  Serial.println("Nastavuji plnou funkcionalitu (CFUN=1)...");
  if (!sendATCommand("AT+CFUN=1", "OK", 5000)) {
    Serial.println("Nepodařilo se nastavit CFUN=1!");
    return false;
  }
  delay(1000);

  Serial.println("Kontroluji SIM kartu (CPIN?)...");
  if (!sendATCommand("AT+CPIN?", "+CPIN: READY", 5000)) {
    Serial.println("SIM karta není připravena nebo chybí!");
    return false;
  }

  // Čekání na registraci v síti (CREG: 0,1 nebo 0,5)
  Serial.println("Čekám na registraci v síti...");
  int attempts = 0;
  while (attempts < 30) {
    SerialAT.println("AT+CREG?");
    String response = readSerialResponse(1000);
    if (response.indexOf("+CREG: 0,1") != -1 || response.indexOf("+CREG: 0,5") != -1) {
      Serial.println("Registrováno v síti!");
      return true;
    }
    Serial.print(".");
    delay(2000); // Čekáme déle mezi pokusy
    attempts++;
  }

  Serial.println("\nNepodařilo se zaregistrovat v síti!");
  return false;
}

// Konfigurace GPRS parametrů
bool gsm_config_gprs() {
  Serial.println("--- Konfigurace GPRS ---");
  if (!sendATCommand("AT+SAPBR=3,1,Contype,GPRS", "OK", 5000)) return false;
  String cmd = "AT+SAPBR=3,1,APN,\"";
  cmd += apn;
  cmd += "\"";
  if (!sendATCommand(cmd, "OK", 5000)) return false;
  // Pokud vaše APN vyžaduje jméno a heslo:
  // cmd = "AT+SAPBR=3,1,USER,\""; cmd += gprsUser; cmd += "\"";
  // if (!sendATCommand(cmd, "OK", 5000)) return false;
  // cmd = "AT+SAPBR=3,1,PWD,\""; cmd += gprsPass; cmd += "\"";
  // if (!sendATCommand(cmd, "OK", 5000)) return false;
  return true;
}

// Připojení k GPRS síti
bool connectGPRS() {
    Serial.println("--- Připojování k GPRS ---");
    // Aktivace GPRS kontextu
    if (!sendATCommand("AT+SAPBR=1,1", "OK", 15000)) { // Delší timeout pro aktivaci
        Serial.println("Nepodařilo se aktivovat GPRS (SAPBR=1,1)");
        // Zkusíme deaktivovat pro případ, že byl aktivní
        sendATCommand("AT+SAPBR=0,1", "OK", 5000);
        return false;
    }
    delay(2000); // Pauza po aktivaci

    // Dotaz na přidělenou IP adresu
    Serial.println("Ověřuji IP adresu...");
    SerialAT.println("AT+SAPBR=2,1");
    String response = readSerialResponse(5000);
    // Hledáme odpověď formátu +SAPBR: 1,1,"<IP_ADRESA>"
    if (response.indexOf("+SAPBR: 1,1,\"") != -1) {
        Serial.println("GPRS připojeno, IP adresa získána.");
        return true;
    } else {
        Serial.println("Nepodařilo se získat IP adresu.");
        // Deaktivujeme kontext, pokud se nepodařilo získat IP
        sendATCommand("AT+SAPBR=0,1", "OK", 5000);
        return false;
    }
}

// Odeslání HTTP POST požadavku
bool gsm_http_post(String url, String postData) {
  Serial.println("--- HTTP POST Start ---");
  bool success = false;
  String cmd; // Deklarace proměnné CMD zde kvůli goto

  if (!sendATCommand("AT+HTTPINIT", "OK", 5000)) goto cleanup;
  if (!sendATCommand("AT+HTTPPARA=CID,1", "OK", 5000)) goto cleanup; // Používáme GPRS kontext 1

  // Nyní můžeme bezpečně používat 'cmd'
  cmd = "AT+HTTPPARA=URL,\"";
  cmd += url;
  cmd += "\"";
  if (!sendATCommand(cmd, "OK", 5000)) goto cleanup;

  if (!sendATCommand("AT+HTTPPARA=CONTENT,application/json", "OK", 5000)) goto cleanup;

  // Odeslání dat
  cmd = "AT+HTTPDATA=";
  cmd += String(postData.length());
  cmd += ",15000"; // Timeout pro odeslání dat (ms)
  Serial.print("Send ->: ");
  Serial.println(cmd);
  SerialAT.println(cmd);

  // Čekání na prompt "DOWNLOAD"
  if (!waitForResponse("DOWNLOAD", 15000)) {
      Serial.println("Chyba: Modem neposlal 'DOWNLOAD' prompt.");
      goto cleanup;
  }

  // Odeslání samotných JSON dat
  Serial.print("Send ->: ");
  Serial.println(postData);
  SerialAT.print(postData); // Použijeme print, ne println!

  // Čekání na OK po odeslání dat
  if (!waitForResponse("OK", 15000)) { // Delší timeout po odeslání dat
      Serial.println("Chyba: Modem nepotvrdil příjem dat (OK).");
      goto cleanup;
  }

  // Spuštění HTTP POST akce
  // Použijeme delší timeout a čekáme na specifickou odpověď +HTTPACTION
  Serial.println("Spouštím HTTP POST akci...");
  Serial.print("Send ->: ");
  Serial.println("AT+HTTPACTION=1");
  SerialAT.println("AT+HTTPACTION=1");

  // Čekáme na odpověď obsahující "+HTTPACTION:"
  if (!waitForResponse("+HTTPACTION:", 30000)) { // Zvýšený timeout na 30s
      Serial.println("Chyba: HTTP POST akce selhala nebo vypršel čas (neobdržena odpověď +HTTPACTION).");
      // I když jsme nedostali +HTTPACTION, zkusíme přečíst odpověď a ukončit session
      sendATCommand("AT+HTTPREAD", "OK", 10000);
      goto cleanup;
  }
  // Pokud jsme dostali +HTTPACTION, můžeme pokračovat
  Serial.println("Odpověď +HTTPACTION přijata.");
  // Zde bychom mohli parsovat status kód z odpovědi +HTTPACTION, např. ",200," pro úspěch

  // Přečtení odpovědi serveru (nepovinné, ale užitečné pro debug)
  Serial.println("Čtu odpověď serveru (pokud existuje)...");
  sendATCommand("AT+HTTPREAD", "OK", 10000); // Přečteme odpověď, čekáme na OK

  success = true; // Pokud jsme se dostali sem, považujeme POST za úspěšný (alespoň odeslaný)

cleanup:
  Serial.println("Ukončuji HTTP session...");
  sendATCommand("AT+HTTPTERM", "OK", 5000); // Vždy ukončit HTTP

  Serial.println("--- HTTP POST End ---");
  return success;
}

// Funkce pro přechod do deep sleep
void goToDeepSleep() {
    Serial.println("Přecházím do hlubokého spánku...");
    Serial.flush(); // Počkáme na odeslání všech zpráv ze sériové linky
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
}

// Funkce pro vypnutí periferií
void powerDownPeripherals() {
    Serial.println("Vypínám GPS a Modem...");
    digitalWrite(GPS_POWER_PIN, LOW);
    // Vypnutí modemu přes AT příkaz (jemnější než odpojení napájení)
    if (!sendATCommand("AT+CPOWD=1", "NORMAL POWER DOWN", 10000)) {
        Serial.println("Nepodařilo se vypnout modem příkazem, vypínám natvrdo.");
        digitalWrite(SIM800_POWER, LOW); // Pokud AT selže, vypneme natvrdo
    } else {
         digitalWrite(SIM800_POWER, LOW); // I po úspěšném CPOWD je dobré odpojit napájení
    }
    delay(1000); // Krátká pauza
}


void setup() {
  Serial.begin(115200);
  while (!Serial); // Počkáme na otevření sériového monitoru (pro některé desky)
  Serial.println("\n--- Start Programu ---");

  // Nastavení pinů
  pinMode(GPS_POWER_PIN, OUTPUT);
  pinMode(SIM800_POWER, OUTPUT);
  pinMode(SIM800_RST, OUTPUT);
  digitalWrite(SIM800_RST, HIGH); // Reset pin by měl být HIGH v klidu

  // --- GPS Sekce ---
  Serial.println("Zapínám GPS modul...");
  digitalWrite(GPS_POWER_PIN, HIGH);
  delay(1000); // Čas pro stabilizaci GPS

  // Inicializace sériové komunikace pro GPS
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX); // Správné pořadí: RX pin, TX pin

  Serial.println("Čekám na platné GPS souřadnice...");
  unsigned long gpsStartTime = millis();
  bool gpsFixed = false;
  while (millis() - gpsStartTime < 300000) { // Timeout 5 minut pro GPS fix
    while (SerialGPS.available() > 0) {
      if (gps.encode(SerialGPS.read())) { // Zpracujeme jeden byte
         // Získání dat proběhne až když máme fix
      }
    }

    // Kontrola fixu až po zpracování dostupných dat
    if (gps.location.isUpdated() && gps.location.isValid() && gps.satellites.isValid() && gps.satellites.value() >= SATTELITES_NEEDED) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
      numSats = gps.satellites.value();
      gpsSpeed = gps.speed.kmph();
      gpsAltitude = gps.altitude.meters();
      gpsHdop = gps.hdop.isValid() ? (gps.hdop.value() / 100.0) : 99.99; // HDOP

      Serial.println("\nGPS Fix získán!");
      Serial.print("Souřadnice: "); Serial.print(latitude, 6); Serial.print(", "); Serial.println(longitude, 6);
      Serial.print("Satelity: "); Serial.println(numSats);
      Serial.print("Rychlost: "); Serial.println(gpsSpeed);
      Serial.print("Výška: "); Serial.println(gpsAltitude);
      Serial.print("HDOP: "); Serial.println(gpsHdop);
      gpsFixed = true;
      break; // Ukončíme čekání na GPS
    }

    // Výpis stavu každých 5 sekund
    if (millis() % 5000 < 20) { // Jednoduchý způsob, jak tisknout periodicky
        Serial.print("Čekám na fix... Satelity: ");
        Serial.print(gps.satellites.isValid() ? String(gps.satellites.value()) : "N/A");
        Serial.print(", Platná poloha: ");
        Serial.print(gps.location.isValid() ? "Ano" : "Ne");
        Serial.print(", Aktualizovaná poloha: ");
        Serial.println(gps.location.isUpdated() ? "Ano" : "Ne");
    }
     delay(10); // Krátká pauza ve smyčce
  }

  if (!gpsFixed) {
    Serial.println("\nNepodařilo se získat GPS fix v časovém limitu.");
    // Můžeme zde buď jít spát, nebo pokračovat bez GPS dat / s nulovými daty
    // Prozatím půjdeme spát
    powerDownPeripherals();
    goToDeepSleep();
  }

  Serial.println("Vypínám GPS modul.");
  digitalWrite(GPS_POWER_PIN, LOW);
  SerialGPS.end(); // Ukončíme sériovou komunikaci s GPS

  // --- Modem Sekce ---
  Serial.println("Zapínám SIM800L modul...");
  digitalWrite(SIM800_POWER, HIGH);
  Serial.println("Čekám 8 sekund po zapnutí modemu..."); // <<<<<< ZMĚNA <<<<<<
  delay(8000); // <<<<<< ZMĚNA <<<<<<

  // Inicializace sériové komunikace pro Modem
  SerialAT.begin(9600, SERIAL_8N1, SIM800_RX, SIM800_TX); // Správné pořadí: RX pin, TX pin

  if (!initModem()) {
    Serial.println("Inicializace modemu selhala.");
    powerDownPeripherals();
    goToDeepSleep();
  }

  // Konfigurace a připojení GPRS
  bool gprsConnected = false;
  for (int attempt = 1; attempt <= GPRS_TRIES_COUNT; ++attempt) {
      Serial.print("Pokus o připojení GPRS č. "); Serial.println(attempt);
      if (gsm_config_gprs() && connectGPRS()) {
          gprsConnected = true;
          break; // Úspěšně připojeno
      }
      Serial.println("Pokus selhal, čekám 5 sekund...");
      delay(5000);
      // Zkusíme deaktivovat GPRS před dalším pokusem
      sendATCommand("AT+SAPBR=0,1", "OK", 5000);
      delay(1000);
  }


  if (!gprsConnected) {
    Serial.println("Připojení k GPRS selhalo po všech pokusech.");
    powerDownPeripherals();
    goToDeepSleep();
  }

  Serial.println("GPRS připojeno a IP získána.");

  // Sestavení JSON datového řetězce
  String postData = "{";
  postData += "\"device\":\"" + String(deviceId) + "\"";
  postData += ",\"latitude\":" + String(latitude, 6); // 6 desetinných míst
  postData += ",\"longitude\":" + String(longitude, 6);
  postData += ",\"speed\":" + String(gpsSpeed, 2);
  postData += ",\"altitude\":" + String(gpsAltitude, 2);
  postData += ",\"accuracy\":" + String(gpsHdop, 2); // Používáme HDOP jako přesnost
  postData += ",\"satellites\":" + String(numSats);
  postData += "}";

  Serial.println("Odesílám data: " + postData);

  // Odeslání dat přes HTTP POST
  if (gsm_http_post(serverUrl, postData)) {
      Serial.println("Data úspěšně odeslána.");
  } else {
      Serial.println("Odeslání dat selhalo.");
  }

  // Deaktivace GPRS po odeslání
  Serial.println("Deaktivuji GPRS...");
  sendATCommand("AT+SAPBR=0,1", "OK", 5000);

  // Vypnutí periferií a přechod do spánku
  powerDownPeripherals();
  goToDeepSleep();
}

void loop() {
  // Zde nic není, protože vše běží v setup() a končí deep sleep.
}