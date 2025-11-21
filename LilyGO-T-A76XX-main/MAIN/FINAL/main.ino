#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "power_management.h"
#include "ota_mode.h"
#include "file_system.h"
#include "gps_control.h"
#include "modem_control.h"

// Global variables (declared extern in respective headers)
extern String deviceID;
extern String deviceName;
extern uint64_t sleepTimeSeconds;
extern bool isRegistered;
extern bool gpsFixObtained;
extern double gpsLat, gpsLon, gpsSpd, gpsAlt, gpsHdop;
extern int gpsSats;
extern uint16_t gpsYear;
extern uint8_t gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond;

RTC_DATA_ATTR int cycleCounter = 0; // Counts boot cycles, survives deep sleep

// Forward declaration for the main work cycle function
void work_cycle();

void setup() {
  // 1. Hold power ON
  power_on();

  // 2. Initialize Serial communication
  SerialMon.begin(115200);
  delay(100);
  SerialMon.println(F("\n[BOOT] Device started."));

  // 3. Check for long press to enter OTA mode
  // This check needs to happen very early, before other initializations
  // and before the button ISR is fully active for normal operation.
  // We check the button state directly here.
  pinMode(PIN_BTN, INPUT_PULLUP); // Ensure button pin is configured (internal pull-up enabled)
  delay(100); // Small delay for pin to stabilize

  if (digitalRead(PIN_BTN) == LOW) {
    SerialMon.println(F("[BOOT] Button pressed at startup. Checking for long press..."));
    delay(200); // Debounce delay
    unsigned long press_start_time = millis();

    // Wait while the button stays low or until the long-press threshold is reached.
    while ((millis() - press_start_time) < BTN_LONG_PRESS_MS) {
      if (digitalRead(PIN_BTN) != LOW) {
        break; // Released before long-press threshold
        unsigned long lastBlink = millis();
        while (digitalRead(PIN_BTN) == LOW) {
          if (millis() - lastBlink >= 250) {
            lastBlink = millis();
            status_led_toggle();
          }
          delay(10);
        }
        delay(150); // Debounce release
        status_led_set(true);
      }
      delay(10);
    }

    if (digitalRead(PIN_BTN) == LOW) {
      SerialMon.println(F("[BOOT] Long press detected. Entering OTA mode."));
      // Provide visual feedback while waiting for the button to be released
      unsigned long lastBlink = millis();
      while (digitalRead(PIN_BTN) == LOW) {
        if (millis() - lastBlink >= 250) {
          lastBlink = millis();
          status_led_toggle();
        }
        delay(10);
      }
      delay(150); // Debounce release
      status_led_set(true);
      start_ota_mode(); // This function will loop indefinitely
      while (true) { delay(1000); } // Should not be reached
    }

    SerialMon.println(F("[BOOT] Button released before long press threshold. Continuing normal boot."));
  }

  // If not in OTA mode, proceed with normal boot and power management initialization
  SerialMon.println(F("[BOOT] Normal operating mode."));

  // Initialize power management (ISR and FreeRTOS task for button handling)
  power_init();

  // Handle wake-up cause (for debugging/logging)
  esp_sleep_wakeup_cause_t wakeup_cause = esp_sleep_get_wakeup_cause();
  switch (wakeup_cause) {
    case ESP_SLEEP_WAKEUP_EXT0:  SerialMon.println(F("[BOOT] Wakeup by EXT0 (button).")); break;
    case ESP_SLEEP_WAKEUP_TIMER: SerialMon.println(F("[BOOT] Wakeup by timer.")); break;
    case ESP_SLEEP_WAKEUP_UNDEFINED: SerialMon.println(F("[BOOT] Power-on reset or undefined wakeup cause.")); break;
    default: SerialMon.printf("[BOOT] Wakeup cause: %d\n", wakeup_cause); break;
  }

  // Start the main work cycle
  work_cycle();

  // After work cycle, enter deep sleep
  // This will be replaced by actual sleep time from config
  if (power_instruction_ack_pending()) {
    SerialMon.println(F("[MAIN] Power instruction acknowledgement still pending. Staying awake for retry."));
    return;
  }
  if (isRegistered) {
    SerialMon.print(F("[MAIN] Device is registered. Next update in approx. ")); SerialMon.print(sleepTimeSeconds); SerialMon.println(F(" seconds."));
    enter_deep_sleep(sleepTimeSeconds);
  } else {
    SerialMon.println(F("[MAIN] DEVICE NOT REGISTERED. Powering down permanently."));
    SerialMon.println(F("[MAIN] Please use OTA mode to register the device."));
    graceful_shutdown(); // Power off indefinitely
  }
}

