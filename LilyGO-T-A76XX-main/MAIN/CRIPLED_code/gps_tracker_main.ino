// Include project-specific headers
#include "web_pages.h"
#include "gps_functions.h"
#include "modem_functions.h"

// Include general libraries
#include "utilities.h"       // For board-specific definitions
#include <TinyGsmClient.h>
#include <ArduinoJson.h>     // For creating JSON payloads
#include "esp_sleep.h"       // For deep sleep functionality
#include "esp_timer.h"       // For high-resolution timer in ISR
#include <TinyGPS++.h>       // For external GPS module
#include <SoftwareSerial.h>  // For external GPS module communication
#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include <LittleFS.h>
#include <Preferences.h>

// FreeRTOS for handling button presses without polling
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

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
#define SAT_THRESHOLD 1   // Minimum satellites for a valid fix
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
// const int otaPin = 23; // OLD: GPIO pin for OTA mode switch (connect to 3.3V for OTA mode)
// Default OTA SSID will be finalized after DeviceID is known in setup()
String ota_ssid = "lotrTrackerOTA";
String ota_password = "password";

// --- Soft Power / Button ---
#define PIN_EN 23
#define PIN_BTN 25
const uint32_t BTN_DEBOUNCE_US = 50000; // 50ms for ISR debounce
const uint32_t BTN_LONG_PRESS_US = 3000000; // 3 seconds for long press
RTC_DATA_ATTR bool bootToOtaFlag = false;

const uint32_t BTN_LONG_PRESS_MS = 3000; // 3 seconds for long press (for initial boot)

// --- FreeRTOS handles for button logic ---
static TaskHandle_t shutdownTaskHandle = nullptr;
volatile uint32_t g_lastEdgeUs = 0;
volatile bool g_buttonPressed = false;


WebServer otaServer(80);

Preferences preferences;
RTC_DATA_ATTR int cycleCounter = 0; // Counts boot cycles, survives deep sleep

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

// ------------------------- Function Prototypes -----------------------------
void startOTAMode();
void loadConfiguration();
void enterDeepSleep(uint64_t seconds);
void gracefulShutdownAndPowerOff();
void ShutdownTask(void* pvParameters);
void IRAM_ATTR onButtonISR();

// ----------------------------- Setup ---------------------------------------
void setup() {
  // --- Initial hardware setup ---
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH);
  pinMode(PIN_BTN, INPUT_PULLUP);

  SerialMon.begin(115200);
  delay(100);

  // --- Create Button Handling Task ---
  // This task handles debouncing and differentiating short/long presses.
  xTaskCreatePinnedToCore(
    ShutdownTask,
    "ShutdownTask",
    2048,
    NULL,
    configMAX_PRIORITIES - 1, // High priority
    &shutdownTaskHandle,
    0 // Core 0
  );

  // --- Attach Interrupt ---
  // The ISR only notifies the task, keeping it extremely fast.
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), onButtonISR, CHANGE);


  // Load configuration from Preferences
  loadConfiguration();

  // --- Wakeup Reason Handling ---
  esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
  bool isFirstBoot = (wakeup_reason != ESP_SLEEP_WAKEUP_TIMER && wakeup_reason != ESP_SLEEP_WAKEUP_EXT0);

  if (isFirstBoot) {
      SerialMon.println(F("First boot detected. Checking for long press to enter OTA..."));
      delay(1000); // Wait 1s for stabilization

      if (digitalRead(PIN_BTN) == LOW) {
          SerialMon.println(F("Button still held, monitoring for long press..."));
          uint32_t monitoringStartTime = millis();
          while (digitalRead(PIN_BTN) == LOW) {
              if (millis() - monitoringStartTime > (BTN_LONG_PRESS_MS - 1000)) {
                  SerialMon.println(F("Long press from OFF confirmed. Starting OTA mode."));
                  loadConfiguration();
                  String mac = WiFi.macAddress(); mac.replace(":", "");
                  String shortMac = mac.substring(mac.length() - 10);
                  deviceID = strdup(shortMac.c_str());
                  if (ota_ssid.length() == 0 || ota_ssid == "lotrTrackerOTA") { ota_ssid = String("lotrTrackerOTA_") + deviceID; }
                  startOTAMode(); // This loops forever
              }
              delay(50);
          }
      }
  }

  if (wakeup_reason == ESP_SLEEP_WAKEUP_EXT0) {
      SerialMon.println(F("Woken up by button from deep sleep."));
      // Simple polling for the 4-second service window
      unsigned long windowStart = millis();
      while (millis() - windowStart < 4000) {
          if (digitalRead(PIN_BTN) == LOW) {
              delay(80); // Debounce
              if (digitalRead(PIN_BTN) == LOW) {
                  SerialMon.println(F("Shutdown requested within service window."));
                  gracefulShutdownAndPowerOff();
              }
          }
          delay(20);
      }
      SerialMon.println(F("Service window closed."));
  }

  // --- Proceed with normal GPS cycle ---
  SerialMon.println(F("Starting GPS Tracker cycle."));

  // --- Create Shutdown Task and attach ISR for main operation ---
  xTaskCreatePinnedToCore(ShutdownTask, "ShutdownTask", 4096, nullptr, configMAX_PRIORITIES - 1, &shutdownTaskHandle, 0);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), onButtonISR, FALLING);

  // Load configuration, set up device ID, etc.
  loadConfiguration();
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String shortMac = mac.substring(mac.length() - 10);
  deviceID = strdup(shortMac.c_str());
  SerialMon.print(F("Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);
  if (ota_ssid.length() == 0 || ota_ssid == "lotrTrackerOTA") {
    ota_ssid = String("lotrTrackerOTA_") + deviceID;
  }

  // 1. Initialize Filesystem and Preferences
  if(!LittleFS.begin()){
      SerialMon.println(F("An Error has occurred while mounting LittleFS"));
      enterDeepSleep(DEFAULT_SLEEP_SECONDS);
      return;
  }
  preferences.begin(PREFERENCES_NAMESPACE, false);
  uint8_t batchSize = preferences.getUChar(KEY_BATCH_SIZE, 1);

  // 2. Get GPS Data
  SerialMon.println(F("--- Initializing External GPS ---"));
  powerUpGPS();
  initGPSSerial();
  waitForGPSFix(GPS_ACQUISITION_TIMEOUT_MS); // Button presses are handled by ISR now
  closeGPSSerial();
  powerDownGPS();

  // 3. Cache data point
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
  }
  else {
      SerialMon.println(F("Not sending yet. Going to sleep."));
  }

  // 5. Go to sleep
  preferences.end();
  if (isRegistered) {
    SerialMon.print(F("Device is registered. Next update in approx. ")); SerialMon.print(sleepTimeSeconds); SerialMon.println(F(" seconds."));
    enterDeepSleep(sleepTimeSeconds);
  } else {
    SerialMon.println(F("DEVICE NOT REGISTERED. Powering down."));
    gracefulShutdownAndPowerOff();
  }
}

