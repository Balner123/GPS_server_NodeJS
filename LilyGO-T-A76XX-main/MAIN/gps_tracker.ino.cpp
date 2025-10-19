# 1 "C:\\Users\\Repete\\AppData\\Local\\Temp\\tmpyjj84r0o"
#include <Arduino.h>
# 1 "C:/Users/Repete/Desktop/PROJEKTGPS2025/GPS_server_NodeJS/LilyGO-T-A76XX-main/MAIN/gps_tracker.ino"

#include "utilities.h"
#include <TinyGsmClient.h>
#include <ArduinoJson.h>
#include "esp_sleep.h"
#include <TinyGPS++.h>
#include <SoftwareSerial.h>


#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include <LittleFS.h>
#include <Preferences.h>



#define SerialMon Serial




#define GPS_RX_PIN 32
#define GPS_TX_PIN 33
#define GPS_POWER_PIN 5
#define GPS_BAUD_RATE 9600
#define SAT_THRESHOLD 7
int minSatellitesForFix = SAT_THRESHOLD;

const char apn[] = "internet.t-mobile.cz";
const char gprsUser[] = "gprs";
const char gprsPass[] = "gprs";


const char server[] = "lotr-system.xyz";
const int port = 443;
const char resourcePost[] = "/api/devices/input";

#define CACHE_FILE "/gps_cache.log"
#define PREFERENCES_NAMESPACE "gps-tracker"
#define KEY_BATCH_SIZE "batch_size"


const char* deviceName = "NEO-6M_A7670E";
const char* deviceID = "";
const unsigned long GPS_ACQUISITION_TIMEOUT_MS = 5 * 60 * 1000;


const uint64_t DEFAULT_SLEEP_SECONDS = 60;
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;


const int otaPin = 23;
const char* ota_ssid = "GPS_Tracker_OTA";
const char* ota_password = "password";

WebServer otaServer(80);

Preferences preferences;
RTC_DATA_ATTR int cycleCounter = 0;


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
      .update-link { margin-top: 20px; }
      a { color: #007bff; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>GPS Tracker OTA Update</h1>
      <p><b>Device ID:</b> %id%</p>
      <p>Connect to Wi-Fi: <b>%s</b></p>
      <form method='POST' action='/update' enctype='multipart/form-data'>
        <input type='file' name='update' accept='.bin' required><br>
        <input type='submit' value='Upload and Update'>
      </form>
    </div>
  </body>
  </html>
)rawliteral";


String success_page = R"rawliteral(
  <html><head><title>OTA Update Success</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: green; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Successful!</h1>
    <p class="message">Firmware has been updated.<br>Please manually power cycle the device and switch to ON mode.</p>
    <p><a href="/">Upload another file</a></p>
  </body></html>
)rawliteral";


String failure_page_template = R"rawliteral(
  <html><head><title>OTA Update Failed</title>
  <style>body{font-family: Arial, sans-serif; text-align: center; padding-top: 50px;} .message{color: red; font-size: 1.2em;}</style></head>
  <body>
    <h1>OTA Update Failed!</h1>
    <p class="message">Error: %s</p>
    <p><a href="/">Try again</a></p>
  </body></html>
)rawliteral";


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


#ifdef DUMP_AT_COMMANDS
#include <StreamDebugger.h>
StreamDebugger debugger(SerialAT, SerialMon);
TinyGsm modem(debugger);
#else
TinyGsm modem(SerialAT);
#endif


TinyGsmClient client(modem);


