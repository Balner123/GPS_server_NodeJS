#include "modem_control.h"
#include <ArduinoJson.h>
#include <TinyGsmClient.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "power_management.h"
#include "file_system.h"

// Global modem objects
#ifdef DUMP_AT_COMMANDS
#include <StreamDebugger.h>
StreamDebugger debugger(SerialAT, SerialMon);
TinyGsm g_modem(debugger);
#else
TinyGsm g_modem(SerialAT);
#endif
TinyGsmClient g_client(g_modem);

namespace {
portMUX_TYPE g_modem_mutex_init_mux = portMUX_INITIALIZER_UNLOCKED;
SemaphoreHandle_t g_modem_mutex = nullptr;
bool g_modem_initialized = false;
bool g_modem_gprs_connected = false;

inline void mark_modem_offline() {
  g_modem_initialized = false;
  g_modem_gprs_connected = false;
}

SemaphoreHandle_t get_modem_mutex() {
  if (g_modem_mutex == nullptr) {
    portENTER_CRITICAL(&g_modem_mutex_init_mux);
    if (g_modem_mutex == nullptr) {
      g_modem_mutex = xSemaphoreCreateRecursiveMutex();
    }
    portEXIT_CRITICAL(&g_modem_mutex_init_mux);
  }
  return g_modem_mutex;
}

class ModemLockGuard {
 public:
  explicit ModemLockGuard(TickType_t timeout = portMAX_DELAY) {
    mutex_ = get_modem_mutex();
    locked_ = (mutex_ != nullptr) && (xSemaphoreTakeRecursive(mutex_, timeout) == pdTRUE);
  }

  ~ModemLockGuard() {
    if (locked_) {
      xSemaphoreGiveRecursive(mutex_);
    }
  }

  bool isLocked() const { return locked_; }

 private:
  SemaphoreHandle_t mutex_ = nullptr;
  bool locked_ = false;
};
} // namespace

// Global variables (declared extern in modem_control.h and other modules)
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

bool modem_initialize() {
  ModemLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[MODEM] Unable to acquire modem lock for initialization."));
    return false;
  }
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MODEM] Initialization skipped due to shutdown request."));
    return false;
  }
  if (g_modem_initialized) {
    SerialMon.println(F("[MODEM] Modem already initialized."));
    return true;
  }
  SerialMon.println(F("[MODEM] Initializing modem..."));

#ifdef BOARD_POWERON_PIN
  pinMode(BOARD_POWERON_PIN, OUTPUT);
  digitalWrite(BOARD_POWERON_PIN, HIGH);
#endif

#ifdef MODEM_RESET_PIN
  SerialMon.println(F("[MODEM] Resetting modem..."));
  pinMode(MODEM_RESET_PIN, OUTPUT);
  digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
  delay(100);
  digitalWrite(MODEM_RESET_PIN, MODEM_RESET_LEVEL);
  delay(2600);
  digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
  delay(500);
#endif

  SerialMon.println(F("[MODEM] Toggling PWRKEY..."));
  pinMode(BOARD_PWRKEY_PIN, OUTPUT);
  digitalWrite(BOARD_PWRKEY_PIN, LOW);
  delay(100);
  digitalWrite(BOARD_PWRKEY_PIN, HIGH);
  delay(1000);
  digitalWrite(BOARD_PWRKEY_PIN, LOW);

  SerialMon.println(F("[MODEM] Waiting for modem to boot..."));
  delay(3000);

  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  SerialMon.println(F("[MODEM] SerialAT configured."));
  delay(1000);

  SerialMon.println(F("[MODEM] Testing AT command response..."));
  int retry = 0;
