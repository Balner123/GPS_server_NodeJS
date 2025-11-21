#pragma once

#include <Arduino.h>
#include "config.h"
#include <TinyGsmClient.h>

// Global modem objects
extern TinyGsm g_modem;
extern TinyGsmClient g_client;

// Forward declarations for global variables used by modem functions
extern String apn;
extern String gprsUser;
extern String gprsPass;
extern String server;
extern int port;
extern String deviceID;
extern String deviceName;
extern bool isRegistered;
extern uint64_t sleepTimeSeconds;
extern int minSatellitesForFix;

// Function to initialize the modem
bool modem_initialize();

// Function to connect to GPRS
bool modem_connect_gprs(const String& apn_val, const String& user_val, const String& pass_val, uint32_t timeout_ms = 240000L);

// Function to send a POST request to the server
String modem_send_post_request(const char* resource, const String& payload, int* statusCodeOut = nullptr);

// Perform handshake with backend to sync config and power instructions
bool modem_perform_handshake();

// Function to disconnect from GPRS
void modem_disconnect_gprs();

// Function to power off the modem
void modem_power_off();

// Simple TCP connectivity test against the configured server/port
bool modem_test_server_connection(const String& host, int port);
