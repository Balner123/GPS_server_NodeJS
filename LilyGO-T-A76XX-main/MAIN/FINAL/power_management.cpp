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
static PowerStatus g_current_power_status = PowerStatus::Unknown;
static bool g_power_status_dirty = false;
static PowerInstruction g_pending_power_instruction = PowerInstruction::None;
static bool g_instruction_ack_pending = false;
static bool g_instruction_shutdown_ready = false;
static bool g_ota_mode_active = false;

static void update_power_status(PowerStatus status, bool markDirty) {
  if (g_current_power_status != status) {
    g_current_power_status = status;
    if (markDirty) {
      g_power_status_dirty = true;
    }
  } else if (markDirty) {
    g_power_status_dirty = true;
  }
}

void power_on() {
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH); // Hold power ON
#ifdef BOARD_POWERON_PIN
  pinMode(BOARD_POWERON_PIN, OUTPUT);
  digitalWrite(BOARD_POWERON_PIN, HIGH); // Keep modem power rail asserted
#endif
  g_shutdown_requested = false;
  g_instruction_shutdown_ready = false;
  g_instruction_ack_pending = false;
  g_pending_power_instruction = PowerInstruction::None;
  power_status_mark_on();
  status_led_set(true);
  DBG_PRINTLN(F("[POWER] Main power latch ON."));
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
  DBG_PRINTLN(F("[POWER] Button interrupt and shutdown task initialized."));
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
      DBG_PRINTLN(F("[BUTTON] Button press detected. Initiating graceful shutdown."));
      graceful_shutdown();
    }
  }
}

void graceful_shutdown() {
  DBG_PRINTLN(F("\n[POWER] Shutdown requested - starting graceful power-off..."));
  DBG_FLUSH();

  // Detach interrupt to prevent any further triggers during shutdown
  detachInterrupt(digitalPinToInterrupt(PIN_BTN));

  g_shutdown_requested = true;
  power_status_mark_off();
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
  DBG_PRINT(F("[SLEEP] Entering deep sleep for "));
  DBG_PRINT(seconds);
  DBG_PRINTLN(F(" seconds..."));
  DBG_FLUSH();

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

PowerStatus power_status_get() {
  return g_current_power_status;
}

void power_status_mark_on() {
  update_power_status(PowerStatus::On, false);
  g_power_status_dirty = false;
}

void power_status_mark_off() {
  update_power_status(PowerStatus::Off, true);
}

bool power_status_report_pending() {
  return g_power_status_dirty;
}

void power_status_report_acknowledged() {
  g_power_status_dirty = false;
}

const char* power_status_to_string(PowerStatus status) {
  switch (status) {
    case PowerStatus::On: return "ON";
    case PowerStatus::Off: return "OFF";
    default: return "UNKNOWN";
  }
}

PowerInstruction power_instruction_get() {
  return g_pending_power_instruction;
}

void power_instruction_apply(PowerInstruction instruction) {
  g_pending_power_instruction = instruction;
  if (instruction == PowerInstruction::TurnOff) {
    DBG_PRINTLN(F("[POWER] Power instruction received: TURN_OFF."));
    g_instruction_ack_pending = true;
    g_instruction_shutdown_ready = false;
    power_status_mark_off();
  } else {
    g_instruction_ack_pending = false;
    g_instruction_shutdown_ready = false;
  }
}

void power_instruction_acknowledged() {
  if (g_pending_power_instruction == PowerInstruction::TurnOff && (g_instruction_ack_pending || !g_instruction_shutdown_ready)) {
    g_instruction_ack_pending = false;
    g_instruction_shutdown_ready = true;
    DBG_PRINTLN(F("[POWER] Power instruction TURN_OFF acknowledged by server."));
  }
}

bool power_instruction_should_shutdown() {
  return g_instruction_shutdown_ready && !g_instruction_ack_pending && (g_pending_power_instruction == PowerInstruction::TurnOff);
}

bool power_instruction_ack_pending() {
  return g_instruction_ack_pending;
}

void power_instruction_clear() {
  g_pending_power_instruction = PowerInstruction::None;
  g_instruction_ack_pending = false;
  g_instruction_shutdown_ready = false;
}

void power_set_ota_mode_active(bool active) {
  g_ota_mode_active = active;
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