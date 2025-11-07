#pragma once

#include <Arduino.h>
#include <WebServer.h>
#include <Update.h>
#include <WiFi.h>
#include <Preferences.h>
#include "config.h"
#include "ota_pages.h"
#include "modem_control.h"

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
