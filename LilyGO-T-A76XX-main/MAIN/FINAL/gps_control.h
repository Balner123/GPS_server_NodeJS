#pragma once

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h> // Include HardwareSerial for ESP32

// Global GPS objects
extern HardwareSerial SerialGPS;
extern TinyGPSPlus gps;

// Forward declarations for global variables used by GPS functions
extern double gpsLat, gpsLon, gpsSpd, gpsAlt, gpsHdop;
extern int gpsSats;
extern uint16_t gpsYear;
extern uint8_t gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond;
extern bool gpsFixObtained;
extern int minSatellitesForFix;

// Function to power up the GPS module
void gps_power_up();

// Function to power down the GPS module
void gps_power_down();

// Function to initialize SoftwareSerial for GPS communication
void gps_init_serial();

// Function to close SoftwareSerial for GPS communication
void gps_close_serial();

// Function to wait for and get a GPS fix
bool gps_get_fix(unsigned long timeout);

// Function to display and store GPS information
void gps_display_and_store_info();

// Request that any ongoing GPS fix attempt abort as soon as possible
void gps_request_abort();

// Returns true if a GPS fix attempt is currently running
bool gps_is_active();
