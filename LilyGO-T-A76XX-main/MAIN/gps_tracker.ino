// Include necessary libraries
#include "utilities.h"       // For board-specific definitions (copy this file to the MAIN/ directory)
#include <TinyGsmClient.h>
#include <ArduinoJson.h>     // For creating JSON payloads
#include "esp_sleep.h"       // For deep sleep functionality
#include <TinyGPS++.h>       // For external GPS module
#include <SoftwareSerial.h>  // For external GPS module communication

// --------------------------- Configuration ---------------------------------
// --- Modem Configuration (A7670E) ---
#define SerialMon Serial
// #define TINY_GSM_DEBUG SerialMon // Uncomment for TinyGSM internal debug
// #define DUMP_AT_COMMANDS // Uncomment to see all AT commands

// --- External GPS Module Configuration ---
#define GPS_RX_PIN    33  // ESP32 RX <- GPS TX
#define GPS_TX_PIN    32  // ESP32 TX -> GPS RX
#define GPS_POWER_PIN 5   // ESP32 pin to control power to GPS module (via transistor)
#define GPS_BAUD_RATE 9600
#define SAT_THRESHOLD 7   // Minimum satellites for a valid fix

// --- GPRS Configuration ---
const char apn[]      = "internet.t-mobile.cz"; // Replace with your APN
const char gprsUser[] = "gprs";                 // Replace with your GPRS username
const char gprsPass[] = "gprs";                 // Replace with your GPRS password

// --- Server Configuration ---
const char server[]       = "129.151.215.96"; // Your server IP or hostname
const int  port           = 5000;              // Your server port
const char resourcePost[] = "/device_input";     // Your server endpoint

// --- Device & GPS Configuration ---
const char* deviceName = "NEO-6M_A7670E"; // Device name for the payload
const unsigned long GPS_ACQUISITION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for GPS fix attempt

// --- Sleep Configuration ---
const uint64_t DEFAULT_SLEEP_SECONDS = 60;
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

// --------------------------- Global Objects --------------------------------
#ifdef DUMP_AT_COMMANDS // if enabled it requires the streamDebugger lib
#include <StreamDebugger.h>
StreamDebugger debugger(SerialAT, SerialMon);
TinyGsm modem(debugger);
#else
TinyGsm modem(SerialAT); // SerialAT is typically defined in utilities.h or via board definitions
#endif

