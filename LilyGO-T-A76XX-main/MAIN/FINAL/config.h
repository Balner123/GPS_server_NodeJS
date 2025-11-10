#pragma once

#ifdef ARDUINO
#include <Arduino.h>
#else
#include <stdint.h>
#endif

// --- Hardware Variant Selection ---
// Define the LilyGO board variant to pull in the correct pin map from utilities.h.
// Adjust the macro below if you are compiling for a different hardware revision.
#ifndef LILYGO_T_CALL_A7670_V1_0
#define LILYGO_T_CALL_A7670_V1_0
#endif

#include "utilities.h"

// Override status LED mapping to use dedicated GPIOs (Board power remains on GPIO12)
#undef STATUS_LED_PIN
#define STATUS_LED_PIN 19
#undef STATUS_LED_ON_LEVEL
#define STATUS_LED_ON_LEVEL HIGH
#undef STATUS_LED_OFF_LEVEL
#define STATUS_LED_OFF_LEVEL LOW

// --- Pin Definitions ---
#define PIN_EN          23  // ESP32 pin to hold power ON (HIGH = ON, LOW = OFF)
#define PIN_BTN         32  // ESP32 pin for the power/mode button (connected to GND, uses internal pull-up)
#define GPS_RX_PIN      34  // ESP32 RX <- GPS TX (input-only pin is sufficient)
#define GPS_TX_PIN      33  // ESP32 TX -> GPS RX
#define GPS_POWER_PIN   5   // ESP32 pin to control power to GPS module (via transistor)

// --- Button Logic Constants ---
const uint32_t BTN_DEBOUNCE_MS      = 80;    // Debounce time for button press in milliseconds
const uint32_t BTN_SHORT_PRESS_MS   = 500;   // Minimum duration for a short press (e.g., for shutdown)
const uint32_t BTN_LONG_PRESS_MS    = 2000;  // Minimum duration for a long press (e.g., for OTA mode)

// --- GPS Configuration ---
#define GPS_BAUD_RATE           9600
#define SAT_THRESHOLD           1   // Minimum satellites for a valid fix
const unsigned long GPS_ACQUISITION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for GPS fix attempt

// --- GPRS Configuration (Default values, can be overwritten by Preferences) ---
#define DEFAULT_APN             "internet.t-mobile.cz"
#define DEFAULT_GPRS_USER       "gprs"
#define DEFAULT_GPRS_PASS       "gprs"

// --- Server Configuration (Default values, can be overwritten by Preferences) ---
#define DEFAULT_SERVER_HOST     "lotr-system.xyz"
#define DEFAULT_SERVER_PORT     443
#define RESOURCE_POST           "/api/devices/input"
#define RESOURCE_REGISTER       "/api/devices/register"
#define RESOURCE_HANDSHAKE      "/api/devices/handshake"
#define CLIENT_TYPE             "HW"

// --- File System & Preferences ---
#define CACHE_FILE              "/gps_cache.log"
#define PREFERENCES_NAMESPACE   "gps-tracker"
#define KEY_BATCH_SIZE          "batch_size"

// --- Device & Sleep Configuration ---
#define DEFAULT_DEVICE_NAME     "NEO-6M_A7670E"
const uint64_t DEFAULT_SLEEP_SECONDS = 60;

// --- OTA Configuration (Default values, can be overwritten by Preferences) ---
#define DEFAULT_OTA_SSID        "lotrTrackerOTA"
#define DEFAULT_OTA_PASSWORD    "password"

// --- Serial Debug ---
#define SerialMon Serial
// #define TINY_GSM_DEBUG SerialMon // Uncomment for TinyGSM internal debug
// #define DUMP_AT_COMMANDS // Uncomment to see all AT commands
