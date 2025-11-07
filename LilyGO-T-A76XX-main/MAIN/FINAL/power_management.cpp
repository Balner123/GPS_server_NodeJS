#include "power_management.h"
#include "config.h"

// FreeRTOS
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Global state for button handling
static TaskHandle_t shutdownTaskHandle = nullptr;
volatile uint32_t g_last_button_edge_time_us = 0;
static volatile bool g_shutdown_requested = false;
static bool statusLedState = false;
static bool statusLedConfigured = false;

void power_on() {
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH); // Hold power ON
  g_shutdown_requested = false;
  status_led_set(true);
  SerialMon.println(F("[POWER] Main power latch ON."));
}

void power_init() {
  if (shutdownTaskHandle != nullptr) {
    return; // Already initialized
  }
  pinMode(PIN_BTN, INPUT_PULLUP); // Use internal pull-up so button can pull the line low

  // Ensure LED reflects normal run state (solid ON)
  status_led_set(true);

  // Create the FreeRTOS task for button handling
  xTaskCreatePinnedToCore(
    ShutdownTask,     // Task function
    "ShutdownTask",   // Name of task
    4096,             // Stack size (bytes)
    NULL,             // Parameter to pass to function
    configMAX_PRIORITIES - 1, // Task priority (highest)
    &shutdownTaskHandle, // Task handle
    0                 // Core where the task should run (Core 0)
  );

  // Attach interrupt to the button pin
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), on_button_isr, FALLING);
  SerialMon.println(F("[POWER] Button interrupt and shutdown task initialized."));
}

void IRAM_ATTR on_button_isr() {
  uint32_t now = (uint32_t)esp_timer_get_time(); // microseconds
  if (now - g_last_button_edge_time_us > (BTN_DEBOUNCE_MS * 1000)) { // Convert ms to us
    g_last_button_edge_time_us = now;
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    vTaskNotifyGiveFromISR(shutdownTaskHandle, &xHigherPriorityTaskWoken);
    if (xHigherPriorityTaskWoken) {
      portYIELD_FROM_ISR();
    }
  }
}

void ShutdownTask(void* pvParameters) {
  (void) pvParameters; // Suppress unused parameter warning

  for (;;) {
    // Wait for notification from ISR (button state change)
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    // Confirm the button remains held for the debounce interval
    uint32_t press_start_time_ms = millis();
    bool valid_press = false;
    while (millis() - press_start_time_ms < BTN_DEBOUNCE_MS) {
      if (digitalRead(PIN_BTN) != LOW) {
        break; // Released before debounce interval
      }
      vTaskDelay(pdMS_TO_TICKS(5));
    }
    if (digitalRead(PIN_BTN) == LOW) {
      valid_press = true;
    }

    if (valid_press) {
      SerialMon.println(F("[BUTTON] Button press detected. Initiating graceful shutdown."));
      graceful_shutdown();
    }
  }
}

void graceful_shutdown() {
  SerialMon.println(F("\n[POWER] Shutdown requested - starting graceful power-off..."));
  SerialMon.flush();

  // Detach interrupt to prevent any further triggers during shutdown
  detachInterrupt(digitalPinToInterrupt(PIN_BTN));

  g_shutdown_requested = true;
  status_led_set(false);

  // Ask long-running tasks to abort before we tear down shared resources
  gps_request_abort();

  // Call functions from other modules to power down peripherals
  modem_disconnect_gprs(); // Defined in modem_control.cpp
  modem_power_off();       // Defined in modem_control.cpp
  // Wait briefly for GPS loops to notice the abort request
  for (int i = 0; i < 50 && gps_is_active(); ++i) {
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  gps_close_serial();      // Defined in gps_control.cpp
  gps_power_down();        // Defined in gps_control.cpp
  fs_end();                // Defined in file_system.cpp

  // Finally, cut power to the ESP32
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, LOW);
  delay(100); // Give some time for power to cut

  // Fallback: if EN is not a true "latch", enter deep sleep indefinitely
  esp_deep_sleep_start();
}

void enter_deep_sleep(uint64_t seconds) {
  SerialMon.print(F("[SLEEP] Entering deep sleep for "));
  SerialMon.print(seconds);
  SerialMon.println(F(" seconds..."));
  SerialMon.flush();

  // Detach interrupt before sleeping to prevent issues on wake
  detachInterrupt(digitalPinToInterrupt(PIN_BTN));

  // Enable wakeup by timer
  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL); // microseconds
  // Enable wakeup by button (on LOW level)
  esp_sleep_enable_ext0_wakeup(static_cast<gpio_num_t>(PIN_BTN), 0);

  status_led_set(false);

  esp_deep_sleep_start();
}

bool shutdown_is_requested() {
  return g_shutdown_requested;
}

void status_led_set(bool on) {
#ifdef STATUS_LED_PIN
  if (!statusLedConfigured) {
    pinMode(STATUS_LED_PIN, OUTPUT);
    statusLedConfigured = true;
  }
  digitalWrite(STATUS_LED_PIN, on ? STATUS_LED_ON_LEVEL : STATUS_LED_OFF_LEVEL);
  statusLedState = on;
#else
  (void)on;
#endif
}

void status_led_toggle() {
#ifdef STATUS_LED_PIN
  status_led_set(!statusLedState);
#endif
}
