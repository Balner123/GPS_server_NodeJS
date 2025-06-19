// Include necessary libraries
#include "utilities.h"       // For board-specific definitions (copy this file to the MAIN/ directory)
#include <TinyGsmClient.h>
#include <ArduinoJson.h>     // For creating JSON payloads
#include "esp_sleep.h"       // For deep sleep functionality
#include <TinyGPS++.h>       // For external GPS module
#include <SoftwareSerial.h>  // For external GPS module communication

// --- OTA Includes ---
#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>

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
const char server[]       = "lotr-system.xyz"; // Your server IP or hostname
const int  port           = 443;              // Your server port
const char resourcePost[] = "/device_input";     // Your server endpoint

// --- Device & GPS Configuration ---
const char* deviceName = "NEO-6M_A7670E"; // Device name for the payload
const unsigned long GPS_ACQUISITION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for GPS fix attempt

// --- Sleep Configuration ---
const uint64_t DEFAULT_SLEEP_SECONDS = 60;
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

// --- OTA Configuration ---
const int otaPin = 23; // GPIO pin for OTA mode switch (connect to 3.3V for OTA mode)
const char* ota_ssid = "GPS_Tracker_OTA";
const char* ota_password = "password"; // Change or set to NULL for an open network

WebServer otaServer(80);

// HTML for OTA upload page
const char* update_form_page = R"rawliteral(
  <html>
  <head><title>OTA Update</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
    .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); text-align: center; }
    h1 { color: #333; }
    input[type='file'] { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; width: calc(100% - 22px); }
    input[type='submit'] { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; }
    input[type='submit']:hover { background-color: #0056b3; }
  </style>
  </head>
  <body>
    <div class="container">
      <h1>GPS Tracker OTA Update</h1>
      <p>Connect to Wi-Fi: <b>%s</b></p>
      <form method='POST' action='/update' enctype='multipart/form-data'>
        <input type='file' name='update' accept='.bin' required><br>
        <input type='submit' value='Upload and Update'>
      </form>
    </div>
  </body>
  </html>
)rawliteral";

// HTML for success page
String success_page = R"rawliteral(
  <html><head><title>OTA Update Success</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: green; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Successful!</h1>
    <p class="message">Firmware has been updated.<br>Please manually power cycle the device and switch to ON mode.</p>
    <p><a href="/">Upload another file</a></p>
  </body></html>
)rawliteral";

// HTML for failure page template
String failure_page_template = R"rawliteral(
  <html><head><title>OTA Update Failed</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: red; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Failed!</h1>
    <p class="message">Error: %s</p>
    <p><a href="/">Try again</a></p>
  </body></html>
)rawliteral";

// --------------------------- Global Objects --------------------------------
#ifdef DUMP_AT_COMMANDS // if enabled it requires the streamDebugger lib
#include <StreamDebugger.h>
StreamDebugger debugger(SerialAT, SerialMon);
TinyGsm modem(debugger);
#else
TinyGsm modem(SerialAT); // SerialAT is typically defined in utilities.h or via board definitions
#endif

// For the LewisHe fork, SSL functions are in the standard TinyGsmClient
TinyGsmClient client(modem);

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

// ------------------------- Function Prototypes (External GPS)-----------------------------
void powerUpGPS();
void powerDownGPS();
void initGPSSerial();
void closeGPSSerial();
void displayAndStoreGPSInfo();
bool waitForGPSFix(unsigned long timeout);

// --- OTA Function Prototypes ---
void startOTAMode();

// ------------------------- Function Prototypes (Modem A7670E & System) -------------
bool initializeModem();
bool connectGPRS();
void sendHTTPPostRequest();
void disconnectGPRS();
void powerOffModem();
void enterDeepSleep(uint64_t seconds);

