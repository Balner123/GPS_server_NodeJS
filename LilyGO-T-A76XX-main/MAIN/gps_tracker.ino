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
#include <LittleFS.h>
#include <Preferences.h>

// --------------------------- Configuration ---------------------------------
// --- Modem Configuration (A7670E) ---
#define SerialMon Serial
// #define TINY_GSM_DEBUG SerialMon // Uncomment for TinyGSM internal debug
// #define DUMP_AT_COMMANDS // Uncomment to see all AT commands

// --- External GPS Module Configuration ---
#define GPS_RX_PIN    32  // ESP32 RX <- GPS TX
#define GPS_TX_PIN    33  // ESP32 TX -> GPS RX
#define GPS_POWER_PIN 5   // ESP32 pin to control power to GPS module (via transistor)
#define GPS_BAUD_RATE 9600
#define SAT_THRESHOLD 7   // Minimum satellites for a valid fix
int minSatellitesForFix = SAT_THRESHOLD;
// --- GPRS Configuration ---
// Default values. These will be overwritten by values from Preferences if they exist.
String apn      = "internet.t-mobile.cz";
String gprsUser = "gprs";
String gprsPass = "gprs";

// --- Server Configuration ---
String server  = "lotr-system.xyz";
int    port      = 443;
const char resourcePost[] = "/api/devices/input";

#define CACHE_FILE "/gps_cache.log"
#define PREFERENCES_NAMESPACE "gps-tracker"
#define KEY_BATCH_SIZE "batch_size"

// --- Device & GPS Configuration ---
String deviceName = "NEO-6M_A7670E";
const char* deviceID = ""; // Device ID for the payload
const unsigned long GPS_ACQUISITION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for GPS fix attempt

// --- Sleep Configuration ---
const uint64_t DEFAULT_SLEEP_SECONDS = 60;
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

// --- OTA Configuration ---
const int otaPin = 23; // GPIO pin for OTA mode switch (connect to 3.3V for OTA mode)
String ota_ssid = "lotrTrackerOTA" + String(deviceID);
String ota_password = "password";

WebServer otaServer(80);

Preferences preferences;
RTC_DATA_ATTR int cycleCounter = 0; // Counts boot cycles, survives deep sleep