// --- Objects for External GPS ---
SoftwareSerial SerialGPS(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

// --- Global variables for GPS data (from external GPS) ---
bool  gpsFixObtained = false; // Flag to indicate if a valid GPS fix was obtained
double gpsLat = 0.0;
double gpsLon = 0.0;
int   gpsSats = 0;
double gpsSpd = 0.0; // Speed in km/h
double gpsAlt = 0.0; // Altitude in meters
double gpsHdop = -1.0; // HDOP value, -1.0 if invalid
// Variables for timestamp from GPS
uint16_t gpsYear = 0;
uint8_t  gpsMonth = 0;
uint8_t  gpsDay = 0;
uint8_t  gpsHour = 0;
uint8_t  gpsMinute = 0;
uint8_t  gpsSecond = 0;

TinyGsmClient client(modem);

// ------------------------- Function Prototypes (External GPS)-----------------------------
void powerUpGPS();
void powerDownGPS();
void initGPSSerial();
void closeGPSSerial();
void displayAndStoreGPSInfo();
bool waitForGPSFix(unsigned long timeout);

// ------------------------- Function Prototypes (Modem A7670E & System) -------------
bool initializeModem();
bool connectGPRS();
void sendHTTPPostRequest();
void disconnectGPRS();
void powerOffModem();
void enterDeepSleep(uint64_t seconds);

// ----------------------------- Setup ---------------------------------------
void setup() {
  SerialMon.begin(115200);
  delay(100);
  SerialMon.println(F("\n--- LilyGO A76XX External GPS Tracker (Optimized Power) ---"));

  // 1. Initialize External GPS & Attempt to get fix
  SerialMon.println(F("--- Initializing External GPS ---"));
  powerUpGPS();
  initGPSSerial();
  // gpsFixObtained se globálně nastaví uvnitř waitForGPSFix
  waitForGPSFix(GPS_ACQUISITION_TIMEOUT_MS);
  
  // 2. Immediately power down GPS module after fix attempt
  SerialMon.println(F("--- Powering down External GPS module (post-fix attempt) ---"));
  closeGPSSerial(); 
  powerDownGPS(); // GPS se vypne hned zde

  // 3. Initialize Modem (A7670E)
  // Modem se inicializuje až po kompletním zpracování GPS, aby GPS neběželo zbytečně dlouho,
  // pokud by inicializace modemu trvala.
  SerialMon.println(F("--- Initializing Modem A7670E ---"));
  if (!initializeModem()) {
    SerialMon.println(F("Failed to initialize modem. Entering deep sleep."));
    // GPS je již vypnuté v tomto bodě
    enterDeepSleep(DEFAULT_SLEEP_SECONDS);
    return; 
  }
  
  // 4. Connect to GPRS (only if modem initialized successfully)
  SerialMon.println(F("--- Connecting to GPRS ---"));
  if (connectGPRS()) {
    SerialMon.println(F("GPRS Connected."));
    // 5. Send data via HTTP POST (uses global GPS variables)
    sendHTTPPostRequest(); 
    // 6. Disconnect GPRS
    disconnectGPRS();
    SerialMon.println(F("GPRS Disconnected."));
  } else {
    SerialMon.println(F("Failed to connect to GPRS. Modem will be powered off."));
    // I když GPRS selže, pokračujeme k vypnutí modemu a spánku
  }

  // GPS je již vypnuté.
  // Není potřeba zde znovu volat powerDownGPS().

  // 7. Power off modem (A7670E)
  SerialMon.println(F("--- Powering off Modem A7670E ---"));
  powerOffModem();

  // 8. Enter Deep Sleep
  SerialMon.print(F("Next update in approx. ")); SerialMon.print(sleepTimeSeconds); SerialMon.println(F(" seconds."));
  enterDeepSleep(sleepTimeSeconds);
}

// ------------------------------ Loop ---------------------------------------
void loop() {
  // This part is not reached due to deep sleep in setup()
}

// ------------------------- Function Implementations (Modem & System)------------------------
bool initializeModem() {
  SerialMon.println(F("Initializing modem..."));

#ifdef BOARD_POWERON_PIN
    pinMode(BOARD_POWERON_PIN, OUTPUT);
    digitalWrite(BOARD_POWERON_PIN, HIGH); 
#endif

#ifdef MODEM_RESET_PIN 
    SerialMon.println(F("Resetting modem..."));
    pinMode(MODEM_RESET_PIN, OUTPUT);
    digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL); 
    delay(100);
    digitalWrite(MODEM_RESET_PIN, MODEM_RESET_LEVEL);
    delay(2600); 
    digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
    delay(500); 
#endif

  SerialMon.println(F("Toggling PWRKEY..."));
  pinMode(BOARD_PWRKEY_PIN, OUTPUT);
  digitalWrite(BOARD_PWRKEY_PIN, LOW);
  delay(100);    
  digitalWrite(BOARD_PWRKEY_PIN, HIGH);
  delay(1000);   
  digitalWrite(BOARD_PWRKEY_PIN, LOW); 
  
  SerialMon.println(F("Waiting for modem to boot..."));
  delay(3000); 

  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN); 
  SerialMon.println(F("SerialAT configured."));
  delay(1000); 

  SerialMon.println(F("Testing AT command response..."));
  int retry = 0;
  #define MAX_AT_RETRIES 15 
  while (!modem.testAT(1000)) {
    SerialMon.print(F("."));
    if (retry++ >= MAX_AT_RETRIES) {
        SerialMon.println(F("\nFailed to get AT response after multiple attempts. Trying to power cycle PWRKEY again."));
        digitalWrite(BOARD_PWRKEY_PIN, LOW);
        delay(100);
        digitalWrite(BOARD_PWRKEY_PIN, HIGH);
        delay(1000);
        digitalWrite(BOARD_PWRKEY_PIN, LOW);
        delay(3000); 
        retry = 0; 
        if (retry++ >= MAX_AT_RETRIES / 3) { 
             SerialMon.println(F("\nStill no AT response after power cycle. Giving up."));
             return false;
        }
    }
    if (retry > 5) delay(500); 
  }
  SerialMon.println(F("\nAT command responded."));

  SerialMon.println(F("Initializing modem with modem.init()..."));
  if (!modem.init()) {
    SerialMon.println(F("Modem init failed. Trying restart..."));
    delay(1000); 
    if (!modem.restart()) {
        SerialMon.println(F("Modem restart also failed!"));
        return false;
    }
     SerialMon.println(F("Modem restart successful."));
  } else {
    SerialMon.println(F("Modem init successful."));
  }
  
  String modemInfo = modem.getModemInfo();
  SerialMon.print(F("Modem Info: ")); SerialMon.println(modemInfo);
  if (modemInfo.indexOf("A76") == -1) {
    SerialMon.println(F("Warning: Modem info does not look like A76XX series."));
  }
  return true;
}

