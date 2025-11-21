#pragma once

#include <Arduino.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "config.h"

// Forward declarations for functions from other modules
// These are needed for send_cached_data and graceful_shutdown
// (Removed to avoid conflict with modem_control.h)

// Global variables that need to be accessible by file_system functions
extern String deviceID;
extern String deviceName;
extern String apn;
extern String gprsUser;
extern String gprsPass;
extern String server;
extern int port;
extern uint64_t sleepTimeSeconds;
extern bool isRegistered;
extern int minSatellitesForFix;
extern String operationMode;
extern int batchSizeThreshold; // Minimum number of cached records to trigger a send

// Function to initialize LittleFS and Preferences
bool fs_init();

// Function to load configuration from Preferences into global variables
void fs_load_configuration();

// Apply configuration data received from server handshake/response
void fs_apply_server_config(const JsonVariantConst& config);

// Persist registration flag changes from server
void fs_set_registered(bool registered);

// Function to end LittleFS and Preferences
void fs_end();

// Function to append a JSON record to the cache file
void append_to_cache(String jsonRecord);

// Function to send cached data to the server
bool send_cached_data();
bool fs_cache_exists();

// Helper functions for OTA cache management
size_t fs_get_cache_size();
size_t fs_get_cache_record_count(); // New function to count records
void fs_clear_cache();
void fs_reset_tracking_defaults();
