#pragma once

#include <Arduino.h>
#include <WebServer.h>
#include <Update.h>
#include <WiFi.h>
#include <Preferences.h>
#include "config.h"
#include "ota_pages.h"

// Forward declarations for functions from other modules needed in OTA mode
// These are for testing GPRS/Server connection from the web interface
bool modem_initialize();
bool modem_connect_gprs(const String& apn, const String& user, const String& pass);
void modem_disconnect_gprs();
String modem_send_post_request(const char* resource, const String& payload);

// Function to start the OTA web server and handle updates/registration
void start_ota_mode();

// Global variables used in OTA mode
extern WebServer otaServer;
extern String ota_ssid;
extern String ota_password;
extern String deviceID;
extern String deviceName;
extern String apn;
extern String gprsUser;
extern String gprsPass;
extern String server;
extern int port;

// Function to load configuration from preferences (defined in file_system.cpp)
void fs_load_configuration();