void enterDeepSleep(uint64_t seconds) {
  SerialMon.print(F("Entering deep sleep for "));
  SerialMon.print(seconds);
  SerialMon.println(F(" seconds..."));
  SerialMon.flush(); 
  // Detach interrupt before sleeping to prevent issues on wake
  detachInterrupt(digitalPinToInterrupt(PIN_BTN));
  // Enable wakeup by timer
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
  // Enable wakeup by button (on LOW level)
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_25, 0); 
  esp_deep_sleep_start();
}

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

void gracefulShutdownAndPowerOff() {
    SerialMon.println(F("Performing graceful shutdown..."));
    // Detach interrupt to prevent any further triggers during shutdown
    detachInterrupt(digitalPinToInterrupt(PIN_BTN));

    // Close connections and peripherals
    disconnectGPRS(); // From modem_functions.h
    powerDownGPS();   // From gps_functions.h
    closeGPSSerial(); // From gps_functions.h
        if (LittleFS.begin()) { // Check if FS is mounted before trying to end it
          LittleFS.end();
      }
      SerialMon.println(F("Powering off now."));
      SerialMon.flush();
      digitalWrite(PIN_EN, LOW); // Cut power
      // Code will stop executing here
}

void IRAM_ATTR onButtonISR() {
  BaseType_t xHigherPriorityTaskWoken = pdFALSE;
  vTaskNotifyGiveFromISR(shutdownTaskHandle, &xHigherPriorityTaskWoken);
  if (xHigherPriorityTaskWoken) {
    portYIELD_FROM_ISR();
  }
}

void ShutdownTask(void* pvParameters) {
  uint32_t pressStartTime = 0;
  bool wasPressed = false;

  for (;;) {
    // Wait for a notification from the ISR
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    // Debounce and process press/release
    bool isPressed = (digitalRead(PIN_BTN) == LOW);

    if (isPressed && !wasPressed) {
      // --- Button was just pressed ---
      pressStartTime = millis();
      wasPressed = true;
    } else if (!isPressed && wasPressed) {
      // --- Button was just released ---
      uint32_t pressDuration = millis() - pressStartTime;
      if (pressDuration >= 3000) { // 3 seconds for long press
        SerialMon.println(F("Long press detected. Rebooting to OTA mode."));
        bootToOtaFlag = true;
        ESP.restart();
      } else if (pressDuration >= 80) { // 80ms for short press
        SerialMon.println(F("Short press detected. Shutting down."));
        gracefulShutdownAndPowerOff();
      }
      wasPressed = false;
    }
  }
}


// ------------------------------ Loop ---------------------------------------

void loop() {
  // This part is not reached due to deep sleep in setup() for GPS mode
  // Or due to infinite loop in startOTAMode() for OTA mode
}



// --- Global variable for GPRS connection status in OTA ---
bool gprsConnectedOTA = false;

// --- OTA Mode Function Implementation ---
void startOTAMode() {
  SerialMon.println(F("--- OTA Service Mode Activated ---"));

  // --- Create Shutdown Task and attach ISR for OTA operation ---
  xTaskCreatePinnedToCore(ShutdownTask, "ShutdownTask", 4096, nullptr, configMAX_PRIORITIES - 1, &shutdownTaskHandle, 0);
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), onButtonISR, FALLING);

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
    vTaskDelay(pdMS_TO_TICKS(5)); // Small delay to prevent watchdog timeout and yield to other tasks
  }
}