bool connectGPRS() {
  SerialMon.print(F("Waiting for network..."));
  if (!modem.waitForNetwork(240000L, true)) { 
    SerialMon.println(F(" fail"));
    return false;
  }
  SerialMon.println(F(" success"));

  SerialMon.print(F("Connecting to GPRS: ")); SerialMon.print(apn);
  if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
    SerialMon.println(F(" fail"));
    return false;
  }
  SerialMon.println(F(" success"));
  SerialMon.print(F("GPRS IP: ")); SerialMon.println(modem.getLocalIP());
  return true;
}

void sendHTTPPostRequest() { 
  SerialMon.println(F("Performing HTTP POST request (with external GPS data)..."));
  
  JsonDocument jsonDoc; 
  jsonDoc["device"] = deviceName;
  
  if (gpsFixObtained) { 
    jsonDoc["latitude"] = gpsLat;
    jsonDoc["longitude"] = gpsLon;
    jsonDoc["speed"] = gpsSpd;
    jsonDoc["altitude"] = gpsAlt;
    jsonDoc["accuracy"] = gpsHdop; 
    jsonDoc["satellites"] = gpsSats;
    
    if (gpsYear != 0) { 
        char timestamp[25];
        sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", 
                gpsYear, gpsMonth, gpsDay, 
                gpsHour, gpsMinute, gpsSecond);
        jsonDoc["timestamp"] = timestamp;
    } else {
        jsonDoc["timestamp"] = "N/A_GPS_TIME"; 
    }
  } else {
    jsonDoc["error"] = "No GPS fix (External)";
  }
  
  String jsonData;
  serializeJson(jsonDoc, jsonData);
  SerialMon.print(F("JSON Payload: ")); SerialMon.println(jsonData);

  String url = "http://";
  url += server;
  url += resourcePost; 

  String content_type = F("application/json");

  SerialMon.print(F("Connecting to "));
  SerialMon.println(server);
  if (!client.connect(server, port)) {
      SerialMon.println(F("Connection failed"));
    return;
  }
  
  SerialMon.println(F("Sending POST request:"));
  SerialMon.println(url);
  SerialMon.println(jsonData);

  client.print(String("POST ") + url + " HTTP/1.1\r\n" +
               "Host: " + server + "\r\n" +
               "Content-Type: " + content_type + "\r\n" +
               "Content-Length: " + String(jsonData.length()) + "\r\n" +
               "Connection: close\r\n\r\n" +
               jsonData);

  unsigned long httpTimeout = millis();
  while (client.available() == 0) {
      if (!client.connected()){
          SerialMon.println(F("Client disconnected while waiting for response."));
          client.stop();
          return;
      }
      if (millis() - httpTimeout > 15000) { 
          SerialMon.println(F(">>> Client HTTP Response Timeout !"));
          client.stop();
          return;
      }
      delay(100);
  }

  SerialMon.println(F("Response:"));
  String status_line = client.readStringUntil('\r'); 
  SerialMon.println(status_line);
  if (client.available()) client.readStringUntil('\n'); 

  while (client.connected()) {
      String line = client.readStringUntil('\r');
      if (client.available()) client.readStringUntil('\n'); 
      if (line == "") {
          break;
      }
  }
  
  String response_body = "";
  unsigned long bodyReadStart = millis();
  while(client.available() && client.connected() && (millis() - bodyReadStart < 5000)){ 
    response_body += (char)client.read();
  }
  if (millis() - bodyReadStart >= 5000 && response_body.length() == 0) {
      SerialMon.println(F("Timeout reading response body or body is empty."));
  }
  SerialMon.println(F("Response Body:"));
  SerialMon.println(response_body);
  
  if (response_body.length() > 0) {
    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response_body);

    if (error) {
      SerialMon.print(F("deserializeJson() for server response failed: "));
      SerialMon.println(error.f_str());
    } else {
      if (!serverResponseDoc["sleep_interval"].isNull()) { 
        if (serverResponseDoc["sleep_interval"].is<unsigned int>()) {
            uint64_t server_sleep = serverResponseDoc["sleep_interval"].as<unsigned int>();
            if (server_sleep > 0 && server_sleep < (24 * 3600)) { 
                 sleepTimeSeconds = server_sleep;
                 SerialMon.print(F("Server updated sleep interval to: ")); SerialMon.println(sleepTimeSeconds);
            } else {
                SerialMon.println(F("Received invalid sleep_interval from server, using default."));
            }
        } else {
             SerialMon.println(F("sleep_interval from server is not an unsigned integer, using default."));
        }
      } else {
        SerialMon.println(F("Server response does not contain 'sleep_interval' or it is null."));
      }
    }
  } else {
    SerialMon.println(F("No body in server response or body read timed out."));
  }
  
  client.stop();
  SerialMon.println(F("Disconnected from server."));
}

void disconnectGPRS() {
  SerialMon.print(F("Disconnecting GPRS..."));
  if (modem.gprsDisconnect()) {
    SerialMon.println(F(" success"));
  } else {
    SerialMon.println(F(" fail"));
  }
}

