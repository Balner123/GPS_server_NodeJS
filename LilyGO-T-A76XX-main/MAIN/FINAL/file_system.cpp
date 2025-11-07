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
String operationMode = "batch";

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
  if (preferences.isKey("apn")) {
    apn = preferences.getString("apn");
  } else {
    apn = DEFAULT_APN;
  }
  if (preferences.isKey("gprsUser")) {
    gprsUser = preferences.getString("gprsUser");
  } else {
    gprsUser = DEFAULT_GPRS_USER;
  }
  if (preferences.isKey("gprsPass")) {
    gprsPass = preferences.getString("gprsPass");
  } else {
    gprsPass = DEFAULT_GPRS_PASS;
  }

  // Load Server settings
  if (preferences.isKey("server")) {
    server = preferences.getString("server");
  } else {
    server = DEFAULT_SERVER_HOST;
  }
  if (preferences.isKey("port")) {
    port = preferences.getUInt("port");
  } else {
    port = DEFAULT_SERVER_PORT;
  }

  // Load Device settings
  if (preferences.isKey("deviceName")) {
    deviceName = preferences.getString("deviceName");
  } else {
    deviceName = DEFAULT_DEVICE_NAME;
  }
  if (preferences.isKey("mode")) {
    operationMode = preferences.getString("mode");
  } else {
    operationMode = "batch";
  }

  // Load OTA settings
  if (preferences.isKey("ota_ssid")) {
    ota_ssid = preferences.getString("ota_ssid");
  } else {
    ota_ssid = DEFAULT_OTA_SSID;
  }
  if (preferences.isKey("ota_password")) {
    ota_password = preferences.getString("ota_password");
  } else {
    ota_password = DEFAULT_OTA_PASSWORD;
  }

  // Load sleep time and batch size
  if (preferences.isKey("sleepTime")) {
    sleepTimeSeconds = preferences.getULong64("sleepTime");
  } else {
    sleepTimeSeconds = DEFAULT_SLEEP_SECONDS;
  }
  if (preferences.isKey("minSats")) {
    minSatellitesForFix = preferences.getInt("minSats");
  } else {
    minSatellitesForFix = SAT_THRESHOLD;
  }
  if (preferences.isKey("registered")) {
    isRegistered = preferences.getBool("registered");
  } else {
    isRegistered = true;
  }

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
    bool batchContainsPowerStatus = false;

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
        if (!batchContainsPowerStatus && line.indexOf(F("\"power_status\"")) != -1) {
          batchContainsPowerStatus = true;
        }
      }
    }
    payload += "]";

    if (recordCount == 0) {
      file.close();
      LittleFS.remove(CACHE_FILE); // No valid records found, clear cache
      return true;
    }

    SerialMon.printf("[FS] Sending batch of %d records...\n", recordCount);
    int httpStatus = 0;
    String response = modem_send_post_request(RESOURCE_POST, payload, &httpStatus);

    if (httpStatus == 404) {
      SerialMon.println(F("[FS] Server returned 404 - device not registered."));
      fs_set_registered(false);
      allDataSent = false;
      file.close();
      break;
    }

    if (httpStatus == 409) {
      SerialMon.println(F("[FS] Server returned 409 - device claimed by another user."));
      fs_set_registered(false);
      allDataSent = false;
      file.close();
      break;
    }

    if (httpStatus >= 500) {
      SerialMon.print(F("[FS] Server error while sending batch: "));
      SerialMon.println(httpStatus);
      allDataSent = false;
      file.close();
      break;
    }

    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error && httpStatus < 400) {
      if (!serverResponseDoc["config"].isNull()) {
        fs_apply_server_config(serverResponseDoc["config"]);
      } else {
        // Backwards compatibility with legacy flat responses
        fs_apply_server_config(serverResponseDoc.as<JsonVariantConst>());
      }
      if (!serverResponseDoc["registered"].isNull()) {
        fs_set_registered(serverResponseDoc["registered"].as<bool>());
        if (!isRegistered) {
          SerialMon.println(F("[FS] Server indicated device is not registered."));
        }
      }
    }

    if (!error && serverResponseDoc["success"] == true && httpStatus < 400) {
      SerialMon.println(F("[FS] Batch sent successfully. Updating cache file."));
      if (batchContainsPowerStatus) {
        power_instruction_acknowledged();
        power_status_report_acknowledged();
      }
      
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
        fs_set_registered(false);
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

void fs_apply_server_config(const JsonVariantConst& config) {
  if (config.isNull()) {
    return;
  }

  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while applying server config."));
    return;
  }

  if (!config["interval_gps"].isNull()) {
    uint64_t interval = config["interval_gps"].as<uint64_t>();
    if (interval > 0) {
      sleepTimeSeconds = interval;
      preferences.putULong64("sleepTime", sleepTimeSeconds);
      SerialMon.print(F("[FS] Server set GPS interval to: "));
      SerialMon.println(sleepTimeSeconds);
    }
  }

  if (!config["interval_send"].isNull()) {
    uint8_t sendInterval = config["interval_send"].as<uint8_t>();
    if (sendInterval == 0) {
      sendInterval = 1;
    }
    if (sendInterval > 50) {
      sendInterval = 50;
    }
    preferences.putUChar(KEY_BATCH_SIZE, sendInterval);
    SerialMon.print(F("[FS] Server set send interval (batch size) to: "));
    SerialMon.println(sendInterval);
  }

  if (!config["satellites"].isNull()) {
    minSatellitesForFix = config["satellites"].as<int>();
    preferences.putInt("minSats", minSatellitesForFix);
    SerialMon.print(F("[FS] Server set minimum satellites to: "));
    SerialMon.println(minSatellitesForFix);
  }

  if (!config["mode"].isNull()) {
    operationMode = config["mode"].as<String>();
    preferences.putString("mode", operationMode);
    SerialMon.print(F("[FS] Server set operation mode to: "));
    SerialMon.println(operationMode);
  }
}

void fs_set_registered(bool registered) {
  FsLockGuard lock;
  if (!lock.isLocked()) {
    SerialMon.println(F("[FS] Failed to acquire FS lock while updating registration state."));
    return;
  }
  isRegistered = registered;
  preferences.putBool("registered", registered);
}
