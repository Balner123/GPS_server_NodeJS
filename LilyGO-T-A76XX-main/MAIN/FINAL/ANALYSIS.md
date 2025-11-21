# Hardware & Firmware Analysis Report

**Date:** 2025-11-21
**Scope:** Analysis of `MAIN/FINAL` codebase and `docs_hw` documentation.

## 1. Executive Summary
The hardware and firmware for the location tracker project are in a mature state. The codebase in `MAIN/FINAL/` is structured, modular, and largely consistent with the documentation in `docs_hw/`. The hardware definitions (pins, board variant) match the described custom PCB/LilyGO setup.

A few minor discrepancies were found regarding the implementation of configurable parameters (specifically batch size) where the code ignores the server's configuration in favor of a hardcoded safety limit.

## 2. Hardware Configuration Analysis
The code assumes a specific hardware variant defined as `LILYGO_T_CALL_A7670_V1_0` with custom overrides in `config.h`.

| Component | Pin (Code) | Pin (Docs) | Status |
| :--- | :--- | :--- | :--- |
| **MCU** | ESP32 | ESP32 | ✅ Match |
| **Modem** | SIMCOM A7670 | SIMCOM A7670 | ✅ Match |
| **GPS RX** | GPIO 34 | GPIO 34 | ✅ Match |
| **GPS TX** | GPIO 33 | GPIO 33 | ✅ Match |
| **GPS Power** | GPIO 5 | GPIO 5 | ✅ Match |
| **Button** | GPIO 32 | GPIO 32 | ✅ Match |
| **Status LED**| GPIO 19 | GPIO 19 | ✅ Match |
| **Power Latch**| GPIO 23 | GPIO 23 | ✅ Match |

**Note:** The GPS implementation uses `SoftwareSerial` on pins 34 (RX) and 33 (TX). Since GPIO 34 is input-only on the ESP32, this is a valid configuration for receiving data.

## 3. Firmware Logic & Architecture
The firmware follows a linear "Work Cycle" approach wrapped in a setup-loop structure, heavily relying on deep sleep for power saving.

### Core Modules
*   **`main.ino`**: Entry point. Handles boot decisions (OTA vs Normal) and orchestrates the `work_cycle`.
*   **`gps_control`**: Manages `SoftwareSerial` to external GPS. Includes timeout logic (5 mins) and ISR-based abort for shutdown requests.
*   **`modem_control`**: Handles TinyGSM integration. Implements a robust initialization sequence (PWRKEY toggling, Reset pulsing) and HTTPS sessions.
*   **`file_system`**: Uses `LittleFS` for caching data (`gps_cache.log`) and storing preferences. Thread-safe via recursive mutexes.
*   **`power_management`**: Manages the power latch (Keep-Alive) and graceful shutdown sequences.

### Logic Flow
1.  **Boot:** Enable Power Latch -> Check Button (Long Press = OTA).
2.  **Work Cycle:**
    *   Init Filesystem & Config.
    *   **GPS:** Power On -> Get Fix -> Power Off.
    *   **Cache:** Store data locally.
    *   **Modem:** Power On -> Connect GPRS.
    *   **Handshake:** `POST /handshake` (Exchange status/config).
    *   **Upload:** `POST /input` (Batch upload cached data).
    *   **Shutdown:** Deep Sleep or Power Off based on registration status.

## 5. Discrepancies & Bugs (Code vs Intent)
### 2. GPS Timeout Blocking
*   **Issue:** `gps_get_fix` has a long timeout (5 minutes). While it checks `gpsAbortRequested` (set by button ISR), it effectively blocks the main thread.
*   **Status:** Functional, but could be improved with a non-blocking state machine if more multitasking is needed in the future. For now, it is acceptable as `gpsAbortRequested` handles the user "off" button.