void powerOffModem() {
  SerialMon.println(F("Powering off modem..."));
  if (!modem.poweroff()) {
      SerialMon.println(F("modem.poweroff() failed or not supported."));
      #if defined(BOARD_PWRKEY_PIN) 
      #endif
      #if defined(BOARD_POWERON_PIN) && defined(BOARD_POWERON_OFF_STATE) 
      #endif
  } else {
    SerialMon.println(F("Modem powered off via TinyGSM."));
  }
  delay(1000);
}

void enterDeepSleep(uint64_t seconds) {
  SerialMon.print(F("Entering deep sleep for "));
  SerialMon.print(seconds);
  SerialMon.println(F(" seconds..."));
  SerialMon.flush(); 
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
  esp_deep_sleep_start();
}

// --- FUNCTION IMPLEMENTATIONS (External GPS) ---
void powerUpGPS() {
  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH); 
  SerialMon.println(F("Powering GPS module ON..."));
  delay(1000); 
}

void powerDownGPS() {
  digitalWrite(GPS_POWER_PIN, LOW); 
  SerialMon.println(F("GPS module powered OFF."));
}

void initGPSSerial() {
  SerialGPS.begin(GPS_BAUD_RATE);
  SerialMon.println(F("SoftwareSerial for GPS initialized."));
}

void closeGPSSerial() {
  SerialGPS.end();
  SerialMon.println(F("SoftwareSerial for GPS closed."));
}

void displayAndStoreGPSInfo() {
  gpsLat = gps.location.lat();
  gpsLon = gps.location.lng();
  gpsSats = gps.satellites.value();
  gpsSpd = gps.speed.kmph();
  gpsAlt = gps.altitude.meters();
  gpsHdop = gps.hdop.isValid() ? (gps.hdop.value() / 100.0) : -1.0; 

  if (gps.date.isValid()) {
    gpsYear = gps.date.year();
    gpsMonth = gps.date.month();
    gpsDay = gps.date.day();
  } else {
    gpsYear = 0; gpsMonth = 0; gpsDay = 0; 
  }
  if (gps.time.isValid()) {
    gpsHour = gps.time.hour(); 
    gpsMinute = gps.time.minute();
    gpsSecond = gps.time.second();
  } else {
    gpsHour = 0; gpsMinute = 0; gpsSecond = 0; 
  }

  SerialMon.println(F("\n*** GPS FIX OBTAINED (External) ***"));
  SerialMon.printf("Lat: %.6f  Lon: %.6f\n", gpsLat, gpsLon);
  SerialMon.printf("Speed: %.2f km/h  Altitude: %.2f m\n", gpsSpd, gpsAlt);
  SerialMon.printf("Satellites: %d  HDOP: %.2f\n", gpsSats, gpsHdop);
  if (gpsYear != 0) {
      SerialMon.printf("Date: %04d-%02d-%02d  Time: %02d:%02d:%02d (UTC from GPS)\n", gpsYear, gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond);
  } else {
      SerialMon.println(F("Date/Time: Not available from GPS"));
  }
}

bool waitForGPSFix(unsigned long timeout) {
  unsigned long startTime = millis();
  unsigned long lastPrintTime = 0;
  gpsFixObtained = false; 

  SerialMon.print(F("Attempting to get GPS fix (External)... (Timeout: "));
  SerialMon.print(timeout / 1000);
  SerialMon.println(F("s)"));

  while (millis() - startTime < timeout) {
    while (SerialGPS.available() > 0) {
      if (gps.encode(SerialGPS.read())) { 
        if (gps.location.isUpdated() && gps.location.isValid() &&
            gps.date.isValid() && gps.time.isValid() &&
            gps.satellites.isValid() && (gps.satellites.value() >= SAT_THRESHOLD)) {
          displayAndStoreGPSInfo(); 
          gpsFixObtained = true;
          break; 
        }
      }
    }
    if (gpsFixObtained) {
      break; 
    }

    if (millis() - lastPrintTime > 5000) {
      lastPrintTime = millis();
      SerialMon.print(F("Waiting for external GPS fix... Sats: "));
      SerialMon.print(gps.satellites.isValid() ? gps.satellites.value() : 0);
      SerialMon.print(F(", Valid Pos: ")); SerialMon.print(gps.location.isValid());
      SerialMon.print(F(", Date Valid: ")); SerialMon.print(gps.date.isValid()); 
      SerialMon.print(F(", Time Valid: ")); SerialMon.println(gps.time.isValid()); 
    }
    delay(10); 
  }

  if (!gpsFixObtained) {
    SerialMon.println(F("\nGPS fix timeout (External)."));
  }
  return gpsFixObtained;
} 