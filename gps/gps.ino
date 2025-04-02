// Definice typu modemu pro TinyGSM
#define TINY_GSM_MODEM_SIM800

// Zahrnutí potřebných knihoven
#include <Arduino.h>
#include <TinyGsmClient.h> // Pro GPRS/HTTP klienta
#include <TinyGPS++.h>     // Pro zpracování GPS dat

// --- Definice Pinů ---
// UPOZORNĚNÍ: GPS_RX a SIM800_RX jsou oba přiřazeny pinu 27.
// Toto velmi pravděpodobně způsobí problémy v komunikaci. Ověřte správné piny pro vaši desku.
// Piny GPS modulu (UART2)
#define GPS_TX 14
#define GPS_RX 27 // Možný konflikt se SIM800_RX
#define GPS_POWER_PIN 25 // Pin pro ovládání napájení GPS modulu

// Piny SIM800L modulu (UART1)
#define SIM800_TX 26
#define SIM800_RX 27 // Možný konflikt s GPS_RX
#define SIM800_PWRKEY 4 // Pin Power key (definovaný, ale explicitně se v této logice nepoužívá)
#define SIM800_RST 5    // Pin Reset (definovaný, ale explicitně se v této logice nepoužívá)
#define SIM800_POWER 23 // Pin pro ovládání napájení SIM800L modulu (VCC)

// --- Konfigurace ---
// Nastavení GPS
#define SATELLITES_NEEDED 5 // Snížený požadavek pro rychlejší/spolehlivější fix (upravte dle potřeby)

// Nastavení GPRS
const char apn[] = "internet.t-mobile.cz"; // Vaše APN
const char gprsUser[] = ""; // GPRS uživatel (pokud je vyžadováno)
const char gprsPass[] = ""; // GPRS heslo (pokud je vyžadováno)
#define GPRS_TRIES_COUNT 3 // Počet pokusů o připojení k GPRS

// Nastavení Serveru
const char server[] = "129.151.193.104"; // Adresa serveru (bez http://)
const int ports[] = {80, 443, 5000};     // Možné porty
const int numPorts = 3;                  // Počet portů
const char resource[] = "/device_input"; // Cesta na serveru (endpoint)
int device = 450;                        // ID zařízení

// Nastavení HTTP retry
#define HTTP_RETRY_COUNT 3
#define HTTP_RETRY_DELAY 5000

// Nastavení Deep Sleep
#define HOURS 0
#define MINUTES 1
#define SECONDS 0

// --- Globální Proměnné ---
// Sériové porty
HardwareSerial SerialGPS(2); // GPS na UART2
HardwareSerial SerialAT(1);  // SIM800L na UART1

// Instance modemu TinyGSM
TinyGsm modem(SerialAT);

// Instance TinyGSM klienta pro HTTP
TinyGsmClient client(modem);

// Instance TinyGPS++
TinyGPSPlus gps;

// GPS Data
float latitude = 0.0;
float longitude = 0.0;
int numSats = 0;

// Funkce pro převod času na mikrosekundy pro deep sleep
unsigned long convertToMicroseconds(int hours, int minutes, int seconds) {
  return (unsigned long)(hours * 3600 + minutes * 60 + seconds) * 1000000L;
}

// Výpočet času pro deep sleep
unsigned long deepSleepTime = convertToMicroseconds(HOURS, MINUTES, SECONDS);

