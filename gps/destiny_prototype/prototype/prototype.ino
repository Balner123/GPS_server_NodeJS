#define TINY_GSM_MODEM_SIM800

#include <Arduino.h>
#include <TinyGsmClient.h>
#include <TinyGPS++.h>

// Piny pro GPS modul (UART2)
#define GPS_TX 14
#define GPS_RX 27
#define GPS_POWER_PIN 25  // Pin pro nap?jen? GPS modulu
#define SATTELITES_NEEDED 5
#define GPRS_TRIES_COUNT 3

// Piny pro SIM800L (UART1)
#define SIM800_TX 26
#define SIM800_RX 27
#define SIM800_PWRKEY 4
#define SIM800_RST 5
#define SIM800_POWER 23

// Nastaven? APN a serveru
const char apn[] = "internet.t-mobile.cz";
const char* url = "http://129.151.193.104:5000/device_input";
int device = 200;

// Inicializace s?riov?ch port?
HardwareSerial SerialGPS(2);  // GPS na UART2
HardwareSerial SerialAT(1);   // SIM800L na UART1
TinyGsm modem(SerialAT);
TinyGPSPlus gps; // Objekt pro pr?ci s GPS

float latitude = 0.0;
float longitude = 0.0;
int numSats = 0;  // Po?et satelit?

// Definice ?asov?ho intervalu pro deep sleep
#define HOURS 0
#define MINUTES 1
#define SECONDS 0


// Funkce pro p?epo?et ?asu na mikrosekundy
unsigned long convertToMicroseconds(int hours, int minutes, int seconds) {
  return (hours * 3600 + minutes * 60 + seconds) * 1000000L;
}

// P?epo??t?n? ?asu na mikrosekundy
unsigned long deepSleepTime = convertToMicroseconds(HOURS, MINUTES, SECONDS);

void setup() {
  Serial.begin(115200);
  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX, GPS_RX); // Nastaven? GPS s?riov?ho portu
  SerialAT.begin(9600, SERIAL_8N1, SIM800_TX, SIM800_RX); // Nastaven? SIM800L
  pinMode(GPS_POWER_PIN, OUTPUT); // Nastaven? pinu pro nap?jen? GPS
  pinMode(SIM800_POWER, OUTPUT);

  // Zapnut? GPS modulu
  digitalWrite(GPS_POWER_PIN, HIGH);  
  delay(2000);  // Kr?tk? pauza pro stabilizaci GPS modulu

  Serial.println("èekám na platn? GPS sou?adnice...");
  
  // ?ek?me na GPS fix s po?adavkem na alespo? 7 satelit?
  while (true) {
    while (SerialGPS.available()) {
      gps.encode(SerialGPS.read()); // Zpracov?n? ka?d?ho znaku z GPS dat
    }

    // Kontrola, zda m?me platn? fix a dostate?n? po?et satelit?
    if (gps.location.isUpdated() && gps.satellites.value() >= SATTELITES_NEEDED) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
      numSats = gps.satellites.value();
      
      Serial.print("Sou?adnice: ");
      Serial.print(latitude, 6);
      Serial.print(", ");
      Serial.println(longitude, 6);
      Serial.print("Po?et satelit?: ");
      Serial.println(numSats);
      
      break;  // Konec ?ek?n? na GPS fix
    } else {
      // Pokud nen? dostatek satelit?, zobraz?me upozorn?n? a ?ek?me d?l
      Serial.println("Nedostate?n? po?et satelit?, ?ek?m...");
      Serial.print("Po?et satelit?: ");
      Serial.println(gps.satellites.value());

    }

    delay(2500); // Chv?li ?ek?me p?ed dal??m pokusem
  }

  Serial.println("Dostate?n? po?et satelit? pro GPS fix!");

  // Vypneme GPS modul po z?sk?n? sou?adnic
  digitalWrite(GPS_POWER_PIN, LOW);  // Vypnut? GPS modulu
  Serial.println("GPS modul vypnut.");

  // Zapnut? nap?jen? SIM800L
  digitalWrite(SIM800_POWER, HIGH);
  delay(3000); // ?ek?n? na zapnut? SIM800L

  Serial.println("Startuji modem...");
  modem.restart();
  delay(3000);

 Serial.print("P?ipojuji se k GPRS...");
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
    delay(5000);  // Po?kej 5 sekund p?ed dal??m pokusem
}

if (!connected) {
    Serial.println("P?ipojen? selhalo,p?ech?z?m do hlubok?ho sp?nku.");
    modem.poweroff();  // Vypni modem
    digitalWrite(SIM800_POWER, LOW);
    esp_sleep_enable_timer_wakeup(deepSleepTime);
    esp_deep_sleep_start();
}

Serial.println("P?ipojeno!");

  // Data ve form?tu JSON
  String postData = "{\"latitude\":" + String(latitude, 6) +
                    ",\"longitude\":" + String(longitude, 6) +
                    ",\"device\":" + String(device) + "}";

  Serial.println("Odes?l?m data: " + postData);
  
  // Odesl?n? HTTP POST (AT p??kazy)
  if (gsm_http_post(url, postData)) {
    Serial.println("HTTP POST byl ?sp?n?.");
  } else {
    Serial.println("HTTP POST selhal.");
  }
  
  //odpojen? a vypnut? SIM800l
  modem.gprsDisconnect();
  delay(1000);  // Po?kej na odpojen?
  modem.poweroff();
  digitalWrite(SIM800_POWER, LOW);

  

  // Timer Wakeup pro deep sleep
  Serial.println("Data byla odesl?na, p?ech?z?m do hlubok?ho sp?nku.");
  esp_sleep_enable_timer_wakeup(deepSleepTime);  // Nastaven? wakeup timeru
  delay(2000);
  esp_deep_sleep_start();  // P?ej?t do hlubok?ho sp?nku
}

void loop() {
  // ESP32 p?ejde do hlubok?ho sp?nku, tak?e loop nen? pot?eba.
}

// Pomocn? funkce pro odesl?n? AT p??kazu a ?ek?n? na odpov??
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
    delay(10);  // P?edej?t zbyte?n?mu zat?en? CPU
}

  Serial.print("Timeout/Error, response: ");
  Serial.println(response);
  return false;
}

// Odes?l?n? HTTP POST p?es AT p??kazy
bool gsm_http_post(String url, String postData) {
  Serial.println("----- HTTP POST Start -----");
  
  if (!sendAT("AT+HTTPINIT", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CID\",1", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK")) return false;
  
  String httpDataCmd = "AT+HTTPDATA=" + String(postData.length()) + ",10000";
  if (!sendAT(httpDataCmd, "DOWNLOAD")) return false;
  
  // Odesl?n? t?la POST po?adavku
  SerialAT.print(postData);
  delay(2000);
  
  if (!sendAT("AT+HTTPACTION=1", "OK")) return false;
  delay(6000);  // ?ek?me na dokon?en? akce
  
  if (!sendAT("AT+HTTPREAD", "OK")) return false;
  
  // Ukon?en? HTTP session
  sendAT("AT+HTTPTERM", "OK");
  
  Serial.println("----- HTTP POST End -----");
  return true;
}

