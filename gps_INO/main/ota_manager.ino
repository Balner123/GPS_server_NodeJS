// ota_manager.ino
#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include "esp_ota_ops.h" // For partition management

// --- Konfigurace ---
const int MODE_SWITCH_PIN = 12; // Pin pro přepínač režimu (změňte podle potřeby)
// Předpoklad: LOW = OTA režim, HIGH (pull-up) = GPS Tracker režim

const char* AP_SSID = "ESP32_GPS";    // SSID Wi-Fi sítě, kterou ESP32 vytvoří
const char* AP_PASSWORD = "root"; // Heslo k této Wi-Fi (min. 8 znaků)

const char* USER_APP_PARTITION_LABEL = "user_app"; // Název uživatelské partition z partitions.csv
const char* FACTORY_PARTITION_LABEL = "factory";   // Název factory partition z partitions.csv
// --- ---

WebServer server(80);
bool ota_server_active = false;

const char* serverIndex =
  "<form method='POST' action='/update' enctype='multipart/form-data'>"
  "<h3>Nahrát firmware pro GPS Tracker (user_app.bin)</h3>"
  "<input type='file' name='update' accept='.bin'><br><br>"
  "<input type='submit' value='Nahrát a restartovat'>"
  "</form>";

void start_ota_server() {
  Serial.println("Spouštím OTA server...");
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress AP_IP = WiFi.softAPIP();
  Serial.print("AP IP adresa: ");
  Serial.println(AP_IP);
  Serial.print("Připojte se k Wi-Fi: ");
  Serial.println(AP_SSID);

  server.on("/", HTTP_GET, []() {
    server.sendHeader("Connection", "close");
    server.send(200, "text/html", serverIndex);
  });

  server.on("/update", HTTP_POST, []() { // Odpověď po dokončení/selhání
    server.sendHeader("Connection", "close");
    bool success = !Update.hasError();
    if (success) {
        server.send(200, "text/plain", "OK. Restartuji s novým user_app...");
        delay(1000);
        ESP.restart(); // Restartuje do nově nahraného user_app
    } else {
        server.send(500, "text/plain", "FAIL. Chyba OTA aktualizace.");
    }
  }, []() { // Zpracování nahrávání souboru
    HTTPUpload& upload = server.upload();
    if (upload.status == UPLOAD_FILE_START) {
      Serial.printf("OTA Update Start: %s pro partition '%s'\n", upload.filename.c_str(), USER_APP_PARTITION_LABEL);
      if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_PART, USER_APP_PARTITION_LABEL)) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(Serial);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) { // true = nastavit tuto partition jako bootovatelnou
        Serial.printf("OTA Update Success: %u bytes\n", upload.totalSize);
      } else {
        Update.printError(Serial);
      }
    }
  });

  server.begin();
  Serial.println("HTTP server spuštěn. Otevřete http://<IP_ADRESA_ESP32> v prohlížeči.");
  ota_server_active = true;
}

void boot_user_app() {
  Serial.println("Pokus o spuštění uživatelské aplikace (user_app)...");
  const esp_partition_t* user_app_partition = esp_ota_get_partition_by_label(USER_APP_PARTITION_LABEL);

  if (user_app_partition == nullptr) {
    Serial.printf("Chyba: Partition '%s' nenalezena! Spouštím OTA server.\n", USER_APP_PARTITION_LABEL);
    start_ota_server();
    return;
  }

  if (user_app_partition->type != ESP_PARTITION_TYPE_APP) {
    Serial.printf("Chyba: Partition '%s' není typu APP! Spouštím OTA server.\n", USER_APP_PARTITION_LABEL);
    start_ota_server();
    return;
  }
  
  // Zkontrolujeme, zda se nesnažíme bootovat sami sebe, pokud by user_app byla prázdná/stejná jako factory
  const esp_partition_t* running_partition = esp_ota_get_running_partition();
  if (user_app_partition == running_partition) {
    Serial.printf("Uživatelská partition '%s' je stejná jako běžící factory partition. Pravděpodobně ještě nebyla nahrána. Spouštím OTA server.\n", USER_APP_PARTITION_LABEL);
    start_ota_server();
    return;
  }

  Serial.printf("Nastavuji boot na partition '%s' a restartuji.\n", USER_APP_PARTITION_LABEL);
  esp_err_t err = esp_ota_set_boot_partition(user_app_partition);
  if (err == ESP_OK) {
    ESP.restart();
  } else {
    Serial.printf("Chyba při nastavování boot partition na '%s': %s. Spouštím OTA server.\n", USER_APP_PARTITION_LABEL, esp_err_to_name(err));
    start_ota_server();
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\nOTA Manager spuštěn.");

  pinMode(MODE_SWITCH_PIN, INPUT_PULLUP); // Aktivní LOW pro OTA režim
  delay(100); // Krátká pauza pro stabilizaci pinu

  bool ota_mode_active = (digitalRead(MODE_SWITCH_PIN) == LOW);

  if (ota_mode_active) {
    Serial.println("Přepínač v poloze OTA: Aktivuji OTA server.");
    start_ota_server();
  } else {
    Serial.println("Přepínač v poloze GPS Tracker: Pokus o spuštění user_app.");
    boot_user_app();
  }
}

void loop() {
  if (ota_server_active) {
    server.handleClient();
  }
  delay(10); // Malé zpoždění, aby se ESP32 nezahltilo
} 