SoftwareSerial SerialGPS(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;


bool gpsFixObtained = false;
double gpsLat = 0.0;
double gpsLon = 0.0;
int gpsSats = 0;
double gpsSpd = 0.0;
double gpsAlt = 0.0;
double gpsHdop = -1.0;

uint16_t gpsYear = 0;
uint8_t gpsMonth = 0;
uint8_t gpsDay = 0;
uint8_t gpsHour = 0;
uint8_t gpsMinute = 0;
uint8_t gpsSecond = 0;

bool isRegistered = true;


void powerUpGPS();
void powerDownGPS();
void initGPSSerial();
void closeGPSSerial();
void displayAndStoreGPSInfo();
bool waitForGPSFix(unsigned long timeout);


void startOTAMode();


bool initializeModem();
bool connectGPRS();
void sendGpsData();
void disconnectGPRS();
void powerOffModem();
void enterDeepSleep(uint64_t seconds);
void setup();
void loop();
String sendPostRequest(const char* resource, const String& payload);
void appendToCache(String jsonRecord);
bool sendCachedData();
#line 204 "C:/Users/Repete/Desktop/PROJEKTGPS2025/GPS_server_NodeJS/LilyGO-T-A76XX-main/MAIN/gps_tracker.ino"
void setup() {



  pinMode(otaPin, INPUT_PULLDOWN);

  SerialMon.begin(115200);
  delay(100);


  String mac = WiFi.macAddress();
  mac.replace(":", "");

  String shortMac = mac.substring(mac.length() - 10);
  deviceID = strdup(shortMac.c_str());
  SerialMon.print(F("Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);



  delay(50);
  bool otaModeActive = (digitalRead(otaPin) == HIGH);

  if (otaModeActive) {
    SerialMon.println(F("OTA Mode Activated."));



    startOTAMode();
  } else {
    SerialMon.println(F("GPS Tracker Mode Activated."));


    if(!LittleFS.begin()){
        SerialMon.println(F("An Error has occurred while mounting LittleFS"));
        enterDeepSleep(DEFAULT_SLEEP_SECONDS);
        return;
    }
    preferences.begin(PREFERENCES_NAMESPACE, false);
    uint8_t batchSize = preferences.getUChar(KEY_BATCH_SIZE, 1);


    SerialMon.println(F("--- Initializing External GPS ---"));
    powerUpGPS();
    initGPSSerial();
    waitForGPSFix(GPS_ACQUISITION_TIMEOUT_MS);
    closeGPSSerial();
    powerDownGPS();


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


    bool shouldSend = (cycleCounter >= batchSize) || (cycleCounter > 0 && LittleFS.exists(CACHE_FILE));

    if (shouldSend) {
      SerialMon.println(F("Batch size reached or old data exists. Attempting to send."));

      if (initializeModem() && connectGPRS()) {
        if (sendCachedData()) {
          cycleCounter = 0;
        }
        disconnectGPRS();
      } else {
        SerialMon.println(F("Failed to connect to GPRS. Data remains cached."));
      }
      powerOffModem();

    } else {
       SerialMon.println(F("Not sending yet. Going to sleep."));
    }


    if (isRegistered) {
      SerialMon.print(F("Device is registered. Next update in approx. ")); SerialMon.print(sleepTimeSeconds); SerialMon.println(F(" seconds."));
      enterDeepSleep(sleepTimeSeconds);
    } else {
      SerialMon.println(F("DEVICE NOT REGISTERED. Powering down permanently."));
      SerialMon.println(F("Please use OTA mode to register the device."));
      esp_deep_sleep_start();
    }
  }
}


void loop() {


}


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
  if (!modem.https_set_url(fullUrl)) {
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


  if (response_body.length() > 0) {
    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response_body);

    if (error) {
      SerialMon.print(F("deserializeJson() for server response failed: "));
      SerialMon.println(error.f_str());
    } else {

      if (serverResponseDoc["registered"] == false) {
        SerialMon.println(F("Server indicated device is not registered."));
        isRegistered = false;
      }


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




void appendToCache(String jsonRecord) {
  File file = LittleFS.open(CACHE_FILE, "a");
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


bool sendCachedData() {
  File file = LittleFS.open(CACHE_FILE, "r");
  if (!file) {
    SerialMon.println(F("Cache file not found. Nothing to send."));
    return true;
  }

  if (file.size() == 0) {
    SerialMon.println(F("Cache file is empty."));
    file.close();
    LittleFS.remove(CACHE_FILE);
    return true;
  }

  String payload = "[";
  bool first = true;
  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      if (!first) {
        payload += ",";
      }
      payload += line;
      first = false;
    }
  }
  payload += "]";
  file.close();

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
    SerialMon.println(F("Batch data sent successfully. Deleting cache."));
    LittleFS.remove(CACHE_FILE);
    return true;
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
    return false;
  }
}



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


bool gprsConnectedOTA = false;


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
      .update-link { margin-top: 20px; }
      a { color: #007bff; text-decoration: none; }
      a:hover { text-decoration: underline; }
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
      <div class="update-link">
        <a href="/update">Go to Firmware Update Page &raquo;</a>
      </div>
    </div>
  </body>
  </html>
)rawliteral";


void startOTAMode() {
  SerialMon.println(F("--- OTA Service Mode Activated ---"));


  SerialMon.println(F("Initializing Modem for OTA mode..."));
  if (initializeModem()) {
    SerialMon.println(F("Connecting to GPRS for OTA mode..."));
    gprsConnectedOTA = connectGPRS();
  } else {
    gprsConnectedOTA = false;
    SerialMon.println(F("Modem initialization failed. Registration will not be possible."));
  }


  SerialMon.println(F("Starting WiFi AP..."));
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ota_ssid, ota_password);
  IPAddress apIP = WiFi.softAPIP();
  SerialMon.print(F("AP IP address: ")); SerialMon.println(apIP);




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


  otaServer.on("/update", HTTP_GET, []() {
    String page_content = String(update_form_page);
    page_content.replace("%id%", deviceID);
    page_content.replace("%s", ota_ssid);
    otaServer.send(200, "text/html", page_content);
  });


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


    String page_content = String(ota_response_page_template);
    String message = "";

    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error && serverResponseDoc["success"] == true) {
      message = "Device registered successfully! Please reboot the device into normal mode.";
      page_content.replace("%status_class%", "ok");
    } else {
      message = "Registration failed. Please check credentials and try again.";

      if (response.length() > 0) {
        String server_msg = serverResponseDoc["error"].as<String>();
        message += "<br><small>Reason: " + server_msg + "</small>";
      }
      page_content.replace("%status_class%", "fail");
    }

    page_content.replace("%message%", message);
    otaServer.send(200, "text/html", page_content);
  });


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


  otaServer.begin();
  SerialMon.println(F("OTA Web Server started. Waiting for connections..."));


  while (true) {
    otaServer.handleClient();
    delay(1);
  }
}