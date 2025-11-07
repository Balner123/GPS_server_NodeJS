#pragma once

#include <Arduino.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "config.h"

// Forward declarations for functions from other modules
// These are needed for send_cached_data and graceful_shutdown
String modem_send_post_request(const char* resource, const String& payload, int* statusCodeOut);
void modem_disconnect_gprs();
bool modem_initialize();
bool modem_connect_gprs(const String& apn, const String& user, const String& pass);

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
