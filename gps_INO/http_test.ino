/*  More information at: https://www.aeq-web.com/
 *  ESP32 SIM800 HTTP POST TEST | V 1.0_2020-AUG-18
 */
#include <Arduino.h>
#define TINY_GSM_MODEM_SIM800 // Modem type
#include <TinyGsmClient.h>    // For GPRS/HTTP client
#include <ArduinoJson.h>      // For JSON parsing and generation
#include "esp_sleep.h"        // For deep sleep functionality

// Define the serial port for communication with the modem
#define SerialAT Serial2

// Modem pins (adjust if your board differs)
#define SIM800L_RX     27
#define SIM800L_TX     26
#define SIM800L_PWRKEY 4  // Often used to power on/off the modem module
#define SIM800L_RST    5  // Optional, if you use reset
#define SIM800L_POWER  23 // If this pin controls overall power to the module

// Your GPRS credentials
const char apn[]      = "internet.t-mobile.cz"; // APN
const char gprsUser[] = "gprs";                 // GPRS User (if any)
const char gprsPass[] = "gprs";                 // GPRS Password (if any)

// Server details
const char server[]       = "129.151.193.104";
const int  port           = 5000;
const char resourcePost[] = "/device_input"; // Endpoint for POSTing data

// Device details and placeholder data (replace with actual GPS data later)
const char* deviceName = "ESP32-TestDevice-01";
double lat    = 50.08804;
double lon   = 14.42076;
double spd       = 10.5;
double alt    = 200.0;
double hdop    = 15.0;
int   satellites  = 7;

// Default sleep interval in seconds if server doesn't provide one or parsing fails
#define DEFAULT_SLEEP_SECONDS 60
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

// TinyGSM modem object
TinyGsm modem(SerialAT);
// TinyGSM client for HTTP
TinyGsmClient client(modem);

void powerOffModem() {
    Serial.println(F("Powering off modem..."));
    // Try a graceful shutdown first
    if (!modem.poweroff()) {
        Serial.println(F("Modem poweroff command failed or not supported."));
    }
    // Hard power off if a power control pin is defined and used
    #if defined(SIM800L_POWER)
      digitalWrite(SIM800L_POWER, LOW); // Cut power to the module
      Serial.println(F("Modem power pin set to LOW."));
    #endif
}

void enterDeepSleep(uint64_t seconds) {
  Serial.print(F("Entering deep sleep for "));
  Serial.print(seconds);
  Serial.println(F(" seconds..."));
  Serial.flush(); // Ensure all serial output is sent
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL); // Convert seconds to microseconds
  esp_deep_sleep_start();
}


void setup() {
  // Set console baud rate
  Serial.begin(115200);
  delay(10);











  Serial.println(F("\n--- ESP32 SIM800L POST Cycle ---"));

  // Power on the SIM800L module
  Serial.println(F("Powering on modem..."));
  #if defined(SIM800L_POWER)
    pinMode(SIM800L_POWER, OUTPUT);
    digitalWrite(SIM800L_POWER, HIGH); // Apply power to the module
    Serial.println(F("Modem power pin set to HIGH."));
    delay(500); // Give a moment for power to stabilize if SIM800L_POWER is a direct VCC control
  #endif

  #if defined(SIM800L_PWRKEY)
    pinMode(SIM800L_PWRKEY, OUTPUT);
    digitalWrite(SIM800L_PWRKEY, LOW);
    delay(1000); // Hold PWRKEY low for a second to initiate power-on sequence
    digitalWrite(SIM800L_PWRKEY, HIGH); // Release PWRKEY
    Serial.println(F("Modem PWRKEY toggled."));
  #endif
  
  Serial.println(F("Initializing modem serial..."));
  SerialAT.begin(9600, SERIAL_8N1, SIM800L_TX, SIM800L_RX);
  delay(3000); // Wait for modem to stabilize after serial begin

  Serial.println(F("Initializing modem logic..."));
  // modem.restart() can take a long time. modem.init() is faster if modem is already on.
  if (!modem.init()) { // Prefer init if modem is already powered by the PWRKEY sequence
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
  if (!modem.waitForNetwork(240000L, true)) { // Wait up to 4 minutes, with progress indication
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

  Serial.println(F("Performing HTTP POST request..."));
  
  // Prepare JSON document
  StaticJsonDocument<256> jsonDoc; // Adjust size if more data is needed
  jsonDoc["device"] = deviceName;
  jsonDoc["latitude"] = lat;
  jsonDoc["longitude"] = lon;
  jsonDoc["speed"] = spd;
  jsonDoc["altitude"] = alt;
  jsonDoc["accuracy"] = hdop;
  jsonDoc["satellites"] = satellites;
  
  String jsonData;
  serializeJson(jsonDoc, jsonData);
  Serial.print(F("JSON Payload: "));
  Serial.println(jsonData);

  if (!client.connect(server, port)) {
    Serial.println(F("Connect to server failed!"));
  } else {
    Serial.println(F("Connected to server."));
    // Send HTTP POST request
    client.print(F("POST ")); client.print(resourcePost); client.println(F(" HTTP/1.1"));
    client.print(F("Host: ")); client.println(server);
    client.println(F("Content-Type: application/json"));
    client.print(F("Content-Length: ")); client.println(jsonData.length());
    client.println(F("Connection: close"));
    client.println(); // Empty line before body
    client.print(jsonData);

    // Wait for server response (with timeout)
    unsigned long timeout = millis();
    while (client.connected() && client.available() == 0) {
      if (millis() - timeout > 10000L) { // 10 seconds timeout
        Serial.println(F(">>> Client Timeout !"));
        break;
      }
      delay(100); // Small delay to yield
    }

    if(client.available()){
        // Read response
        String responseBody = "";
        // Read HTTP status
        String status_line = client.readStringUntil('\n');
        Serial.print("Status: "); Serial.println(status_line);
        // Skip headers
        while (client.available()) {
            String line = client.readStringUntil('\n');
            line.trim(); // Remove trailing \r
            if (line.length() == 0) break; // Empty line indicates end of headers
        }
        // Read body
        while(client.available()){
          responseBody += (char)client.read();
        }
        Serial.print(F("Server Response Body: "));
        Serial.println(responseBody);

        // Parse JSON response
        StaticJsonDocument<128> responseDoc; // Adjust size as needed for server response
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

  Serial.print(F("Disconnecting GPRS..."));
  if(modem.gprsDisconnect()){
      Serial.println(F(" success"));
  } else {
      Serial.println(F(" fail"));
  }
  
  powerOffModem();
  enterDeepSleep(sleepTimeSeconds);
}

void loop() {
  // This part is not reached due to deep sleep and restart
}