void loop() {
  // This will not be reached as the device either enters OTA mode or deep sleep
}

void work_cycle() {
  SerialMon.println(F("[MAIN] Starting work cycle."));
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MAIN] Shutdown already requested. Aborting work cycle."));
    return;
  }

  // 1. Initialize Filesystem and Preferences
  if(!fs_init()){
      SerialMon.println(F("[MAIN] File system initialization failed. Cannot proceed."));
      graceful_shutdown(); // Power off if FS fails
      return;
  }
  fs_load_configuration(); // Load configuration into global variables
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MAIN] Shutdown requested after configuration load. Aborting work cycle."));
    return;
  }

  // Set Device ID from MAC Address, this is permanent and unique
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  // Use the last 10 characters of the MAC address for a shorter ID
  deviceID = mac.substring(mac.length() - 10);
  SerialMon.print(F("[MAIN] Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);

  // 2. Get GPS Data
  if (power_instruction_get() != PowerInstruction::TurnOff) {
    SerialMon.println(F("[MAIN] --- Initializing External GPS ---"));
    gps_power_up();
    gps_init_serial();
    gps_get_fix(GPS_ACQUISITION_TIMEOUT_MS); // Button presses are handled by ISR now
    gps_close_serial(); // De-initialize serial pins before cutting power
    gps_power_down(); // Power down GPS immediately after fix attempt
    if (shutdown_is_requested()) {
      SerialMon.println(F("[MAIN] Shutdown requested after GPS stage. Aborting work cycle."));
      return;
    }
  } else {
    gpsFixObtained = false;
  }

  bool statusAckQueued = false;

  // 3. Cache the data point if a fix was obtained
  if (gpsFixObtained) {
    JsonDocument jsonDoc;
    jsonDoc["device"] = deviceID;
    jsonDoc["name"] = deviceName;
    jsonDoc["latitude"] = gpsLat;
    jsonDoc["longitude"] = gpsLon;
    jsonDoc["speed"] = gpsSpd;
    jsonDoc["altitude"] = gpsAlt;
    jsonDoc["accuracy"] = gpsHdop;
    jsonDoc["satellites"] = gpsSats;
    if (gpsYear != 0) {
      char timestamp[25];
      sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", gpsYear, gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond);
      jsonDoc["timestamp"] = timestamp;
    }
    if (power_status_report_pending()) {
      jsonDoc["power_status"] = power_status_to_string(power_status_get());
      statusAckQueued = true;
    }
    String jsonData;
    serializeJson(jsonDoc, jsonData);
    append_to_cache(jsonData);
    cycleCounter++;
    SerialMon.printf("[MAIN] Cycle %d complete. Batch size will be determined by server.\n", cycleCounter);
  }

  bool statusReportPending = power_status_report_pending();
  size_t cachedRecordCount = fs_get_cache_record_count();

  if (!gpsFixObtained && statusReportPending) {
    JsonDocument statusDoc;
    statusDoc["device"] = deviceID;
    statusDoc["name"] = deviceName;
    statusDoc["latitude"] = gpsLat;
    statusDoc["longitude"] = gpsLon;
    statusDoc["speed"] = gpsSpd;
    statusDoc["altitude"] = gpsAlt;
    statusDoc["accuracy"] = gpsHdop;
    statusDoc["satellites"] = gpsSats;
    if (gpsYear != 0) {
      char timestamp[25];
      sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", gpsYear, gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond);
      statusDoc["timestamp"] = timestamp;
    } else {
      statusDoc["timestamp"] = "2000-01-01T00:00:00Z";
    }
    statusDoc["power_status"] = power_status_to_string(power_status_get());
    String statusJson;
    serializeJson(statusDoc, statusJson);
    append_to_cache(statusJson);
    statusAckQueued = true;
    cachedRecordCount = fs_get_cache_record_count(); // Re-count after adding status
  }

  // 4. Perform handshake and optionally send data in a single modem session
  // Only initiate modem session if batch threshold is met OR there's an urgent power status report to send
  if (shutdown_is_requested()) {
    SerialMon.println(F("[MAIN] Shutdown requested before modem session. Skipping network operations."));
  } else if (cachedRecordCount >= batchSizeThreshold || statusReportPending || power_instruction_get() == PowerInstruction::TurnOff) {
    SerialMon.println(F("[MAIN] Starting modem session (handshake + optional upload)."));
    bool modemInitialized = false;
    bool gprsConnected = false;

    if (modem_initialize()) {
      modemInitialized = true;
      if (modem_connect_gprs(apn, gprsUser, gprsPass)) {
        gprsConnected = true;
        bool handshakeSuccess = modem_perform_handshake();
        if (!handshakeSuccess) {
          SerialMon.println(F("[MAIN] Handshake did not complete successfully."));
        } else {
          // Handshake includes power_status, so we can consider the report sent.
          // This prevents a loop if the subsequent batch upload fails.
          if (power_status_report_pending()) {
            power_status_report_acknowledged();
            // Also acknowledge instruction if we just reported matching status
            if (power_instruction_get() == PowerInstruction::TurnOff && power_status_get() == PowerStatus::Off) {
                 power_instruction_acknowledged();
            }
          }
        }

        if (!isRegistered) {
          SerialMon.println(F("[MAIN] Device reported as unregistered during handshake. Entering shutdown."));
          modem_disconnect_gprs();
          modem_power_off();
          graceful_shutdown();
          return;
        }

        if (power_status_report_pending() && !statusAckQueued) {
          JsonDocument statusDoc;
          statusDoc["device"] = deviceID;
          statusDoc["name"] = deviceName;
          statusDoc["latitude"] = gpsLat;
          statusDoc["longitude"] = gpsLon;
          statusDoc["speed"] = gpsSpd;
          statusDoc["altitude"] = gpsAlt;
          statusDoc["accuracy"] = gpsHdop;
          statusDoc["satellites"] = gpsSats;
          if (gpsYear != 0) {
            char timestamp[25];
            sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", gpsYear, gpsMonth, gpsDay, gpsHour, gpsMinute, gpsSecond);
            statusDoc["timestamp"] = timestamp;
          } else {
            statusDoc["timestamp"] = "2000-01-01T00:00:00Z";
          }
          statusDoc["power_status"] = power_status_to_string(power_status_get());
          String statusJson;
          serializeJson(statusDoc, statusJson);
          append_to_cache(statusJson);
          statusAckQueued = true;
        }

        bool hasDataToSend = fs_cache_exists();
        if (hasDataToSend) {
          SerialMon.println(F("[MAIN] Data available for upload. Attempting to send."));
          if (send_cached_data()) {
            cycleCounter = 0;
          }
        } else {
          SerialMon.println(F("[MAIN] No data pending after handshake."));
        }

        modem_disconnect_gprs();
        gprsConnected = false;
      } else {
        SerialMon.println(F("[MAIN] Failed to connect to GPRS. Data remains cached."));
      }

      modem_power_off();
      modemInitialized = false;
    } else {
      SerialMon.println(F("[MAIN] Failed to initialize modem for network session."));
    }

    if (gprsConnected) {
      modem_disconnect_gprs();
    }
    if (modemInitialized) {
      modem_power_off();
    }
  }

  if (power_instruction_should_shutdown()) {
    SerialMon.println(F("[MAIN] Power instruction acknowledged. Shutting down device."));
    power_instruction_clear();
    graceful_shutdown();
    return;
  }

  // 5. Clean up file system resources
  if (!shutdown_is_requested()) {
    fs_end();
    SerialMon.println(F("[MAIN] Work cycle finished."));
  } else {
    SerialMon.println(F("[MAIN] Work cycle aborted due to shutdown request."));
  }
}