// --- Funkce setup() (spustí se jednou po startu/probuzení) ---
void setup() {
  // Inicializace sériového monitoru
  Serial.begin(115200);
  Serial.println("--- Startuji zařízení ---");

  // Inicializace sériových portů pro moduly
  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX, GPS_RX); // GPS UART
  SerialAT.begin(9600, SERIAL_8N1, SIM800_TX, SIM800_RX); // SIM800L UART

  // Konfigurace pinů pro ovládání napájení
  pinMode(GPS_POWER_PIN, OUTPUT);
  pinMode(SIM800_POWER, OUTPUT);

  // --- Získání GPS pozice ---
  Serial.println("Zapínám GPS modul...");
  digitalWrite(GPS_POWER_PIN, HIGH);
  delay(1000); // Pauza pro stabilizaci napájení GPS

  Serial.println("Čekám na GPS fix...");
  unsigned long gpsStartTime = millis();
  bool gpsFixed = false;

  // Timeout pro získání GPS fixu (např. 5 minut)
  while (millis() - gpsStartTime < 300000) {
    // Zpracování dat z GPS modulu
    while (SerialGPS.available() > 0) {
      if (gps.encode(SerialGPS.read())) {
        // Kontrola, zda máme aktuální polohu a dostatek satelitů
        if (gps.location.isUpdated() && gps.satellites.isValid() && gps.satellites.value() >= SATELLITES_NEEDED) {
          latitude = gps.location.lat();
          longitude = gps.location.lng();
          numSats = gps.satellites.value();

          Serial.print("GPS Fix získán: ");
          Serial.print(latitude, 6);
          Serial.print(", ");
          Serial.println(longitude, 6);
          Serial.print("Satelity: ");
          Serial.println(numSats);

          gpsFixed = true;
          break; // Ukončení vnitřní smyčky while
        }
      }
    } // konec while SerialGPS.available()

    if (gpsFixed) {
      break; // Ukončení vnější smyčky while (timeout smyčky)
    }

    // Periodický výpis stavu, pokud ještě není fix
    if (millis() % 5000 == 0) { // Vypisovat každých 5 sekund
        Serial.print("Čekám na fix... Satelity: ");
        if (gps.satellites.isValid()) {
            Serial.println(gps.satellites.value());
        } else {
            Serial.println(" (N/A)");
        }
    }
     delay(10); // Krátká pauza, aby se zabránilo zahlcení CPU
  } // konec while čekání na GPS fix

  // Vypnutí GPS modulu (ať už byl fix úspěšný nebo ne, pro úsporu energie)
  Serial.println("Vypínám GPS modul.");
  digitalWrite(GPS_POWER_PIN, LOW);

  // Kontrola, zda byl GPS fix úspěšný
  if (!gpsFixed) {
    Serial.println("Nepodařilo se získat GPS fix v časovém limitu. Přecházím do hlubokého spánku.");
    // Volitelně: Odeslat stav indikující chybu GPS? Prozatím jen spánek.
    digitalWrite(SIM800_POWER, LOW); // Zajistit, že i SIM modul je vypnutý
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
    return; // Sem by se kód neměl dostat
  }

  // --- GPRS a HTTP Komunikace ---
  Serial.println("Zapínám SIM800L modul...");
  digitalWrite(SIM800_POWER, HIGH);
  delay(3000); // Počkat na naběhnutí SIM800L

  Serial.println("Inicializuji modem...");
  // modem.restart(); // Zvážit, zda je potřeba, závisí na stavu po zapnutí
  if (!modem.init()) {
      Serial.println("Nepodařilo se inicializovat modem. Přecházím do hlubokého spánku.");
      digitalWrite(SIM800_POWER, LOW);
      esp_sleep_enable_timer_wakeup(deepSleepTime);
      esp_deep_sleep_start();
      return;
  }
  Serial.println("Modem inicializován.");

  Serial.print("Čekám na síť...");
  if (!modem.waitForNetwork()) {
    Serial.println(" Síť nedostupná. Přecházím do hlubokého spánku.");
    modem.poweroff();
    digitalWrite(SIM800_POWER, LOW);
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
    return;
  }
  Serial.println(" Síť OK.");

  Serial.print("Připojuji se k GPRS: ");
  Serial.println(apn);
  bool gprsConnected = false;
  for (int i = 0; i < GPRS_TRIES_COUNT; ++i) {
    if (modem.gprsConnect(apn, gprsUser, gprsPass)) {
      gprsConnected = true;
      Serial.println("GPRS Připojeno.");
      break;
    }
    Serial.print("Pokus o GPRS připojení ");
    Serial.print(i + 1);
    Serial.println(" selhal. Opakuji...");
    delay(5000); // Počkat před dalším pokusem
  }

  if (!gprsConnected) {
    Serial.println("Připojení GPRS selhalo po více pokusech. Přecházím do hlubokého spánku.");
    modem.poweroff();
    digitalWrite(SIM800_POWER, LOW);
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
    return;
  }

  // Příprava JSON dat
  float hdop = gps.hdop.value();
  // Normalizace HDOP na rozsah 0-100 (HDOP je obvykle 0-10, takže vynásobíme 10)
  float normalizedAccuracy = min(hdop * 10.0, 100.0);
  
  String postData = "{\"latitude\":" + String(latitude, 6) +
                    ",\"longitude\":" + String(longitude, 6) +
                    ",\"device\":\"" + String(device) + "\"" +
                    ",\"speed\":" + String(gps.speed.kmph(), 2) +
                    ",\"altitude\":" + String(gps.altitude.meters(), 2) +
                    ",\"accuracy\":" + String(normalizedAccuracy, 2) +
                    ",\"satellites\":" + String(gps.satellites.value()) + "}";

  Serial.println("Provádím HTTP POST...");
  Serial.print("Server: "); Serial.println(server);
  Serial.print("Resource: "); Serial.println(resource);
  Serial.print("Data: "); Serial.println(postData);

  // Provedení HTTP POST požadavku
  int httpStatus = 0; // Pro uložení HTTP stavového kódu odpovědi
  bool postSuccess = false;
  int retryCount = 0;
  int portIndex = 0;

  while (retryCount < HTTP_RETRY_COUNT && !postSuccess && portIndex < numPorts) {
    int currentPort = ports[portIndex];
    Serial.print("Připojování k "); Serial.print(server); Serial.print(":"); Serial.println(currentPort);
    
    // Kontrola dostupnosti serveru před odesláním
    if (!client.connect(server, currentPort)) {
      Serial.println("Nepodařilo se připojit k serveru pro POST.");
      portIndex++;
      if (portIndex < numPorts) {
        Serial.print("Zkouším další port... ");
        Serial.println(currentPort);
        delay(HTTP_RETRY_DELAY);
        continue;
      }
      retryCount++;
      if (retryCount < HTTP_RETRY_COUNT) {
        portIndex = 0; // Začít znovu s prvním portem
        Serial.print("Pokus ");
        Serial.print(retryCount + 1);
        Serial.print(" z ");
        Serial.println(HTTP_RETRY_COUNT);
        delay(HTTP_RETRY_DELAY);
        continue;
      }
    }

    Serial.println("Připojeno k serveru pro POST.");
    
    // Odeslání HTTP POST hlaviček
    client.print(String("POST ") + resource + " HTTP/1.0\r\n");  // Změna na HTTP/1.0
    client.print(String("Host: ") + server + "\r\n");
    client.print("User-Agent: ESP32-GPS-Tracker\r\n");
    client.print("Accept: application/json\r\n");
    client.print("Content-Type: application/json\r\n");
    client.print(String("Content-Length: ") + postData.length() + "\r\n");
    client.print("Connection: close\r\n");
    client.print("\r\n");

    // Odeslání těla HTTP POST požadavku
    client.print(postData);
    Serial.println("Požadavek odeslán, čekám na odpověď...");

    // Čekání na odpověď serveru (s timeoutem)
    unsigned long httpTimeoutStart = millis();
    String responseBody = "";
    String currentLine = "";
    bool headersComplete = false;
    bool responseReceived = false;
    
    while (client.connected() && millis() - httpTimeoutStart < 30000L) {
      if (client.available()) {
        char c = client.read();
        
        if (c == '\n') {
          if (currentLine.length() == 0) {
            headersComplete = true;
          } else if (headersComplete) {
            responseBody += currentLine;
            responseReceived = true;
          }
          currentLine = "";
        } else if (c == '\r') {
          // Ignorovat CR
        } else {
          currentLine += c;
        }
      }
      
      if (responseReceived) {
        break;
      }
      
      delay(10);
    }

    // Kontrola, zda jsme dostali odpověď
    if (responseReceived) {
      Serial.print("Dostali jsme odpověď: ");
      Serial.println(responseBody);
      
      // Získání HTTP stavového kódu z odpovědi
      if (responseBody.startsWith("HTTP/1.")) {
        int firstSpace = responseBody.indexOf(' ');
        int secondSpace = responseBody.indexOf(' ', firstSpace + 1);
        if (firstSpace != -1 && secondSpace != -1) {
          httpStatus = responseBody.substring(firstSpace + 1, secondSpace).toInt();
          Serial.print("HTTP Status: ");
          Serial.println(httpStatus);
        }
      }

      // Kontrola úspěšnosti
      if (httpStatus >= 200 && httpStatus < 300) {
        Serial.println("HTTP POST úspěšný (Status kód 2xx).");
        postSuccess = true;
        
        // Zpracování sleep_interval
        int sleepIntervalStart = responseBody.indexOf("\"sleep_interval\":");
        if (sleepIntervalStart != -1) {
          sleepIntervalStart += 16;
          int sleepIntervalEnd = responseBody.indexOf(",", sleepIntervalStart);
          if (sleepIntervalEnd == -1) {
            sleepIntervalEnd = responseBody.indexOf("}", sleepIntervalStart);
          }
          if (sleepIntervalEnd != -1) {
            String sleepIntervalStr = responseBody.substring(sleepIntervalStart, sleepIntervalEnd);
            int newSleepInterval = sleepIntervalStr.toInt();
            if (newSleepInterval > 0) {
              deepSleepTime = convertToMicroseconds(0, newSleepInterval, 0);
              Serial.print("Nový sleep interval: ");
              Serial.println(newSleepInterval);
            }
          }
        }
      } else {
        Serial.print("HTTP POST selhal se Status kódem: ");
        Serial.println(httpStatus);
        retryCount++;
        if (retryCount < HTTP_RETRY_COUNT) {
          Serial.print("Pokus ");
          Serial.print(retryCount + 1);
          Serial.print(" z ");
          Serial.println(HTTP_RETRY_COUNT);
          delay(HTTP_RETRY_DELAY);
        }
      }
    } else {
      Serial.println("Nepodařilo se získat odpověď od serveru (vypršel časový limit).");
      retryCount++;
      if (retryCount < HTTP_RETRY_COUNT) {
        Serial.print("Pokus ");
        Serial.print(retryCount + 1);
        Serial.print(" z ");
        Serial.println(HTTP_RETRY_COUNT);
        delay(HTTP_RETRY_DELAY);
      }
    }

    // Ujistit se, že je spojení uzavřeno
    if (client.connected()) {
      client.stop();
      Serial.println("Spojení se serverem uzavřeno.");
    }
  }

  if (!postSuccess) {
      Serial.println("Všechny pokusy o odeslání dat selhaly.");
  }

  // --- Úklid a Spánek ---
  Serial.println("Odpojuji GPRS...");
  modem.gprsDisconnect();
  Serial.println("GPRS Odpojeno.");

  Serial.println("Vypínám SIM800L modul...");
  modem.poweroff(); // Pokusí se korektně vypnout modem
  digitalWrite(SIM800_POWER, LOW); // Vypnutí napájení modulu
  Serial.println("SIM800L modul vypnut.");

  Serial.println("Přecházím do hlubokého spánku...");
  Serial.flush(); // Zajistit odeslání všech sériových zpráv před usnutím
  esp_sleep_enable_timer_wakeup(deepSleepTime); // Nastavení časovače probuzení
  esp_deep_sleep_start(); // Uspání ESP32
}

// --- Funkce loop() (nepoužívá se kvůli deep sleep) ---
void loop() {
  // Zde nic není, vše obstarává setup() a poté následuje spánek.
}