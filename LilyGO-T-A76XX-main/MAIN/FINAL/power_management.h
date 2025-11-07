#pragma once

#include <Arduino.h>
#include "config.h"
#include "esp_sleep.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Forward declarations for functions that will be implemented in other modules
// These will be called during graceful shutdown
void modem_disconnect_gprs();
void modem_power_off();
void gps_power_down();
void gps_close_serial();
void gps_request_abort();
bool gps_is_active();
void fs_end();

enum class PowerStatus : uint8_t {
	Unknown = 0,
	On,
	Off,
};

enum class PowerInstruction : uint8_t {
	None = 0,
	TurnOff,
};

// Query whether a shutdown sequence has been requested
bool shutdown_is_requested();

// Power status helpers for server handshake/acknowledgement
PowerStatus power_status_get();
void power_status_mark_on();
void power_status_mark_off();
bool power_status_report_pending();
void power_status_report_acknowledged();
const char* power_status_to_string(PowerStatus status);

// Power instruction handling (e.g., TURN_OFF from server)
PowerInstruction power_instruction_get();
void power_instruction_apply(PowerInstruction instruction);
void power_instruction_acknowledged();
bool power_instruction_should_shutdown();
bool power_instruction_ack_pending();
void power_instruction_clear();

// Track OTA mode to disable shutdown button behaviour
void power_set_ota_mode_active(bool active);

// Function to initialize power management (pins, ISR, FreeRTOS task)
void power_init();

// Function to turn on the main power latch (if applicable)
void power_on();

// Function to perform a graceful shutdown and power off the device
void graceful_shutdown();

// Function to enter deep sleep mode
void enter_deep_sleep(uint64_t seconds);

// ISR for button press (only notifies the FreeRTOS task)
void IRAM_ATTR on_button_isr();

// FreeRTOS task to handle button presses and initiate shutdown/OTA
void ShutdownTask(void* pvParameters);

// Control the status LED (if defined)
void status_led_set(bool on);
void status_led_toggle();
