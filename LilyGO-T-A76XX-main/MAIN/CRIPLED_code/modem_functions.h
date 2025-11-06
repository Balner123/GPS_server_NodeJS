#pragma once

#include <Arduino.h>
#include "utilities.h"
#include <TinyGsmClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <Preferences.h>

// Forward declarations
extern TinyGsm modem;
extern String apn;
extern String gprsUser;
extern String gprsPass;
extern String server;
extern int port;
extern const char* deviceID;
extern String deviceName;
extern bool gpsFixObtained;
extern double gpsLat, gpsLon, gpsSpd, gpsAlt, gpsHdop;
extern int gpsSats;
extern uint16_t gpsYear;
extern uint8_t gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond;
extern uint64_t sleepTimeSeconds;
extern Preferences preferences;
extern bool isRegistered;
extern int minSatellitesForFix;

#define SerialMon Serial
#define SerialAT Serial1
#define CACHE_FILE "/gps_cache.log"
#define KEY_BATCH_SIZE "batch_size"

// Function Prototypes
String sendPostRequest(const char* resource, const String& payload);


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

  String scheme = (port == 80) ? String("http") : String("https");
  String fullUrl = scheme + "://" + server;
  if ((scheme == "http" && port != 80) || (scheme == "https" && port != 443)) {
    fullUrl += ":";
    fullUrl += String(port);
  }
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
  
  String response_body = sendPostRequest("/api/devices/input", jsonData);
  
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
  } else {
    SerialMon.println(F("Modem powered off via TinyGSM."));
  }
  delay(1000);
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
  const int MAX_BATCH_SIZE = 50;
  bool allDataSent = true;

  while (true) {
    File file = LittleFS.open(CACHE_FILE, "r");
    if (!file || file.size() == 0) {
      if (file) file.close();
      if (allDataSent) {
        SerialMon.println(F("Cache is empty. All data sent."));
        LittleFS.remove(CACHE_FILE);
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
      LittleFS.remove(CACHE_FILE);
      return true;
    }

    SerialMon.printf("Sending batch of %d records...\n", recordCount);
    String response = sendPostRequest("/api/devices/input", payload);

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
