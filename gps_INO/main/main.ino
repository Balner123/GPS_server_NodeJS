#include <Arduino.h>
#define TINY_GSM_MODEM_SIM800
#include <TinyGsmClient.h>
#include <ArduinoJson.h>
#include "esp_sleep.h"
#include <TinyGPS++.h>
#include <SoftwareSerial.h>

#define GPS_RX_PIN   32
#define GPS_TX_PIN   33
#define GPS_POWER_PIN 25

#define SAT_THRESHOLD 3

SoftwareSerial SerialGPS(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

#define SerialAT Serial2

#define SIM800L_RX     27
#define SIM800L_TX     26
#define SIM800L_PWRKEY 4
#define SIM800L_RST    5
#define SIM800L_POWER  23

#define DEFAULT_SLEEP_SECONDS 60
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

TinyGsm modem(SerialAT);
TinyGsmClient client(modem);

const char apn[]      = "internet.t-mobile.cz";
const char gprsUser[] = "gprs";
const char gprsPass[] = "gprs";

const char server[]       = "129.151.193.104";
const int  port           = 5000;
const char resourcePost[] = "/device_input";

const char* deviceName = "NEO-6M";

  double lat;
  double lon;
  int sats;
  double spd;
  double alt;
  double hdop;

const unsigned long timeoutGPS = 5; // minutes

// --- FUNCTION PROTOTYPES ---
void powerUpGPS() {
  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH);
  Serial.println("Powering GPS module ON...");
  delay(1000);
}

void powerDownGPS() {
  digitalWrite(GPS_POWER_PIN, LOW);
  Serial.println("GPS module powered OFF.");
}

void initGPSSerial() {
  SerialGPS.begin(9600);
}

void closeGPSSerial() {
  SerialGPS.end();
}

void displayGPSInfo() {
  lat = gps.location.lat();
  lon = gps.location.lng();
  sats = gps.satellites.value();
  spd = gps.speed.kmph();
  alt = gps.altitude.meters();
  hdop = gps.hdop.isValid() ? gps.hdop.value() / 100.0 : -1.0;

  Serial.println("\n*** GPS FIX OBTAINED ***");
  Serial.printf("Lat: %.6f  Lon: %.6f\n", lat, lon);
  Serial.printf("Speed: %.2f km/h  Altitude: %.2f m\n", spd, alt);
  Serial.printf("Satellites: %d  HDOP: %.2f\n", sats, hdop);
}

bool waitForGPSFix(unsigned long timeout) {
  unsigned long tStart = millis();
  unsigned long lastPrint = 0;
  bool gotFix = false;

  while (millis() - tStart < timeout) {
    while (SerialGPS.available() > 0) {
      if (gps.encode(SerialGPS.read())) {
        if (gps.location.isUpdated() && gps.location.isValid() &&
            gps.satellites.isValid() && (gps.satellites.value() >= SAT_THRESHOLD)) {
          displayGPSInfo();
          gotFix = true;
          break;
        }
      }
    }

    if (gotFix) {
      break;
    }

    if (millis() - lastPrint >= 5000) {
      lastPrint = millis();
      Serial.print("Waiting... Sat: ");
      Serial.print(gps.satellites.isValid() ? gps.satellites.value() : 0);
      Serial.print(", Valid Pos: "); Serial.print(gps.location.isValid());
      Serial.print(", Updated: "); Serial.println(gps.location.isUpdated());
    }
    delay(10);
  }
  return gotFix;
}

void powerOffModem() {
    Serial.println(F("Powering off modem..."));
    if (!modem.poweroff()) {
        Serial.println(F("Modem poweroff command failed or not supported."));
    }
    #if defined(SIM800L_POWER)
      digitalWrite(SIM800L_POWER, LOW);
      Serial.println(F("Modem power pin set to LOW."));
    #endif
}

void enterDeepSleep(uint64_t seconds) {
  Serial.print(F("Entering deep sleep for "));
  Serial.print(seconds);
  Serial.println(F(" seconds..."));
  Serial.flush();
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
  esp_deep_sleep_start();
}

void disconnectGPRS() {
    Serial.print(F("Disconnecting GPRS..."));
  if(modem.gprsDisconnect()){
      Serial.println(F(" success"));
  } else {
      Serial.println(F(" fail"));
  }
}

void powerUpModem() {
    Serial.println(F("Powering on modem..."));
  #if defined(SIM800L_POWER)
    pinMode(SIM800L_POWER, OUTPUT);
    digitalWrite(SIM800L_POWER, HIGH);
    Serial.println(F("Modem power pin set to HIGH."));
    delay(500);
  #endif

  #if defined(SIM800L_PWRKEY)
    pinMode(SIM800L_PWRKEY, OUTPUT);
    digitalWrite(SIM800L_PWRKEY, LOW);
    delay(1000);
    digitalWrite(SIM800L_PWRKEY, HIGH);
    Serial.println(F("Modem PWRKEY toggled."));
  #endif
}

