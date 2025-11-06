#include "file_system.h"
#include "ota_mode.h"
#include "modem_control.h" // For modem_send_post_request, modem_disconnect_gprs, modem_initialize, modem_connect_gprs
#include "power_management.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

// Global variables (declared extern in file_system.h and other modules)
String deviceID = "";
String deviceName = DEFAULT_DEVICE_NAME;
String apn = DEFAULT_APN;
String gprsUser = DEFAULT_GPRS_USER;
String gprsPass = DEFAULT_GPRS_PASS;
String server = DEFAULT_SERVER_HOST;
int port = DEFAULT_SERVER_PORT;
uint64_t sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;
bool isRegistered = true; // Assume registered until told otherwise by the server
int minSatellitesForFix = SAT_THRESHOLD;

Preferences preferences;

namespace {
SemaphoreHandle_t get_fs_mutex() {
  static portMUX_TYPE initMux = portMUX_INITIALIZER_UNLOCKED;
  static SemaphoreHandle_t fsMutex = nullptr;
  if (fsMutex == nullptr) {
    portENTER_CRITICAL(&initMux);
    if (fsMutex == nullptr) {
      fsMutex = xSemaphoreCreateRecursiveMutex();
    }
    portEXIT_CRITICAL(&initMux);
  }
  return fsMutex;
}

class FsLockGuard {
 public:
  explicit FsLockGuard(TickType_t timeout = portMAX_DELAY) {
    mutex_ = get_fs_mutex();
    locked_ = (mutex_ != nullptr) && (xSemaphoreTakeRecursive(mutex_, timeout) == pdTRUE);
  }

  ~FsLockGuard() {
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

bool fs_init() {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock during init."));
    return false;
  }
  if (!LittleFS.begin()) {
    SerialMon.println(F("[FS] An Error has occurred while mounting LittleFS"));
    return false;
  }
  SerialMon.println(F("[FS] LittleFS mounted successfully."));
  preferences.begin(PREFERENCES_NAMESPACE, false); // false for read/write
  SerialMon.println(F("[FS] Preferences initialized."));
  return true;
}

void fs_load_configuration() {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while loading configuration."));
    return;
  }
  // Load GPRS settings
  apn = preferences.getString("apn", DEFAULT_APN);
  gprsUser = preferences.getString("gprsUser", DEFAULT_GPRS_USER);
  gprsPass = preferences.getString("gprsPass", DEFAULT_GPRS_PASS);

  // Load Server settings
  server = preferences.getString("server", DEFAULT_SERVER_HOST);
  port = preferences.getUInt("port", DEFAULT_SERVER_PORT);

  // Load Device settings
  deviceName = preferences.getString("deviceName", DEFAULT_DEVICE_NAME);

  // Load OTA settings
  ota_ssid = preferences.getString("ota_ssid", DEFAULT_OTA_SSID);
  ota_password = preferences.getString("ota_password", DEFAULT_OTA_PASSWORD);

  // Load sleep time and batch size
  sleepTimeSeconds = preferences.getULong64("sleepTime", DEFAULT_SLEEP_SECONDS);
  minSatellitesForFix = preferences.getInt("minSats", SAT_THRESHOLD);

  SerialMon.println(F("[FS] Configuration loaded from Preferences."));
}

void fs_end() {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock during shutdown."));
    return;
  }
  preferences.end();
  // The mounted() check is not available/needed. LittleFS.end() is safe to call.
  LittleFS.end();
  SerialMon.println(F("[FS] Preferences and LittleFS closed."));
}

void append_to_cache(String jsonRecord) {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while appending to cache."));
    return;
  }
  File file = LittleFS.open(CACHE_FILE, "a"); // a = append
  if (!file) {
    SerialMon.println(F("[FS] Failed to open cache file for writing."));
    return;
  }
  if (file.println(jsonRecord)) {
    SerialMon.println(F("[FS] GPS data point appended to cache."));
  } else {
    SerialMon.println(F("[FS] Failed to write to cache file."));
  }
  file.close();
}

