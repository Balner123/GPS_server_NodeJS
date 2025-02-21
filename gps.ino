#define TINY_GSM_MODEM_SIM800

#include <Arduino.h>
#include <TinyGsmClient.h>
#include <TinyGPS++.h>

// Piny pro GPS modul (UART2)
#define GPS_TX 14
#define GPS_RX 27
#define GPS_POWER_PIN 25  // Pin pro napájení GPS modulu
#define SATTELITES_NEEDED 15
#define GPRS_TRIES_COUNT 3

// Piny pro SIM800L (UART1)
#define SIM800_TX 26
#define SIM800_RX 27
#define SIM800_PWRKEY 4
#define SIM800_RST 5
#define SIM800_POWER 23

// Nastavení APN a serveru
const char apn[] = "internet.t-mobile.cz";
const char* url = "http://129.151.193.104:5000/device_input";
int device = 200;

// Inicializace sériových portů
HardwareSerial SerialGPS(2);  // GPS na UART2
HardwareSerial SerialAT(1);   // SIM800L na UART1
TinyGsm modem(SerialAT);
TinyGPSPlus gps; // Objekt pro práci s GPS

float latitude = 0.0;
float longitude = 0.0;
int numSats = 0;  // Počet satelitů

// Definice časového intervalu pro deep sleep
#define HOURS 0
#define MINUTES 1
#define SECONDS 0


// Funkce pro přepočet času na mikrosekundy
unsigned long convertToMicroseconds(int hours, int minutes, int seconds) {
  return (hours * 3600 + minutes * 60 + seconds) * 1000000L;
}

// Přepočítání času na mikrosekundy
unsigned long deepSleepTime = convertToMicroseconds(HOURS, MINUTES, SECONDS);

void setup() {
  Serial.begin(115200);
  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX, GPS_RX); // Nastavení GPS sériového portu
  SerialAT.begin(9600, SERIAL_8N1, SIM800_TX, SIM800_RX); // Nastavení SIM800L
  pinMode(GPS_POWER_PIN, OUTPUT); // Nastavení pinu pro napájení GPS
  pinMode(SIM800_POWER, OUTPUT);

  // Zapnutí GPS modulu
  digitalWrite(GPS_POWER_PIN, HIGH);  
  delay(2000);  // Krátká pauza pro stabilizaci GPS modulu

  Serial.println("Čekám na platné GPS souřadnice...");
  
  // Čekáme na GPS fix s požadavkem na alespoň 7 satelitů
  while (true) {
    while (SerialGPS.available()) {
      gps.encode(SerialGPS.read()); // Zpracování každého znaku z GPS dat
    }

    // Kontrola, zda máme platný fix a dostatečný počet satelitů
    if (gps.location.isUpdated() && gps.satellites.value() >= SATTELITES_NEEDED) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
      numSats = gps.satellites.value();
      
      Serial.print("Souřadnice: ");
      Serial.print(latitude, 6);
      Serial.print(", ");
      Serial.println(longitude, 6);
      Serial.print("Počet satelitů: ");
      Serial.println(numSats);
      
      break;  // Konec čekání na GPS fix
    } else {
      // Pokud není dostatek satelitů, zobrazíme upozornění a čekáme dál
      Serial.println("Nedostatečný počet satelitů, čekám...");
      Serial.print("Počet satelitů: ");
      Serial.println(gps.satellites.value());

    }

    delay(2500); // Chvíli čekáme před dalším pokusem
  }

  Serial.println("Dostatečný počet satelitů pro GPS fix!");

  // Vypneme GPS modul po získání souřadnic
  digitalWrite(GPS_POWER_PIN, LOW);  // Vypnutí GPS modulu
  Serial.println("GPS modul vypnut.");

  // Zapnutí napájení SIM800L
  digitalWrite(SIM800_POWER, HIGH);
  delay(3000); // Čekání na zapnutí SIM800L

  Serial.println("Startuji modem...");
  modem.restart();
  delay(3000);

 Serial.print("Připojuji se k GPRS...");
int attempt = 0;
bool connected = false;

while (attempt < GPRS_TRIES_COUNT ) {
    if (modem.gprsConnect(apn, "", "")) {
        connected = true;
        break;
    }
    Serial.print("Pokus ");
    Serial.print(attempt + 1);
    Serial.println(" selhal, opakuji...");
    attempt++;
    delay(5000);  // Počkej 5 sekund před dalším pokusem
}

if (!connected) {
    Serial.println("Připojení selhalo,přecházím do hlubokého spánku.");
    modem.poweroff();  // Vypni modem
    digitalWrite(SIM800_POWER, LOW);
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
}

Serial.println("Připojeno!");

  // Data ve formátu JSON
  String postData = "{\"latitude\":" + String(latitude, 6) +
                    ",\"longitude\":" + String(longitude, 6) +
                    ",\"device\":" + String(device) + "}";

  Serial.println("Odesílám data: " + postData);
  
  // Odeslání HTTP POST (AT příkazy)
  if (gsm_http_post(url, postData)) {
    Serial.println("HTTP POST byl úspěšný.");
  } else {
    Serial.println("HTTP POST selhal.");
  }
  
  //odpojení a vypnutí SIM800l
  modem.gprsDisconnect();
  delay(1000);  // Počkej na odpojení
  modem.poweroff();
  digitalWrite(SIM800_POWER, LOW);

  

  // Timer Wakeup pro deep sleep
  Serial.println("Data byla odeslána, přecházím do hlubokého spánku.");
  esp_sleep_enable_timer_wakeup(deepSleepTime);  // Nastavení wakeup timeru
  delay(2000);
  esp_deep_sleep_start();  // Přejít do hlubokého spánku
}

void loop() {
  // ESP32 přejde do hlubokého spánku, takže loop není potřeba.
}

// Pomocná funkce pro odeslání AT příkazu a čekání na odpověď
bool sendAT(const String &command, const String &expected, unsigned long timeout = 5000) {
  Serial.print("Send ->: ");
  Serial.println(command);
  SerialAT.println(command);
  
  unsigned long start = millis();
  String response;
while (millis() - start < timeout) {
    while (SerialAT.available()) {
        response += (char)SerialAT.read();
    }
    if (response.indexOf(expected) != -1) {
        Serial.print("Response: ");
        Serial.println(response);
        return true;
    }
    delay(10);  // Předejít zbytečnému zatížení CPU
}

  Serial.print("Timeout/Error, response: ");
  Serial.println(response);
  return false;
}

// Odesílání HTTP POST přes AT příkazy
bool gsm_http_post(String url, String postData) {
  Serial.println("----- HTTP POST Start -----");
  
  if (!sendAT("AT+HTTPINIT", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CID\",1", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK")) return false;
  
  String httpDataCmd = "AT+HTTPDATA=" + String(postData.length()) + ",10000";
  if (!sendAT(httpDataCmd, "DOWNLOAD")) return false;
  
  // Odeslání těla POST požadavku
  SerialAT.print(postData);
  delay(2000);
  
  if (!sendAT("AT+HTTPACTION=1", "OK")) return false;
  delay(6000);  // Čekáme na dokončení akce
  
  if (!sendAT("AT+HTTPREAD", "OK")) return false;
  
  // Ukončení HTTP session
  sendAT("AT+HTTPTERM", "OK");
  
  Serial.println("----- HTTP POST End -----");
  return true;
}