#define MAX_AT_RETRIES 15
  while (!g_modem.testAT(1000)) {
    if (shutdown_is_requested()) {
      SerialMon.println(F("[MODEM] AT test aborted by shutdown."));
      mark_modem_offline();
      return false;
    }
    SerialMon.print(F("."));
    if (retry++ >= MAX_AT_RETRIES) {
      SerialMon.println(F("\n[MODEM] Failed to get AT response after multiple attempts. Trying to power cycle PWRKEY again."));
      digitalWrite(BOARD_PWRKEY_PIN, LOW);
      delay(100);
      digitalWrite(BOARD_PWRKEY_PIN, HIGH);
      delay(1000);
      digitalWrite(BOARD_PWRKEY_PIN, LOW);
      delay(3000);
      retry = 0;
      if (retry++ >= MAX_AT_RETRIES / 3) {
        SerialMon.println(F("\n[MODEM] Still no AT response after power cycle. Giving up."));
        mark_modem_offline();
        return false;
      }
    }
    if (retry > 5) delay(500);
  }
  SerialMon.println(F("\n[MODEM] AT command responded."));

  SerialMon.println(F("[MODEM] Initializing modem with modem.init()..."));
  if (!g_modem.init()) {
    SerialMon.println(F("[MODEM] Modem init failed. Trying restart..."));
    delay(1000);
    if (!g_modem.restart()) {
      SerialMon.println(F("[MODEM] Modem restart also failed!"));
      mark_modem_offline();
      return false;
    }
    SerialMon.println(F("[MODEM] Modem restart successful."));
  } else {
    SerialMon.println(F("[MODEM] Modem init successful."));
  }

  String modemInfo = g_modem.getModemInfo();
  SerialMon.print(F("[MODEM] Modem Info: "));
  SerialMon.println(modemInfo);
  if (modemInfo.indexOf("A76") == -1) {
    SerialMon.println(F("[MODEM] Warning: Modem info does not look like A76XX series."));
  }
  g_modem_initialized = true;
  return true;
}

bool modem_connect_gprs(const String& apn_val, const String& user_val, const String& pass_val) {
  ModemLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[MODEM] Unable to acquire modem lock for GPRS connect."));
    return false;
  }
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MODEM] GPRS connect skipped due to shutdown request."));
    return false;
  }
  if (!g_modem_initialized) {
    SerialMon.println(F("[MODEM] Cannot connect GPRS: modem not initialized."));
    return false;
  }
  SerialMon.print(F("[MODEM] Waiting for network..."));
  if (!g_modem.waitForNetwork(240000L, true)) {
    SerialMon.println(F(" fail"));
    g_modem_gprs_connected = false;
    return false;
  }
  SerialMon.println(F(" success"));

  SerialMon.print(F("[MODEM] Connecting to GPRS: "));
  SerialMon.print(apn_val);
  if (!g_modem.gprsConnect(apn_val.c_str(), user_val.c_str(), pass_val.c_str())) {
    SerialMon.println(F(" fail"));
    g_modem_gprs_connected = false;
    return false;
  }
  SerialMon.println(F(" success"));
  SerialMon.print(F("[MODEM] GPRS IP: "));
  SerialMon.println(g_modem.getLocalIP());
  g_modem_gprs_connected = true;
  return true;
}

String modem_send_post_request(const char* resource, const String& payload, int* statusCodeOut) {
  ModemLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[MODEM] Unable to acquire modem lock for HTTPS POST."));
    return "";
  }
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MODEM] HTTPS POST skipped due to shutdown request."));
    return "";
  }
  if (!g_modem_initialized) {
    SerialMon.println(F("[MODEM] Cannot perform HTTPS POST: modem not initialized."));
    return "";
  }
  SerialMon.print(F("[MODEM] Performing HTTPS POST to: "));
  SerialMon.println(resource);
  SerialMon.print(F("[MODEM] Payload: "));
  SerialMon.println(payload);

  String response_body = "";

  if (!g_modem.https_begin()) {
    SerialMon.println(F("[MODEM] Failed to begin HTTPS session."));
    return "";
  }

  // Build full URL adaptively based on configured port
  String scheme = (port == 80) ? String("http") : String("https");
  String fullUrl = scheme + "://" + server;
  if ((scheme == "http" && port != 80) || (scheme == "https" && port != 443)) {
    fullUrl += ":";
    fullUrl += String(port);
  }
  fullUrl += resource;

  SerialMon.print(F("[MODEM] Set URL: "));
  SerialMon.println(fullUrl);
  if (!g_modem.https_set_url(fullUrl.c_str())) {
    SerialMon.println(F("[MODEM] Failed to set URL."));
  g_modem.https_end();
    return "";
  }

  SerialMon.println(F("[MODEM] Set Content-Type header..."));
  if (!g_modem.https_set_content_type("application/json")) {
    SerialMon.println(F("[MODEM] Failed to set Content-Type."));
  g_modem.https_end();
    return "";
  }

  SerialMon.println(F("[MODEM] Sending POST request..."));
  int statusCode = g_modem.https_post(payload);
  if (statusCodeOut != nullptr) {
    *statusCodeOut = statusCode;
  }

  if (statusCode <= 0) {
    SerialMon.print(F("[MODEM] POST request failed with status code: "));
    SerialMon.println(statusCode);
  } else {
    SerialMon.print(F("[MODEM] Response Status Code: "));
    SerialMon.println(statusCode);
    SerialMon.println(F("[MODEM] Reading response body..."));
  response_body = g_modem.https_body();
  }

  SerialMon.println(F("[MODEM] End HTTPS session."));
  g_modem.https_end();

  SerialMon.println(F("[MODEM] Response Body:"));
  SerialMon.println(response_body);
  return response_body;
}

