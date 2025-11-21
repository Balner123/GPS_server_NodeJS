#include "gps_control.h"
#include "config.h"

// Global GPS objects
HardwareSerial SerialGPS(1);
TinyGPSPlus gps;

// Global variables (declared extern in gps_control.h and other modules)
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

bool gpsFixObtained = false;
extern int minSatellitesForFix;

namespace {
volatile bool gpsAbortRequested = false;
volatile bool gpsLoopActive = false;
}

void gps_power_up() {
  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH);
  SerialMon.println(F("[GPS] Powering GPS module ON..."));
  delay(1000);
}

void gps_power_down() {
  digitalWrite(GPS_POWER_PIN, LOW);
  SerialMon.println(F("[GPS] GPS module powered OFF."));
}

void gps_init_serial() {
  SerialGPS.begin(GPS_BAUD_RATE, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SerialMon.printf("[GPS] HardwareSerial for GPS initialized on pins RX:%d, TX:%d at %d baud.\n", GPS_RX_PIN, GPS_TX_PIN, GPS_BAUD_RATE);
}

void gps_close_serial() {
  SerialGPS.end();
  SerialMon.println(F("[GPS] HardwareSerial for GPS closed."));
}

void gps_display_and_store_info() {
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
    gpsYear = 0;
    gpsMonth = 0;
    gpsDay = 0;
  }
  if (gps.time.isValid()) {
    gpsHour = gps.time.hour();
    gpsMinute = gps.time.minute();
    gpsSecond = gps.time.second();
  } else {
    gpsHour = 0;
    gpsMinute = 0;
    gpsSecond = 0;
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

bool gps_get_fix(unsigned long timeout) {
  unsigned long startTime = millis();
  unsigned long lastPrintTime = 0;
  gpsFixObtained = false;
  gpsAbortRequested = false;
  gpsLoopActive = true;

  SerialMon.print(F("[GPS] Attempting to get GPS fix (External)... (Timeout: "));
  SerialMon.print(timeout / 1000);
  SerialMon.println(F("s)"));

  while (millis() - startTime < timeout) {
    if (gpsAbortRequested) {
      SerialMon.println(F("[GPS] Fix attempt aborted."));
      break;
    }
    while (SerialGPS.available() > 0) {
      if (gpsAbortRequested) break; // Immediate exit if requested inside the read loop

      if (gps.encode(SerialGPS.read())) {
        if (gps.location.isUpdated() && gps.location.isValid() &&
            gps.date.isValid() && gps.time.isValid() &&
            gps.satellites.isValid() && (gps.satellites.value() >= minSatellitesForFix)) {
          gps_display_and_store_info();
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
      SerialMon.print(F("[GPS] Waiting for external GPS fix... Sats: "));
      SerialMon.print(gps.satellites.isValid() ? gps.satellites.value() : 0);
      SerialMon.print(F(", Valid Pos: "));
      SerialMon.print(gps.location.isValid());
      SerialMon.print(F(", Date Valid: "));
      SerialMon.print(gps.date.isValid());
      SerialMon.print(F(", Time Valid: "));
      SerialMon.println(gps.time.isValid());
    }
    delay(1); // Yield to other tasks but return quickly
  }

  if (!gpsFixObtained) {
    SerialMon.println(F("\n[GPS] GPS fix timeout (External)."));
  }
  gpsLoopActive = false;
  return gpsFixObtained;
}

void gps_request_abort() {
  gpsAbortRequested = true;
}

bool gps_is_active() {
  return gpsLoopActive;
}