void initModemandConnect() {
  Serial.println(F("Initializing modem serial..."));
  SerialAT.begin(9600, SERIAL_8N1, SIM800L_TX, SIM800L_RX);
  delay(3000);

  Serial.println(F("Initializing modem logic..."));
  if (!modem.init()) {
    Serial.println(F("Failed to initialize modem! Trying restart..."));
    if(!modem.restart()){
        Serial.println(F("Modem restart also failed! Entering deep sleep."));
        powerOffModem();
        enterDeepSleep(DEFAULT_SLEEP_SECONDS); 
    }
  }

  String modemInfo = modem.getModemInfo();
  Serial.print(F("Modem Info: "));
  Serial.println(modemInfo);

  Serial.print(F("Waiting for network..."));
  if (!modem.waitForNetwork(240000L, true)) { // Wait up to 4 minutes
    Serial.println(F(" fail"));
    powerOffModem();
    enterDeepSleep(DEFAULT_SLEEP_SECONDS);
    return;
  }
  Serial.println(F(" success"));

  Serial.print(F("Connecting to GPRS: "));
  Serial.print(apn);
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    Serial.println(F(" fail"));
    powerOffModem();
    enterDeepSleep(DEFAULT_SLEEP_SECONDS);
    return;
  }
  Serial.println(F(" success"));
}

void sendHTTPPostRequest() {
  Serial.println(F("Performing HTTP POST request..."));
  
  StaticJsonDocument<256> jsonDoc;
  jsonDoc["device"] = deviceName;
  jsonDoc["latitude"] = lat;
  jsonDoc["longitude"] = lon;
  jsonDoc["speed"] = spd;
  jsonDoc["altitude"] = alt;
  jsonDoc["accuracy"] = hdop;
  jsonDoc["satellites"] = sats;
  
  String jsonData;
  serializeJson(jsonDoc, jsonData);
  Serial.print(F("JSON Payload: "));
  Serial.println(jsonData);

  if (!client.connect(server, port)) {
    Serial.println(F("Connect to server failed!"));
  } else {
    Serial.println(F("Connected to server."));
    client.print(F("POST ")); client.print(resourcePost); client.println(F(" HTTP/1.1"));
    client.print(F("Host: ")); client.println(server);
    client.println(F("Content-Type: application/json"));
    client.print(F("Content-Length: ")); client.println(jsonData.length());
    client.println(F("Connection: close"));
    client.println();
    client.print(jsonData);

    unsigned long timeout = millis();
    while (client.connected() && client.available() == 0) {
      if (millis() - timeout > 10000L) {
        Serial.println(F(">>> Client Timeout !"));
        break;
      }
      delay(100);
    }

    if(client.available()){
        String responseBody = "";
        String status_line = client.readStringUntil('\n');
        Serial.print("Status: "); Serial.println(status_line);
        while (client.available()) {
            String line = client.readStringUntil('\n');
            line.trim();
            if (line.length() == 0) break;
        }
        while(client.available()){
          responseBody += (char)client.read();
        }
        Serial.print(F("Server Response Body: "));
        Serial.println(responseBody);
        
        StaticJsonDocument<128> responseDoc;
        DeserializationError error = deserializeJson(responseDoc, responseBody);

        if (error) {
          Serial.print(F("deserializeJson() failed: "));
          Serial.println(error.c_str());
          Serial.println(F("Using default sleep interval."));
          sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;
        } else {
          if (responseDoc.containsKey("sleep_interval") && responseDoc["sleep_interval"].is<unsigned int>()) {
            sleepTimeSeconds = responseDoc["sleep_interval"].as<unsigned int>();
            Serial.print(F("Received sleep_interval: "));
            Serial.println(sleepTimeSeconds);
            if (sleepTimeSeconds == 0) { // Avoid 0 sleep time
                Serial.println(F("Sleep interval is 0, using default."));
                sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;
            }
          } else {
            Serial.println(F("sleep_interval not found or invalid in response, using default."));
            sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;
          }
        }
    } else {
        Serial.println(F("No data received from server or client disconnected."));
    }
    client.stop();
    Serial.println(F("Disconnected from server."));
  }
}

void setup() {
  Serial.begin(115200);
  delay(10);
  
  Serial.println(F("\n--- L76X GPS ---"));

  powerUpGPS();
  initGPSSerial();

  Serial.println("Waiting for GPS fix...");
  bool gotFix = waitForGPSFix(timeoutGPS * 60UL * 1000UL);

  closeGPSSerial();
  powerDownGPS();
  Serial.println(gotFix ? "GPS fix obtained, powering down GPS." : "Timeout, no GPS fix, powering down GPS.");

  Serial.println(F("\n--- ESP32 SIM800L POST ---"));

  powerUpModem();
  initModemandConnect();

  sendHTTPPostRequest();

  disconnectGPRS();
  powerOffModem();

  enterDeepSleep(sleepTimeSeconds);
}

void loop() {
// This part is not reached due to deep sleep
}