bool modem_perform_handshake() {
  JsonDocument payloadDoc;
  payloadDoc["device_id"] = deviceID;
  payloadDoc["client_type"] = CLIENT_TYPE;
  payloadDoc["power_status"] = power_status_to_string(power_status_get());

  String payload;
  serializeJson(payloadDoc, payload);

  SerialMon.println(F("[MODEM] Performing device handshake..."));
  int statusCode = 0;
  String response = modem_send_post_request(RESOURCE_HANDSHAKE, payload, &statusCode);

  if (statusCode == 404) {
    SerialMon.println(F("[MODEM] Handshake responded 404 - device not registered."));
    fs_set_registered(false);
    return false;
  }

  if (statusCode == 409) {
    SerialMon.println(F("[MODEM] Handshake conflict (409) - device claimed by another user."));
    fs_set_registered(false);
    power_instruction_clear();
    return false;
  }

  if (statusCode >= 500 && statusCode != 0) {
    SerialMon.print(F("[MODEM] Handshake server error: "));
    SerialMon.println(statusCode);
    return false;
  }

  if (statusCode <= 0 && response.isEmpty()) {
    SerialMon.println(F("[MODEM] Handshake failed: no response from server."));
    return false;
  }

  JsonDocument responseDoc;
  DeserializationError error = deserializeJson(responseDoc, response);
  if (statusCode >= 400) {
    SerialMon.print(F("[MODEM] Handshake HTTP error: "));
    SerialMon.println(statusCode);
    return false;
  }

  if (error) {
    SerialMon.print(F("[MODEM] Failed to parse handshake response: "));
    SerialMon.println(error.c_str());
    return false;
  }

  if (!responseDoc["registered"].isNull()) {
    bool registered = responseDoc["registered"].as<bool>();
    fs_set_registered(registered);
    if (!registered) {
      SerialMon.println(F("[MODEM] Handshake indicates device is not registered."));
    }
  }

  if (!responseDoc["config"].isNull()) {
    fs_apply_server_config(responseDoc["config"]);
  }

  if (!responseDoc["power_instruction"].isNull()) {
    String instruction = responseDoc["power_instruction"].as<String>();
    instruction.trim();
    instruction.toUpperCase();
    if (instruction == F("TURN_OFF")) {
      power_instruction_apply(PowerInstruction::TurnOff);
    } else if (instruction == F("NONE") || instruction.length() == 0) {
      power_instruction_clear();
    } else {
      SerialMon.print(F("[MODEM] Unknown power instruction: "));
      SerialMon.println(instruction);
    }
  }

  return true;
}

void modem_disconnect_gprs() {
  ModemLockGuard lock(pdMS_TO_TICKS(3000));
  if (!lock.isLocked()) {
    SerialMon.println(F("[MODEM] Disconnect skipped (modem busy)."));
    return;
  }
  if (!g_modem_initialized || !g_modem_gprs_connected) {
    SerialMon.println(F("[MODEM] GPRS disconnect skipped (not connected)."));
    return;
  }
  SerialMon.print(F("[MODEM] Disconnecting GPRS..."));
  if (g_modem.gprsDisconnect()) {
    SerialMon.println(F(" success"));
    g_modem_gprs_connected = false;
  } else {
    SerialMon.println(F(" fail"));
  }
}

void modem_power_off() {
  ModemLockGuard lock(pdMS_TO_TICKS(3000));
  if (!lock.isLocked()) {
    SerialMon.println(F("[MODEM] Power-off skipped (modem busy)."));
    return;
  }
  if (!g_modem_initialized) {
    SerialMon.println(F("[MODEM] Power-off skipped (modem not initialized)."));
    return;
  }
  SerialMon.println(F("[MODEM] Powering off modem..."));
  if (!g_modem.poweroff()) {
    SerialMon.println(F("[MODEM] modem.poweroff() failed or not supported."));
  } else {
    SerialMon.println(F("[MODEM] Modem powered off via TinyGSM."));
  }
  delay(1000);
  g_modem_initialized = false;
  g_modem_gprs_connected = false;
}
