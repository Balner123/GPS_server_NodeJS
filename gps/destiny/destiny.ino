#include <Arduino.h>
#include <TinyGsmClient.h>
#include <TinyGPS++.h>

// GPIOs
#define GPS_POWER_PIN     25
#define SIM800_POWER_PIN  23    // VCC enable for SIM800L in your schematic
#define SIM800L_PWRKEY    4     // if available (else ignore or tie GND)

// Separate UART pins for each device
#define GPS_RX_PIN        27
#define GPS_TX_PIN        14
#define SIM_RX_PIN        27
#define SIM_TX_PIN        26

// ------- Config --------
const char* DEVICE_ID  = "880";
String url      = "http://129.151.193.104:5000/device_input";  // API endpoint
String apn             = "internet.t-mobile.cz";

#define GPS_BAUD_RATE    9600
#define GPRS_BAUD_RATE   9600

#define GPSTIMEOUT_MS    (5UL * 60UL * 1000UL)   // 5 minutes max wait
#define MIN_SATS         5
#define GPRS_RETRY_COUNT 3

uint32_t default_sleep_seconds = 300;
uint32_t sleep_seconds = 300;   // updated after each POST

// GPS object
HardwareSerial SerialGPS(2);
TinyGPSPlus gps;

//AT
HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);

// ---- AT Commands ----
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

bool acquireGPS(double &lat, double &lon, double &spd, double &alt, int &sats, double &hdop) {
  unsigned long start = millis();
  unsigned long lastMsg = 0;
  bool fixFound = false;
  
  while(millis()-start < GPSTIMEOUT_MS){
    while(SerialGPS.available()){ gps.encode(SerialGPS.read()); }

    if(gps.location.isValid() && gps.location.isUpdated() && 
       gps.satellites.isValid() && gps.satellites.value() >= MIN_SATS){

        lat = gps.location.lat();
        lon = gps.location.lng();
        spd = gps.speed.kmph();
        alt = gps.altitude.meters();
        sats= gps.satellites.value();
        hdop= gps.hdop.isValid() ? gps.hdop.hdop() : -1;
        fixFound = true;
        break;
    }
    if(millis()-lastMsg > 5000){
      lastMsg=millis();
      Serial.printf("Waiting GPS: sats %d, valid %d, updated %d\n",
        gps.satellites.isValid()?gps.satellites.value():0,
        gps.location.isValid(),
        gps.location.isUpdated());
    }
    delay(30);
  }
  return fixFound;
}

bool postData(String url, String postData) {
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
// ---- Sleep ----
void deepSleepSeconds(uint32_t seconds){
  uint64_t us = (uint64_t)seconds * 1000000ULL;
  Serial.println("Entering deep sleep...");
  Serial.flush();
  delay(100);
  esp_sleep_enable_timer_wakeup(us);
  esp_deep_sleep_start();
}


void setup() {

  Serial.begin(115200);
  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX_PIN, GPS_RX_PIN); // Nastaven? GPS s?riov?ho portu
  SerialAT.begin(9600, SERIAL_8N1, SIM_TX_PIN, SIM_RX_PIN); // Nastaven? SIM800L

  Serial.println("=== GPS + GSM Tracker Start ===");

  pinMode(GPS_POWER_PIN, OUTPUT); // Nastaven? pinu pro nap?jen? GPS
  pinMode(SIM800_POWER_PIN, OUTPUT);

  // GPS
  //------------------------------------------------------
  digitalWrite(GPS_POWER_PIN, HIGH);  

  delay(2000);  // Kr?tk? pauza pro stabilizaci GPS modulu
  
  double lat=0, lon=0, spd=0, alt=0, hdop=0;
  int sats=0;

  //------------------------------
  Serial.println("[1] GPS Acquire");
 
  bool gotFix = acquireGPS(lat, lon, spd, alt, sats, hdop);


  if(gotFix){
    Serial.printf("GPS Fix: %.6f, %.6f, Speed %.2f, Alt %.2f, sats %d, HDOP %.2f\n", lat, lon, spd, alt, sats, hdop);
  } else {
    Serial.println("NO GPS fix, reporting zeros.");
    lat=lon=spd=alt=hdop=0; sats=0;
  }

  digitalWrite(GPS_POWER_PIN, LOW);  // Vypnut? GPS modulu
  Serial.println("GPS modul vypnut.");
  //-----------------------------------------------
  // GPRS
  //-------------------------------------------------------
  Serial.println("[2] GPRS Connection");

  digitalWrite(SIM800_POWER_PIN, HIGH);
  delay(3000);

  Serial.println("Startuji modem...");
  modem.restart();
  delay(3000);

 Serial.print("Připojuji se k GPRS...");
int attempt = 0;
bool connected = false;

while (attempt < GPRS_RETRY_COUNT ) {
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
    Serial.println(" ERROR: Připojení selhalo, DEEP_SLEEP_MODE");
    modem.poweroff();  // Vypni modem
    digitalWrite(SIM800_POWER_PIN, LOW);

    deepSleepSeconds(sleep_seconds);
}

Serial.println(" SUCCESS: Připojeno!");

  // Data ve form?tu JSON
  String postData = "{\"latitude\":" + String(lat, 6) +
                    ",\"longitude\":" + String(lon, 6) +
                    ",\"device\":" + String(DEVICE_ID) + 
                    ",\"speed\":" + String(spd, 2) +
                    ",\"altitude\":" + String(alt, 2) +
                    ",\"accuracy\":" + String(hdop, 2) +
                    ",\"satellites\":" + String(sats) + "}";

  Serial.println("Odesílám data: " + postData);
  
  // Odesl?n? HTTP POST (AT p??kazy)
  if (postData(url, postData)) {
    Serial.println("HTTP POST byl ?sp?n?.");
  } else {
    Serial.println("HTTP POST selhal.");
  }
  
  modem.gprsDisconnect();
  delay(1000);
  modem.poweroff();
  digitalWrite(SIM800_POWER_PIN, LOW);

  //--------------------------------------------------
  // Timer Wakeup pro deep sleep
  Serial.println("DEEP_SLEEP_MODE");
  deepSleepSeconds(sleep_seconds);
}