bool send_cached_data() {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while sending cached data."));
    return false;
  }
  const int MAX_BATCH_SIZE = 50;
  bool allDataSent = true;

  while (true) {
    File file = LittleFS.open(CACHE_FILE, "r");
    if (!file || file.size() == 0) {
      if (file) file.close();
      if (allDataSent) {
        SerialMon.println(F("[FS] Cache is empty. All data sent."));
        LittleFS.remove(CACHE_FILE); // Clean up empty file
      }
      return allDataSent;
    }

    String payload = "[";
    bool first = true;
    int recordCount = 0;
    long lastPosition = 0;

    while (file.available() && recordCount < MAX_BATCH_SIZE) {
      String line = file.readStringUntil('\n');
      line.trim();
      if (line.length() > 0) {
        if (!first) {
          payload += ",";
        }
        payload += line;
        first = false;
        recordCount++;
        lastPosition = file.position();
      }
    }
    payload += "]";

    if (recordCount == 0) {
      file.close();
      LittleFS.remove(CACHE_FILE); // No valid records found, clear cache
      return true;
    }

    SerialMon.printf("[FS] Sending batch of %d records...\n", recordCount);
    String response = modem_send_post_request(RESOURCE_POST, payload);

    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error) {
      if (serverResponseDoc["registered"] == false) {
        SerialMon.println(F("[FS] Server indicated device is not registered."));
        isRegistered = false;
      }
      if (!serverResponseDoc["interval_gps"].isNull()) {
        unsigned int interval_gps = serverResponseDoc["interval_gps"].as<unsigned int>();
        if (interval_gps > 0) {
          sleepTimeSeconds = interval_gps;
          preferences.putULong64("sleepTime", sleepTimeSeconds);
          SerialMon.print(F("[FS] Server updated sleep interval to: ")); SerialMon.println(sleepTimeSeconds);
        }
      }
      if (!serverResponseDoc["interval_send"].isNull()) {
        uint8_t newBatchSize = serverResponseDoc["interval_send"].as<uint8_t>();
        if (newBatchSize == 0) newBatchSize = 1;
        if (newBatchSize > 50) newBatchSize = 50;
        preferences.putUChar(KEY_BATCH_SIZE, newBatchSize);
        SerialMon.print(F("[FS] Server updated batch size to: ")); SerialMon.println(newBatchSize);
      }
      if (!serverResponseDoc["satellites"].isNull()) {
        minSatellitesForFix = serverResponseDoc["satellites"].as<int>();
        preferences.putInt("minSats", minSatellitesForFix);
        SerialMon.print(F("[FS] Server updated minimum satellites for fix to: ")); SerialMon.println(minSatellitesForFix);
      }
    }

    if (!error && serverResponseDoc["success"] == true) {
      SerialMon.println(F("[FS] Batch sent successfully. Updating cache file."));
      
      bool moreData = file.available();
      file.close();

      if (moreData) {
        File tempFile = LittleFS.open("/cache.tmp", "w");
        File originalFile = LittleFS.open(CACHE_FILE, "r");
        if (tempFile && originalFile) {
          originalFile.seek(lastPosition);
          while (originalFile.available()) {
            tempFile.write(originalFile.read());
          }
          tempFile.close();
          originalFile.close();
          LittleFS.remove(CACHE_FILE);
          LittleFS.rename("/cache.tmp", CACHE_FILE);
        } else {
          SerialMon.println(F("[FS] Error creating temp file for cache update."));
          if(tempFile) tempFile.close();
          if(originalFile) originalFile.close();
          allDataSent = false;
          break; 
        }
      } else {
        LittleFS.remove(CACHE_FILE);
        SerialMon.println(F("[FS] All cached data sent."));
        break; 
      }
    } else {
      SerialMon.println(F("[FS] Failed to send batch data. Cache will be kept."));
      if (error) {
        SerialMon.print(F("[FS] JSON parsing of server response failed: "));
        SerialMon.println(error.c_str());
      }
      if (serverResponseDoc["registered"] == false) {
        SerialMon.println(F("[FS] Server indicated device is not registered. Halting."));
        isRegistered = false;
      }
      allDataSent = false;
      file.close();
      break; 
    }
  }
  return allDataSent;
}

bool fs_cache_exists() {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while checking cache."));
    return false;
  }
  return LittleFS.exists(CACHE_FILE);
}
