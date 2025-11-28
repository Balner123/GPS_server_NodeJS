// ESP32 testovací skeleton: okamžité vypnutí přes GPIO přerušení bez pollingů
// EN (GPIO 23) drží napájení; BTN (GPIO 25) na GND, INPUT_PULLUP, zároveň RTC wake.
// Přerušení (ISR) pouze notifikuje vysoce prioritní FreeRTOS úkol, který provede vypnutí.

// HW zapojení:
//   - PIN_EN (GPIO 23) -> EN napájecího spínače (HIGH = zapnuto, LOW = vypnuto)
//   - PIN_BTN (GPIO 25) -> tlačítko na GND (interní pull-up)

// Kompilace: Arduino-ESP32

#include <Arduino.h>
#include "esp_sleep.h"
#include "esp_timer.h"
#include <Preferences.h>
#include <LittleFS.h>

// FreeRTOS
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define PIN_EN   23
#define PIN_BTN  32
const uint64_t DEFAULT_SLEEP_SECONDS = 60;

// --- Globální stav ---
static TaskHandle_t shutdownTaskHandle = nullptr;
volatile uint32_t g_lastEdgeUs = 0;
const uint32_t BTN_DEBOUNCE_US = 50000; // 50 ms

Preferences preferences;
bool fsMounted = false;

// --- Mock/šablony "subsystémů" (nahraď reálnými voláními z gps_tracker.ino) ---
void powerUpGPS()      { Serial.println(F("[GPS] Power ON")); }
void powerDownGPS()    { Serial.println(F("[GPS] Power OFF")); }
void disconnectGPRS()  { Serial.println(F("[MODEM] GPRS disconnect")); }
void powerOffModem()   { Serial.println(F("[MODEM] Power OFF")); }
// Pokud máš v projektu init/close GPSSerial, dodej zde (nejsou nutné do skeletonu)

// --- Deklarace ---
void gracefulShutdownAndPowerOff(const char* reason);

// --- ISR tlačítka: jen debounce a notifikace úkolu ---
void IRAM_ATTR onButtonISR() {
  uint32_t now = (uint32_t)esp_timer_get_time(); // μs
  if (now - g_lastEdgeUs > BTN_DEBOUNCE_US) {
    g_lastEdgeUs = now;
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    if (shutdownTaskHandle) {
      vTaskNotifyGiveFromISR(shutdownTaskHandle, &xHigherPriorityTaskWoken);
      if (xHigherPriorityTaskWoken) {
        portYIELD_FROM_ISR();
      }
    }
  }
}

// --- Úkol s vyšší prioritou: provede okamžité, řízené vypnutí ---
void ShutdownTask(void* /*arg*/) {
  for (;;) {
    // čekej na notifikaci z ISR (tlačítko)
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    // Prevence opakování (volitelně): zakáže další přerušení tlačítka
    detachInterrupt(PIN_BTN);

    gracefulShutdownAndPowerOff("button");
    // Pokud by se někdy vrátilo (nemělo by), znovu čekej
  }
}

// --- Vypnutí zařízení: čistý úklid + shodit EN ---
void gracefulShutdownAndPowerOff(const char* reason) {
  Serial.println(F("\n[POWER] Shutdown requested - starting graceful power-off..."));
  if (reason) { Serial.print(F("[POWER] Reason: ")); Serial.println(reason); }
  Serial.flush();

  // 1) Bezpečně vypnout periferie
  disconnectGPRS();
  powerOffModem();
  powerDownGPS();

  // 2) FS/Preferences
  preferences.end();
  if (fsMounted) {
    LittleFS.end();
    fsMounted = false;
  }

  // 3) Shodit EN (odpojit napájení)
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, LOW);
  delay(100);

  // 4) Fallback: kdyby EN nebyl skutečný "latch", usni
  esp_deep_sleep_start();
}

// --- Deep sleep s probouzením tlačítkem ---
void enterDeepSleep(uint64_t seconds) {
  Serial.print(F("[SLEEP] Entering deep sleep for "));
  Serial.print(seconds);
  Serial.println(F(" seconds..."));
  Serial.flush();

  esp_sleep_enable_timer_wakeup(seconds * 1000000ULL); // mikrosekundy
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_25, 0);        // BTN LOW = wake

  esp_deep_sleep_start();
}

// --- Simulace hlavní práce bez pollingů ---
// Tady naschvál žádné kontroly tlačítka – reakce jde výhradně přes ISR + ShutdownTask.
void doWorkCycle() {
  Serial.println(F("[WORK] Starting work cycle..."));

  // FS mount
  fsMounted = LittleFS.begin();
  if (!fsMounted) {
    Serial.println(F("[WORK] LittleFS mount failed (continuing)"));
  }

  // Preferences
  preferences.begin("test-space", false);

  // Zapni GPS, dělej dlouhou práci (žádný polling!)
  powerUpGPS();


  // Simulace “něco trvá” (např. 15 s). ShutdownTask to umí kdykoli přerušit.
  for (int i = 0; i < 60; ++i) {
    // záměrně jen delay; ISR + ShutdownTask to přeruší okamžitě
    delay(250);
  }

  // Úklid pokud nedošlo ke stisku
  powerDownGPS();
  preferences.end();
  if (fsMounted) {
    LittleFS.end();
    fsMounted = false;
  }

  Serial.println(F("[WORK] Work cycle finished."));
}

void setup() {
  // Přichytit napájení
  pinMode(PIN_EN, OUTPUT);
  digitalWrite(PIN_EN, HIGH);
  pinMode(12, OUTPUT);
  digitalWrite(12, HIGH);
  delay(2000);
  // Tlačítko: interní pull-up, tlačítko na GND
  pinMode(PIN_BTN, INPUT_PULLUP);

  // Povolit probuzení tlačítkem z deep sleep (LOW na BTN)
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_25, 0);

  Serial.begin(115200);
  delay(100);

  // Info o probuzení
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  switch (cause) {
    case ESP_SLEEP_WAKEUP_EXT0:  Serial.println(F("[BOOT] Wake by EXT0 (button)")); break;
    case ESP_SLEEP_WAKEUP_TIMER: Serial.println(F("[BOOT] Wake by timer")); break;
    default:                     Serial.println(F("[BOOT] Power-on or undefined wake cause")); break;
  }
  pinMode(12, OUTPUT);
  digitalWrite(12, HIGH);

  // Spustit ShutdownTask s vyšší prioritou (preemptuje “work”)
  // Vyšší číslo = vyšší priorita;  (configMAX_PRIORITIES-1) bývá nejvyšší
  xTaskCreatePinnedToCore(
    ShutdownTask, "ShutdownTask", 4096, nullptr,
    configMAX_PRIORITIES - 1, &shutdownTaskHandle, 0 /*core 0*/
  );

  // Až po vytvoření úkolu povol přerušení tlačítka
  attachInterrupt(digitalPinToInterrupt(PIN_BTN), onButtonISR, FALLING);

  // Hlavní práce (bez pollingů)
  doWorkCycle();

  // Po dokončení práce jdi spát (probudí BTN nebo timer)
  enterDeepSleep(DEFAULT_SLEEP_SECONDS);
}

void loop() {
  // nevyužito
}