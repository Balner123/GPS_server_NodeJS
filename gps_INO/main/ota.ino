// Combined OTA Handler and GPS Tracker Sketch
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Update.h>

// --- Configuration for Mode Switch ---
const int MODE_SWITCH_PIN = 4; // GPIO4 used for mode switch. Change if needed.
const int OTA_MODE_STATE = LOW;    // Switch connected to GND for OTA mode
const int GPS_MODE_STATE = HIGH;   // Switch open/to VCC for GPS mode

bool inOtaMode = false;

// --- Configuration for OTA Access Point (if in OTA mode) ---
const char* ap_ssid = "ESP32_OTA_Updater";
const char* ap_password = "password123";   // Min 8 characters

WebServer server(80);

const char* serverIndex_html =
  "<form method='POST' action='/update' enctype='multipart/form-data'>"
  "<h3>ESP32 Firmware Update</h3>"
  "<input type='file' name='update' accept='.bin'><br><br>"
  "<input type='submit' value='Update ESP32'>"
  "</form>";

// --- Placeholder for GPS Tracker Includes (add yours here) ---
// #include <TinyGPS++.h>
// #include <SoftwareSerial.h> // If using SoftwareSerial for GPS
// #include "your_modem_library.h" // If using a specific modem library

// --- Placeholder for GPS Tracker Global Variables (add yours here) ---
// Example:
// TinyGPSPlus gps;
// SoftwareSerial ssGPS(RX_PIN, TX_PIN);
// const uint32_t GPS_BAUD = 9600;
// const int DEEP_SLEEP_SECONDS = 300; // 5 minutes


// ================================================================
// SETUP FUNCTION - Decides mode based on switch
// ================================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\nBooting ESP32...");

  pinMode(MODE_SWITCH_PIN, INPUT_PULLUP);
  delay(100); // Small delay for pin to stabilize

  if (digitalRead(MODE_SWITCH_PIN) == OTA_MODE_STATE) {
    inOtaMode = true;
    Serial.println("Mode Switch: OTA Update Mode Activated.");
    setupOtaMode();
  } else {
    inOtaMode = false;
    Serial.println("Mode Switch: GPS Tracker Mode Activated.");
    setupGpsTrackerMode();
    // Note: If setupGpsTrackerMode() directly goes to deep sleep,
    // then loopGpsTrackerMode() might not be called until next wakeup.
  }
}

// ================================================================
// LOOP FUNCTION - Calls appropriate loop based on mode
// ================================================================
void loop() {
  if (inOtaMode) {
    loopOtaMode();
  } else {
    // If GPS tracker code uses deep sleep, this loop might only run
    // briefly after wakeup, or if the main GPS cycle is here.
    loopGpsTrackerMode();
  }
}

// ================================================================
// OTA MODE SPECIFIC FUNCTIONS
// ================================================================
void setupOtaMode() {
  Serial.print("Setting up OTA Access Point: ");
  Serial.println(ap_ssid);
  WiFi.softAP(ap_ssid, ap_password);

  IPAddress AP_IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(AP_IP);
  Serial.println("Connect to this Wi-Fi to upload firmware.");

  if (MDNS.begin("esp32")) {
    Serial.println("MDNS responder started. Try http://esp32.local/");
    MDNS.addService("http", "tcp", 80);
  } else {
    Serial.println("Error setting up MDNS responder");
  }

  server.on("/", HTTP_GET, []() {
    server.sendHeader("Connection", "close");
    server.send(200, "text/html", serverIndex_html);
  });

  server.on("/update", HTTP_POST, []() {
    server.sendHeader("Connection", "close");
    server.send(200, "text/plain", (Update.hasError()) ? "FAIL - Check Serial" : "OK - Restarting");
    delay(100);
    ESP.restart();
  }, []() {
    HTTPUpload& upload = server.upload();
    if (upload.status == UPLOAD_FILE_START) {
      Serial.printf("Update: %s\n", upload.filename.c_str());
      if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { // U_FLASH or specific partition if needed
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) {
        Serial.printf("Update Success: %u bytes\n", upload.totalSize);
      } else {
        Update.printError(Serial);
      }
    }
  });

  server.begin();
  Serial.println("HTTP server started for OTA updates.");
  Serial.print("Open http://");
  Serial.print(AP_IP);
  Serial.println(" or http://esp32.local/ in your browser.");
}

void loopOtaMode() {
  server.handleClient();
  delay(1); // Keep OTA responsive
}

// ================================================================
// GPS TRACKER MODE SPECIFIC FUNCTIONS (PLACEHOLDERS)
// ================================================================
void setupGpsTrackerMode() {
  Serial.println("Initializing GPS Tracker components...");
  // ** YOUR GPS & MODEM INITIALIZATION CODE GOES HERE **
  // Example:
  // SerialGPS.begin(GPS_BAUD);
  // initModem(); // Your function to setup GPRS modem
  // if (!connectToGPRS()) { Serial.println("GPRS Connection Failed!"); }

  Serial.println("GPS Tracker setup complete. Starting first cycle or preparing for deep sleep.");
  // You might want to run the first GPS cycle here or directly go to sleep
  // runGpsTrackerCycle(); // Example: run first cycle immediately
}

void loopGpsTrackerMode() {
  // ** YOUR MAIN GPS TRACKER LOGIC (IF NOT HANDLED BY DEEP SLEEP CYCLES) GOES HERE **
  // This function will be called repeatedly if not using deep sleep,
  // or once after each wakeup if deep sleep is managed within runGpsTrackerCycle().

  Serial.println("GPS Tracker loop running (or waking from sleep)...");
  runGpsTrackerCycle(); // Example: run a cycle, then sleep

  // If not sleeping inside runGpsTrackerCycle, manage delays or sleep here
  // delay(10000); // Example: wait 10 seconds before next cycle if not using deep sleep
}

// --- Helper function for a single GPS tracker cycle ---
void runGpsTrackerCycle() {
  Serial.println("Executing GPS Tracker Cycle...");
  // ** YOUR CODE FOR ONE GPS CYCLE (READ, PROCESS, SEND, SLEEP) GOES HERE **

  // 1. Power up GPS (if needed)
  // 2. Get GPS fix
  // 3. Get data from other sensors (if any)
  // 4. Connect to GPRS/internet (if not already connected)
  // 5. Send data to server
  // 6. Disconnect GPRS (if needed)
  // 7. Power down GPS/Modem (if needed)
  // 8. Go to deep sleep

  Serial.println("GPS Cycle finished. Preparing for deep sleep (example).");
  // enterDeepSleepTracker(DEEP_SLEEP_SECONDS); // Example
  
  // For testing without deep sleep, you can add a delay:
  Serial.println("Simulating work and delay instead of deep sleep for now.");
  delay(15000); // Remove this if using actual deep sleep
}

// --- Helper function for deep sleep ---
void enterDeepSleepTracker(uint32_t sleepSeconds) {
  Serial.printf("Entering deep sleep for %d seconds.\n", sleepSeconds);
  esp_sleep_enable_timer_wakeup(sleepSeconds * 1000000ULL);
  esp_deep_sleep_start();
}

// You will need to add your specific functions for:
// - Powering up/down GPS & Modem
// - Initializing GPS & Modem
// - Reading GPS data
// - Connecting to GPRS
// - Sending HTTP POST/MQTT requests
// - etc.