// ----------------------------- Setup ---------------------------------------
void setup() {
  // Configure otaPin as INPUT_PULLDOWN.
  // For OTA mode, the switch should connect GPIO23 to 3.3V (HIGH).
  // If your switch connects GPIO23 to GND for OTA mode, use INPUT_PULLUP and check for LOW.
  pinMode(otaPin, INPUT_PULLDOWN);
  
  SerialMon.begin(115200);
  delay(100); // Wait for serial monitor to connect

  // Check OTA Pin state
  // Add a small delay to allow the pin state to stabilize after power-on, especially with physical switches.
  delay(50); 
  bool otaModeActive = (digitalRead(otaPin) == HIGH);

  if (otaModeActive) {
    SerialMon.println(F("OTA Mode Activated."));
    // Any modem/GPS specific de-initialization before WiFi can go here if needed.
    // For this setup, we assume WiFi AP will work fine without explicitly turning off modem power pins yet,
    // as modem initialization is skipped.
    startOTAMode(); // This function will loop indefinitely, program will not proceed beyond this.
  } else {
    SerialMon.println(F("GPS Tracker Mode Activated."));
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
      // 5. Send data via HTTPS POST (uses global GPS variables)
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
}

// ------------------------------ Loop ---------------------------------------
void loop() {
  // This part is not reached due to deep sleep in setup() for GPS mode
  // Or due to infinite loop in startOTAMode() for OTA mode
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
  SerialMon.println(F("Performing HTTPS POST request (A76XX Library Method)..."));

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

  // Correct step-by-step method for TinyGSM A76XX fork
  SerialMon.println(F("Begin HTTPS session..."));
  if (!modem.https_begin()) {
    SerialMon.println(F("Failed to begin HTTPS session."));
    return;
  }

  String fullUrl = "https://";
  fullUrl += server;
  fullUrl += resourcePost;
  
  SerialMon.print(F("Set URL: ")); SerialMon.println(fullUrl);
  if (!modem.https_set_url(fullUrl)) {
    SerialMon.println(F("Failed to set URL."));
    modem.https_end();
    return;
  }

  SerialMon.println(F("Set Content-Type header..."));
  if (!modem.https_set_content_type("application/json")) {
    SerialMon.println(F("Failed to set Content-Type."));
    modem.https_end();
    return;
  }

  SerialMon.println(F("Sending POST request..."));
  int statusCode = modem.https_post(jsonData);

  if (statusCode <= 0) {
    SerialMon.print(F("POST request failed with status code: ")); SerialMon.println(statusCode);
    modem.https_end();
    return;
  }

  SerialMon.print(F("Response Status Code: ")); SerialMon.println(statusCode);

  SerialMon.println(F("Reading response body..."));
  String response_body = modem.https_body();
  
  SerialMon.println(F("End HTTPS session."));
  modem.https_end();

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

// --- OTA Mode Function Implementation ---
void startOTAMode() {
  SerialMon.println(F("Starting OTA Mode setup..."));
  
  // Disconnect and turn off WiFi if it was somehow on (e.g. from a previous run if not deep sleeping)
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(100);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ota_ssid, ota_password); // Password can be NULL for an open network

  IPAddress apIP = WiFi.softAPIP();
  SerialMon.print(F("AP IP address: "));
  SerialMon.println(apIP);
  SerialMon.print(F("Connect to Wi-Fi: "));
  SerialMon.println(ota_ssid);
  SerialMon.println(F("Open browser to http://<IP_ADDRESS_ABOVE> or http://gps-tracker.local (if mDNS works)"));


  otaServer.on("/", HTTP_GET, []() {
    otaServer.sendHeader("Connection", "close");
    String page_content = String(update_form_page);
    page_content.replace("%s", ota_ssid);
    otaServer.send(200, "text/html", page_content);
  });

  otaServer.on("/update", HTTP_POST, []() {
    // This is called after the upload is complete
    otaServer.sendHeader("Connection", "close");
    if (Update.hasError()) {
        char errorMsg[128];
        snprintf(errorMsg, sizeof(errorMsg), "Update failed! Error: %d - %s", Update.getError(), Update.errorString());
        String page_content = failure_page_template;
        page_content.replace("%s", errorMsg);
        otaServer.send(500, "text/html", page_content);
        SerialMon.println(errorMsg);
    } else {
        otaServer.send(200, "text/html", success_page);
        SerialMon.println(F("OTA Update Successful. Please reboot."));
    }
    // User will manually restart the device
  }, []() {
    // This is the upload handler, called during the file upload
    HTTPUpload& upload = otaServer.upload();
    if (upload.status == UPLOAD_FILE_START) {
      SerialMon.printf("OTA Update Start: %s\n", upload.filename.c_str());
      if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { // Use UPDATE_SIZE_UNKNOWN for web uploads
        Update.printError(SerialMon);
      }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(SerialMon);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) { // true to set the new sketch to boot
        SerialMon.printf("OTA Update Finished. Total size: %u bytes\n", upload.totalSize);
      } else {
        Update.printError(SerialMon);
      }
    } else if (upload.status == UPLOAD_FILE_ABORTED) {
        SerialMon.println(F("OTA Update Aborted by client."));
        Update.end(false); // Ensure we don't boot a partial update
    }
  });

  otaServer.begin();
  SerialMon.println(F("OTA Web Server started. Waiting for connections and uploads..."));

  // Loop indefinitely to handle OTA requests
  while (true) {
    otaServer.handleClient();
    delay(1);
  }
} 