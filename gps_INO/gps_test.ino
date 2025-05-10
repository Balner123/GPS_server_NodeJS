#include <Arduino.h>
#include <TinyGPS++.h>
#include <SoftwareSerial.h>

// --- CONFIGURATION ---

#define GPS_RX_PIN   32    // ESP32 RX connected to GPS TX
#define GPS_TX_PIN   33    // ESP32 TX connected to GPS RX (often unused for GPS-only)
#define GPS_POWER_PIN 25   // pin to power GPS module (high = on)
#define SAT_THRESHOLD 4    // number of satellites minimum for fix

#define DEFAULT_SLEEP_SECONDS 60
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;

// --- GLOBALS ---
SoftwareSerial SerialGPS(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

  double lat;
  double lon;
  int sats;
  double spd;
  double alt;
  double hdop;

// --- FUNCTION PROTOTYPES ---
void initSerial();
void powerUpGPS();
void powerDownGPS();
void initGPSSerial();
void closeGPSSerial();
void displayGPSInfo();
bool waitForGPSFix(unsigned long timeout);
void enterDeepSleep();

// --- MAIN ---
void setup() {
  initSerialDebug();
  powerUpGPS();
  initGPSSerial();

  Serial.println("Waiting up to 5 minutes for GPS fix...");
  bool gotFix = waitForGPSFix(5UL * 60UL * 1000UL); // 5 min timeout

  closeGPSSerial();
  powerDownGPS();
  Serial.println(gotFix ? "GPS fix obtained, powering down GPS." : "Timeout, no GPS fix, powering down GPS.");

  enterDeepSleep();
}

void loop() {
  // Empty, ESP32 restarts after deep sleep
}
// --- FUNCTION DEFINITIONS ---

void initSerialDebug() {
  Serial.begin(115200);
  delay(100); // Allow serial to stabilize
  Serial.println("\n--- GPS-Only Tracker ---");
}

void powerUpGPS() {
  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH); // Power ON GPS
  Serial.println("Powering GPS module ON...");
  delay(1000); // Allow GPS module to boot
}

void powerDownGPS() {
  digitalWrite(GPS_POWER_PIN, LOW); // Power OFF GPS
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
          break; // Exit inner while loop
        }
      }
    }

    if (gotFix) {
      break; // Exit outer while loop
    }

    if (millis() - lastPrint >= 5000) { // Status every 5s
      lastPrint = millis();
      Serial.print("Waiting... Sat: ");
      Serial.print(gps.satellites.isValid() ? gps.satellites.value() : 0);
      Serial.print(", Valid Pos: "); Serial.print(gps.location.isValid());
      Serial.print(", Updated: "); Serial.println(gps.location.isUpdated());
    }
    delay(10); // Pace loop
  }
  return gotFix;
}

void enterDeepSleep() {
  Serial.println("Entering deep sleep now...");
  Serial.flush(); // Ensure all serial data is sent
  esp_sleep_enable_timer_wakeup(DEFAULT_SLEEP_SECONDS * 1000000ULL);
  esp_deep_sleep_start();
}