// HTML for OTA upload page
const char* update_form_page = R"rawliteral(
  <html>
  <head>
    <title>OTA Update</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status { padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; }
      .status.ok { background-color: #d4edda; color: #155724; }
      .status.fail { background-color: #f8d7da; color: #721c24; }
      .form-group { margin-bottom: 15px; text-align: left; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'], input[type='file'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; } /* Added input[type='file'] */
      input[type='submit'] { background-color: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; } /* Changed color to green */
      input[type='submit']:hover { background-color: #218838; } /* Changed hover color */
      .nav-menu { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1> GPSTracker Update</h1>
      <p><b>Device ID:</b> %id%</p>
      <p>Connect to Wi-Fi: <b>%s</b></p>
      <form method='POST' action='/update' enctype='multipart/form-data'>
        <input type='file' name='update' accept='.bin' required><br>
        <input type='submit' value='Upload and Update'>
      </form>
      <div class="nav-menu">
        <a href="/">Main Page</a> | 
        <a href="/settings">Settings</a>
      </div>
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

// --- HTML for OTA Response Page ---
const char* ota_response_page_template = R"rawliteral(
  <html>
  <head>
    <title>Registration Status</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status-message { padding: 10px; border-radius: 4px; margin: 20px 0; font-weight: bold; font-size: 1.1em; }
      .status-message.ok { background-color: #d4edda; color: #155724; }
      .status-message.fail { background-color: #f8d7da; color: #721c24; }
      a { color: #007bff; text-decoration: none; margin-top: 15px; display: inline-block; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Registration Status</h1>
      <div class="status-message %status_class%">%message%</div>
      <a href="/">Go Back</a>
    </div>
  </body>
  </html>
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

bool isRegistered = true; // Assume registered until told otherwise by the server

// ------------------------- Function Prototypes (External GPS)-----------------------------
void powerUpGPS();
void powerDownGPS();
void initGPSSerial();
void closeGPSSerial();
void displayAndStoreGPSInfo();
bool waitForGPSFix(unsigned long timeout);

// --- OTA Function Prototypes ---
void startOTAMode();
void loadConfiguration();

// ------------------------- Function Prototypes (Modem A7670E & System) -------------
bool initializeModem();
bool connectGPRS();
void sendGpsData();
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

  // Load configuration from Preferences
  loadConfiguration();

  // Set Device ID from MAC Address, this is permanent and unique
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  // Use the last 10 characters of the MAC address for a shorter ID
  String shortMac = mac.substring(mac.length() - 10);
  deviceID = strdup(shortMac.c_str());
  SerialMon.print(F("Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);

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
    SerialMon.println(F("GPSTracker Mode Activated."));

    // 1. Initialize Filesystem and Preferences
    if(!LittleFS.begin()){
        SerialMon.println(F("An Error has occurred while mounting LittleFS"));
        enterDeepSleep(DEFAULT_SLEEP_SECONDS); // Cannot proceed without FS
        return;
    }
    preferences.begin(PREFERENCES_NAMESPACE, false);
    uint8_t batchSize = preferences.getUChar(KEY_BATCH_SIZE, 1); // Default batch size is 1

    // 2. Get GPS Data
    SerialMon.println(F("--- Initializing External GPS ---"));
    powerUpGPS();
    initGPSSerial();
    waitForGPSFix(GPS_ACQUISITION_TIMEOUT_MS);
    closeGPSSerial(); // De-initialize serial pins before cutting power
    powerDownGPS(); // Power down GPS immediately after fix attempt

    // 3. Cache the data point if a fix was obtained
    if (gpsFixObtained) {
      JsonDocument jsonDoc;
      jsonDoc["device"] = deviceID;
      jsonDoc["name"] = deviceName;
      jsonDoc["latitude"] = gpsLat;
      jsonDoc["longitude"] = gpsLon;
      jsonDoc["speed"] = gpsSpd;
      jsonDoc["altitude"] = gpsAlt;
      jsonDoc["accuracy"] = gpsHdop;
      jsonDoc["satellites"] = gpsSats;
      if (gpsYear != 0) {
        char timestamp[25];
        sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", gpsYear, gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond);
        jsonDoc["timestamp"] = timestamp;
      }
      String jsonData;
      serializeJson(jsonDoc, jsonData);
      appendToCache(jsonData);
      cycleCounter++;
      SerialMon.printf("Cycle %d/%d complete.\n", cycleCounter, batchSize);
    }

    // 4. Decide whether to send data
    bool shouldSend = (cycleCounter >= batchSize) || (cycleCounter > 0 && LittleFS.exists(CACHE_FILE));

    if (shouldSend) {
      SerialMon.println(F("Batch size reached or old data exists. Attempting to send."));
      
      if (initializeModem() && connectGPRS()) {
        if (sendCachedData()) {
          cycleCounter = 0; // Reset counter only on successful send
        }
        disconnectGPRS();
      } else {
        SerialMon.println(F("Failed to connect to GPRS. Data remains cached."));
      }
      powerOffModem();

    } else {
       SerialMon.println(F("Not sending yet. Going to sleep."));
    }

    // 5. Go to sleep
    preferences.end(); // Close preferences before sleeping
    if (isRegistered) {
      SerialMon.print(F("Device is registered. Next update in approx. ")); SerialMon.print(sleepTimeSeconds); SerialMon.println(F(" seconds."));
      enterDeepSleep(sleepTimeSeconds);
    } else {
      SerialMon.println(F("DEVICE NOT REGISTERED. Powering down permanently."));
      SerialMon.println(F("Please use OTA mode to register the device."));
      esp_deep_sleep_start(); // Indefinite sleep
    }
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
  if (!modem.gprsConnect(apn.c_str(), gprsUser.c_str(), gprsPass.c_str())) {
    SerialMon.println(F(" fail"));
    return false;
  }
  SerialMon.println(F(" success"));
  SerialMon.print(F("GPRS IP: ")); SerialMon.println(modem.getLocalIP());
  return true;
}

String sendPostRequest(const char* resource, const String& payload) {
  SerialMon.print(F("Performing HTTPS POST to: ")); SerialMon.println(resource);
  SerialMon.print(F("Payload: ")); SerialMon.println(payload);

  String response_body = "";

  if (!modem.https_begin()) {
    SerialMon.println(F("Failed to begin HTTPS session."));
    return "";
  }

  String fullUrl = "https://";
  fullUrl += server;
  fullUrl += resource;
  
  SerialMon.print(F("Set URL: ")); SerialMon.println(fullUrl);
  if (!modem.https_set_url(fullUrl.c_str())) {
    SerialMon.println(F("Failed to set URL."));
    modem.https_end();
    return "";
  }

  SerialMon.println(F("Set Content-Type header..."));
  if (!modem.https_set_content_type("application/json")) {
    SerialMon.println(F("Failed to set Content-Type."));
    modem.https_end();
    return "";
  }

  SerialMon.println(F("Sending POST request..."));
  int statusCode = modem.https_post(payload);

  if (statusCode <= 0) {
    SerialMon.print(F("POST request failed with status code: ")); SerialMon.println(statusCode);
  } else {
    SerialMon.print(F("Response Status Code: ")); SerialMon.println(statusCode);
    SerialMon.println(F("Reading response body..."));
    response_body = modem.https_body();
  }
  
  SerialMon.println(F("End HTTPS session."));
  modem.https_end();

  SerialMon.println(F("Response Body:"));
  SerialMon.println(response_body);
  return response_body;
}

void sendGpsData() {
  JsonDocument jsonDoc;
  jsonDoc["device"] = deviceID;
  jsonDoc["name"] = deviceName;

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
  
  String response_body = sendPostRequest(resourcePost, jsonData);
  
  // --- Process server response ---
  if (response_body.length() > 0) {
    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response_body);

    if (error) {
      SerialMon.print(F("deserializeJson() for server response failed: "));
      SerialMon.println(error.f_str());
    } else {
      // Check for registration status (sent with HTTP 403)
      if (serverResponseDoc["registered"] == false) {
        SerialMon.println(F("Server indicated device is not registered."));
        isRegistered = false;
      }

      // Update settings from server response
      if (!serverResponseDoc["interval_gps"].isNull()) {
        unsigned int interval_gps = serverResponseDoc["interval_gps"].as<unsigned int>();
        if (interval_gps > 0) {
          sleepTimeSeconds = interval_gps;
          SerialMon.print(F("Server updated sleep interval to: ")); SerialMon.println(sleepTimeSeconds);
        }
      }

      if (!serverResponseDoc["interval_send"].isNull()) {
        uint8_t newBatchSize = serverResponseDoc["interval_send"].as<uint8_t>();
        if (newBatchSize == 0) newBatchSize = 1; // Ensure batch size is at least 1
        if (newBatchSize > 50) newBatchSize = 50; // Cap batch size to a reasonable max
        
        preferences.putUChar(KEY_BATCH_SIZE, newBatchSize);
        SerialMon.print(F("Server updated batch size to: ")); SerialMon.println(newBatchSize);
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

// --- Load Configuration ---
void loadConfiguration() {
    preferences.begin(PREFERENCES_NAMESPACE, false); // false for read/write

    // Load GPRS settings
    apn = preferences.getString("apn", apn);
    gprsUser = preferences.getString("gprsUser", gprsUser);
    gprsPass = preferences.getString("gprsPass", gprsPass);

    // Load Server settings
    server = preferences.getString("server", server);
    port = preferences.getUInt("port", port);

    // Load Device settings
    deviceName = preferences.getString("deviceName", deviceName);

    // Load OTA settings
    ota_ssid = preferences.getString("ota_ssid", ota_ssid);
    ota_password = preferences.getString("ota_password", ota_password);

    // Note: preferences are not closed here, setup() will close it.
}

// --- Cache Handling Functions ---

// Appends a JSON record to the cache file
void appendToCache(String jsonRecord) {
  File file = LittleFS.open(CACHE_FILE, "a"); // a = append
  if (!file) {
    SerialMon.println(F("Failed to open cache file for writing."));
    return;
  }
  if (file.println(jsonRecord)) {
    SerialMon.println(F("GPS data point appended to cache."));
  } else {
    SerialMon.println(F("Failed to write to cache file."));
  }
  file.close();
}

// Reads cached data, sends it in batches, and handles the result
bool sendCachedData() {
  const int MAX_BATCH_SIZE = 50;
  bool allDataSent = true;

  while (true) {
    File file = LittleFS.open(CACHE_FILE, "r");
    if (!file || file.size() == 0) {
      if (file) file.close();
      if (allDataSent) {
        SerialMon.println(F("Cache is empty. All data sent."));
        LittleFS.remove(CACHE_FILE); // Clean up empty file
      }
      return allDataSent;
    }

    String payload = "[";
    bool first = true;
    int recordCount = 0;
    long lastPosition = 0;

    while (file.available() && recordCount < MAX_BATCH_SIZE) {
      String line = file.readStringUntil('\n');
      line.trim();
      if (line.length() > 0) {
        if (!first) {
          payload += ",";
        }
        payload += line;
        first = false;
        recordCount++;
        lastPosition = file.position();
      }
    }
    payload += "]";

    if (recordCount == 0) {
      file.close();
      LittleFS.remove(CACHE_FILE); // No valid records found, clear cache
      return true;
    }

    SerialMon.printf("Sending batch of %d records...\n", recordCount);
    String response = sendPostRequest(resourcePost, payload);

    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error) {
      if (!serverResponseDoc["interval_gps"].isNull()) {
        unsigned int interval_gps = serverResponseDoc["interval_gps"].as<unsigned int>();
        if (interval_gps > 0) {
          sleepTimeSeconds = interval_gps;
          SerialMon.print(F("Server updated sleep interval to: ")); SerialMon.println(sleepTimeSeconds);
        }
      }
      if (!serverResponseDoc["interval_send"].isNull()) {
        uint8_t newBatchSize = serverResponseDoc["interval_send"].as<uint8_t>();
        if (newBatchSize == 0) newBatchSize = 1;
        if (newBatchSize > 50) newBatchSize = 50;
        preferences.putUChar(KEY_BATCH_SIZE, newBatchSize);
        SerialMon.print(F("Server updated batch size to: ")); SerialMon.println(newBatchSize);
      }
      if (!serverResponseDoc["satellites"].isNull()) {
        minSatellitesForFix = serverResponseDoc["satellites"].as<int>();
        SerialMon.print(F("Server updated minimum satellites for fix to: ")); SerialMon.println(minSatellitesForFix);
      }
    }

    if (!error && serverResponseDoc["success"] == true) {
      SerialMon.println(F("Batch sent successfully. Updating cache file."));
      
      bool moreData = file.available();
      file.close();

      if (moreData) {
        File tempFile = LittleFS.open("/cache.tmp", "w");
        File originalFile = LittleFS.open(CACHE_FILE, "r");
        if (tempFile && originalFile) {
          originalFile.seek(lastPosition);
          while (originalFile.available()) {
            tempFile.write(originalFile.read());
          }
          tempFile.close();
          originalFile.close();
          LittleFS.remove(CACHE_FILE);
          LittleFS.rename("/cache.tmp", CACHE_FILE);
        } else {
          SerialMon.println(F("Error creating temp file for cache update."));
          if(tempFile) tempFile.close();
          if(originalFile) originalFile.close();
          allDataSent = false;
          break; 
        }
      } else {
        LittleFS.remove(CACHE_FILE);
        SerialMon.println(F("All cached data sent."));
        break; 
      }
    } else {
      SerialMon.println(F("Failed to send batch data. Cache will be kept."));
      if (error) {
        SerialMon.print(F("JSON parsing of server response failed: "));
        SerialMon.println(error.c_str());
      }
      if (serverResponseDoc["registered"] == false) {
        SerialMon.println(F("Server indicated device is not registered. Halting."));
        isRegistered = false;
      }
      allDataSent = false;
      file.close();
      break; 
    }
  }
  return allDataSent;
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
            gps.satellites.isValid() && (gps.satellites.value() >= minSatellitesForFix)) {
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

// --- Global variable for GPRS connection status in OTA ---
bool gprsConnectedOTA = false;

// --- HTML for OTA Main Page ---
const char* ota_main_page_template = R"rawliteral(
  <html>
  <head>
    <title>Device OTA & Registration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
      h1 { color: #333; }
      p { color: #555; line-height: 1.5; }
      .status { padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; }
      .status.ok { background-color: #d4edda; color: #155724; }
      .status.fail { background-color: #f8d7da; color: #721c24; }
      .form-group { margin-bottom: 15px; text-align: left; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      input[type='submit'] { background-color: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; }
      input[type='submit']:hover { background-color: #218838; }
      .nav-menu { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Device Service Mode</h1>
      <p><b>Device ID:</b> %id%</p>
      <p><b>GPRS Status:</b> <span class="status %gprs_status_class%">%gprs_status%</span></p>
      <hr>
      <h2>Register Device</h2>
      <p>If this device is not registered, enter your account details below.</p>
      <form method='POST' action='/doregister'>
        <div class="form-group">
          <label for="username">Username:</label>
          <input type='text' id="username" name='username' required>
        </div>
        <div class="form-group">
          <label for="password">Password:</label>
          <input type='password' id="password" name='password' required>
        </div>
        <input type='submit' value='Register Device'>
      </form>
      <div class="nav-menu">
        <a href="/settings">Settings</a> | 
        <a href="/update">Firmware Update</a>
      </div>
    </div>
  </body>
  </html>
)rawliteral";

// --- HTML for Settings Page ---
const char* settings_page_template = R"rawliteral(
  <html>
  <head>
    <title>Device Settings</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }
      .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 600px; margin: auto; }
      h1, h2 { color: #333; text-align: center; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type='text'], input[type='password'], input[type='number'] { width: calc(100% - 22px); padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
      input[type='submit'] { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; width: 100%; }
      input[type='submit']:hover { background-color: #0056b3; }
      .nav-menu { margin-top: 20px; text-align: center; padding-top: 10px; border-top: 1px solid #eee; }
      .nav-menu a { margin: 0 10px; color: #007bff; text-decoration: none; }
      .nav-menu a:hover { text-decoration: underline; }
      hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
      .section-header { display: flex; justify-content: space-between; align-items: center; }
      .test-btn { padding: 5px 10px; font-size: 0.9em; cursor: pointer; }
      .loader { border: 4px solid #f3f3f3; border-radius: 50%; border-top: 4px solid #3498db; width: 16px; height: 16px; animation: spin 2s linear infinite; display: none; margin-left: 10px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      .section-container { padding: 20px; border-radius: 5px; transition: background-color 0.5s ease; }
      .section-container.success { background-color: #d4edda; }
      .section-container.failure { background-color: #f8d7da; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Device Settings</h1>
      <form method='POST' action='/savesettings' onsubmit="return validatePasswords()">
        
        <div id="gprs-section" class="section-container">
          <div class="section-header">
            <h2>GPRS Configuration</h2>
            <div style="display: flex; align-items: center;">
              <button type="button" id="test-gprs-btn" class="test-btn" onclick="testGPRS()">Test</button>
              <div id="gprs-loader" class="loader"></div>
            </div>
          </div>
          <div class="form-group">
            <label for="apn">APN:</label>
            <input type='text' id="apn" name='apn' value='%apn%'>
          </div>
          <div class="form-group">
            <label for="gprsUser">GPRS User:</label>
            <input type='text' id="gprsUser" name='gprsUser' value='%gprsUser%'>
          </div>
          <div class="form-group">
            <label for="gprsPass">GPRS Password:</label>
            <input type='text' id="gprsPass" name='gprsPass' value='%gprsPass%'>
          </div>
          <div class="form-group">
            <label for="gprsPassConfirm">Confirm GPRS Password:</label>
            <input type='text' id="gprsPassConfirm" name='gprsPassConfirm' value='%gprsPass%'>
          </div>
        </div>

        <hr>

        <div id="server-section" class="section-container">
          <div class="section-header">
            <h2>Server Configuration</h2>
            <div style="display: flex; align-items: center;">
              <button type="button" id="test-server-btn" class="test-btn" onclick="testServer()">Test</button>
              <div id="server-loader" class="loader"></div>
            </div>
          </div>
          <div class="form-group">
            <label for="server">Server Hostname/IP:</label>
            <input type='text' id="server" name='server' value='%server%'>
          </div>
          <div class="form-group">
            <label for="port">Server Port:</label>
            <input type='number' id="port" name='port' value='%port%'>
          </div>
        </div>

        <hr>
        <h2>Device Configuration</h2>
        <div class="form-group">
          <label for="deviceName">Device Name:</label>
          <input type='text' id="deviceName" name='deviceName' value='%deviceName%'>
        </div>
        <hr>
        <h2>OTA Hotspot Configuration</h2>
        <div class="form-group">
          <label for="ota_ssid">OTA WiFi SSID:</label>
          <input type='text' id="ota_ssid" name='ota_ssid' value='%ota_ssid%'>
        </div>
        <div class="form-group">
          <label for="ota_password">OTA WiFi Password:</label>
          <input type='text' id="ota_password" name='ota_password' value='%ota_password%'>
        </div>
        <div class="form-group">
          <label for="ota_password_confirm">Confirm OTA WiFi Password:</label>
          <input type='text' id="ota_password_confirm" name='ota_password_confirm' value='%ota_password%'>
        </div>
        <br>
        <input type='submit' value='Save Settings'>
      </form>
      <div class="nav-menu">
        <a href="/">Main Page</a> | 
        <a href="/update">Firmware Update</a>
      </div>
    </div>
    <script>
      function validatePasswords() {
        var gprsPass = document.getElementById('gprsPass').value;
        var gprsPassConfirm = document.getElementById('gprsPassConfirm').value;
        var otaPass = document.getElementById('ota_password').value;
        var otaPassConfirm = document.getElementById('ota_password_confirm').value;

        if (gprsPass !== gprsPassConfirm) {
          alert('GPRS passwords do not match!');
          return false;
        }
        if (otaPass !== otaPassConfirm) {
          alert('OTA WiFi passwords do not match!');
          return false;
        }
        return true;
      }

      function testGPRS() {
        const btn = document.getElementById('test-gprs-btn');
        const loader = document.getElementById('gprs-loader');
        const section = document.getElementById('gprs-section');
        
        btn.disabled = true;
        loader.style.display = 'block';
        section.className = 'section-container';

        const apn = document.getElementById('apn').value;
        const user = document.getElementById('gprsUser').value;
        const pass = document.getElementById('gprsPass').value;

        fetch(`/testgprs?apn=${encodeURIComponent(apn)}&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              section.classList.add('success');
            } else {
              section.classList.add('failure');
            }
          })
          .catch(err => {
            section.classList.add('failure');
            console.error('Error:', err);
          })
          .finally(() => {
            btn.disabled = false;
            loader.style.display = 'none';
          });
      }

      function testServer() {
        const btn = document.getElementById('test-server-btn');
        const loader = document.getElementById('server-loader');
        const section = document.getElementById('server-section');

        btn.disabled = true;
        loader.style.display = 'block';
        section.className = 'section-container';

        const host = document.getElementById('server').value;
        const port = document.getElementById('port').value;

        fetch(`/testserver?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              section.classList.add('success');
            } else {
              section.classList.add('failure');
            }
          })
          .catch(err => {
            section.classList.add('failure');
            console.error('Error:', err);
          })
          .finally(() => {
            btn.disabled = false;
            loader.style.display = 'none';
          });
      }
    </script>
  </body>
  </html>
)rawliteral";

// --- OTA Mode Function Implementation ---
void startOTAMode() {
  SerialMon.println(F("--- OTA Service Mode Activated ---"));

  // 1. Initialize and connect modem first
  SerialMon.println(F("Initializing Modem for OTA mode..."));
  if (initializeModem()) {
    SerialMon.println(F("Connecting to GPRS for OTA mode..."));
    gprsConnectedOTA = connectGPRS();
  } else {
    gprsConnectedOTA = false;
    SerialMon.println(F("Modem initialization failed. Registration will not be possible."));
  }

  // 2. Start WiFi AP
  SerialMon.println(F("Starting WiFi AP..."));
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ota_ssid.c_str(), ota_password.c_str());
  IPAddress apIP = WiFi.softAPIP();
  SerialMon.print(F("AP IP address: ")); SerialMon.println(apIP);

  // 3. Define Web Server Handlers

  // Handler for the main service page
  otaServer.on("/", HTTP_GET, []() {
    String page_content = String(ota_main_page_template);
    page_content.replace("%id%", deviceID);
    if (gprsConnectedOTA) {
      page_content.replace("%gprs_status_class%", "ok");
      page_content.replace("%gprs_status%", "Connected");
    } else {
      page_content.replace("%gprs_status_class%", "fail");
      page_content.replace("%gprs_status%", "Connection Failed");
    }
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the firmware update page
  otaServer.on("/update", HTTP_GET, []() {
    String page_content = String(update_form_page);
    page_content.replace("%id%", deviceID);
    page_content.replace("%s", ota_ssid.c_str());
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the settings page
  otaServer.on("/settings", HTTP_GET, []() {
    String page_content = String(settings_page_template);
    page_content.replace("%apn%", apn);
    page_content.replace("%gprsUser%", gprsUser);
    page_content.replace("%gprsPass%", gprsPass);
    page_content.replace("%server%", server);
    page_content.replace("%port%", String(port));
    page_content.replace("%deviceName%", deviceName);
    page_content.replace("%ota_ssid%", ota_ssid);
    page_content.replace("%ota_password%", ota_password);
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for saving settings
  otaServer.on("/savesettings", HTTP_POST, []() {
    preferences.begin(PREFERENCES_NAMESPACE, false);

    // GPRS
    if (otaServer.hasArg("apn")) preferences.putString("apn", otaServer.arg("apn"));
    if (otaServer.hasArg("gprsUser")) preferences.putString("gprsUser", otaServer.arg("gprsUser"));
    
    String gprsPass = otaServer.arg("gprsPass");
    String gprsPassConfirm = otaServer.arg("gprsPassConfirm");
    if (gprsPass == gprsPassConfirm) {
        preferences.putString("gprsPass", gprsPass);
    }

    // Server
    if (otaServer.hasArg("server")) preferences.putString("server", otaServer.arg("server"));
    if (otaServer.hasArg("port")) preferences.putUInt("port", otaServer.arg("port").toInt());

    // Device
    if (otaServer.hasArg("deviceName")) preferences.putString("deviceName", otaServer.arg("deviceName"));

    // OTA
    if (otaServer.hasArg("ota_ssid")) preferences.putString("ota_ssid", otaServer.arg("ota_ssid"));

    String otaPass = otaServer.arg("ota_password");
    String otaPassConfirm = otaServer.arg("ota_password_confirm");
    if (otaPass == otaPassConfirm) {
        preferences.putString("ota_password", otaPass);
    }
    
    preferences.end();

    // Reload config to apply immediately for things like OTA SSID
    loadConfiguration();

    // Redirect back to settings page with a success message (or a dedicated success page)
    otaServer.sendHeader("Location", "/settings", true);
    otaServer.send(302, "text/plain", "");
  });

  // Handler for testing GPRS connection
  otaServer.on("/testgprs", HTTP_GET, []() {
    String test_apn = otaServer.arg("apn");
    String test_user = otaServer.arg("user");
    String test_pass = otaServer.arg("pass");

    SerialMon.println("--- Testing GPRS Connection ---");
    SerialMon.printf("APN: %s, User: %s\n", test_apn.c_str(), test_user.c_str());

    modem.gprsDisconnect();
    SerialMon.println("GPRS disconnected for test.");
    delay(1000);

    bool success = modem.gprsConnect(test_apn.c_str(), test_user.c_str(), test_pass.c_str());

    if (success) {
      SerialMon.println("GPRS test connection successful.");
      otaServer.send(200, "application/json", "{\"success\":true}");
      modem.gprsDisconnect(); // Disconnect after test
    } else {
      SerialMon.println("GPRS test connection failed.");
      otaServer.send(200, "application/json", "{\"success\":false}");
    }

    // Reconnect with original settings
    SerialMon.println("Reconnecting to GPRS with saved settings...");
    gprsConnectedOTA = connectGPRS();
    if (gprsConnectedOTA) {
      SerialMon.println("Reconnected successfully.");
    } else {
      SerialMon.println("Failed to reconnect to GPRS with saved settings.");
    }
  });

  // Handler for testing server connection
  otaServer.on("/testserver", HTTP_GET, []() {
    if (!gprsConnectedOTA) {
      otaServer.send(200, "application/json", "{\"success\":false, \"reason\":\"GPRS not connected\"}");
      return;
    }

    String test_host = otaServer.arg("host");
    int test_port = otaServer.arg("port").toInt();

    SerialMon.println("--- Testing Server Connection ---");
    SerialMon.printf("Host: %s, Port: %d\n", test_host.c_str(), test_port);

    bool success = client.connect(test_host.c_str(), test_port);

    if (success) {
      SerialMon.println("Server test connection successful.");
      client.stop();
      otaServer.send(200, "application/json", "{\"success\":true}");
    } else {
      SerialMon.println("Server test connection failed.");
      otaServer.send(200, "application/json", "{\"success\":false}");
    }
  });

  // Handler for the registration form submission
  otaServer.on("/doregister", HTTP_POST, []() {
    if (!gprsConnectedOTA) {
      otaServer.send(503, "text/plain", "GPRS not connected. Cannot process registration.");
      return;
    }
    if (!otaServer.hasArg("username") || !otaServer.hasArg("password")) {
      otaServer.send(400, "text/plain", "Missing username or password.");
      return;
    }
    String username = otaServer.arg("username");
    String password = otaServer.arg("password");

    JsonDocument regDoc;
    regDoc["username"] = username;
    regDoc["password"] = password;
    regDoc["deviceId"] = deviceID;
    regDoc["name"] = deviceName;
    String registrationPayload;
    serializeJson(regDoc, registrationPayload);

    String response = sendPostRequest("/api/hw/register-device", registrationPayload);

    // Prepare styled response page
    String page_content = String(ota_response_page_template);
    String message = "";
    
    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error && serverResponseDoc["success"] == true) {
      message = "Device registered successfully! Please reboot the device into normal mode.";
      page_content.replace("%status_class%", "ok");
    } else {
      message = "Registration failed. Please check credentials and try again.";
      // Optionally add more details from the server response if available
      if (response.length() > 0) {
        String server_msg = serverResponseDoc["error"].as<String>();
        message += "<br><small>Reason: " + server_msg + "</small>";
      }
      page_content.replace("%status_class%", "fail");
    }
    
    page_content.replace("%message%", message);
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the actual firmware update process (same as before)
  otaServer.on("/update", HTTP_POST, []() {
    otaServer.sendHeader("Connection", "close");
    if (Update.hasError()) {
        char errorMsg[128];
        snprintf(errorMsg, sizeof(errorMsg), "Update failed! Error: %d - %s", Update.getError(), Update.errorString());
        String page_content = failure_page_template;
        page_content.replace("%s", errorMsg);
        otaServer.send(500, "text/html", page_content);
    } else {
        otaServer.send(200, "text/html", success_page);
    }
  }, []() {
    HTTPUpload& upload = otaServer.upload();
    if (upload.status == UPLOAD_FILE_START) {
      if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { Update.printError(SerialMon); }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) { Update.printError(SerialMon); }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (!Update.end(true)) { Update.printError(SerialMon); }
    }
  });

  // 4. Start Web Server
  otaServer.begin();
  SerialMon.println(F("OTA Web Server started. Waiting for connections..."));

  // 5. Loop indefinitely to handle OTA requests
  while (true) {
    otaServer.handleClient();
    delay(1);
  }
}