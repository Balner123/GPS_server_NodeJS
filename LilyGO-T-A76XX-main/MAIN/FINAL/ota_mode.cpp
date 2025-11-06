#include "ota_mode.h"
#include "modem_control.h" // For modem_initialize, modem_connect_gprs, modem_disconnect_gprs, modem_send_post_request
#include "file_system.h"   // For fs_load_configuration
#include "power_management.h" // For power_init and graceful shutdown support

// Global objects and variables for OTA mode
WebServer otaServer(80);
String ota_ssid = DEFAULT_OTA_SSID;
String ota_password = DEFAULT_OTA_PASSWORD;

// Global flag for GPRS connection status in OTA mode
bool gprsConnectedOTA = false;

void start_ota_mode() {
  SerialMon.println(F("--- OTA Service Mode Activated ---"));
  status_led_set(true);

  // Ensure the power-management button ISR/task is active while in OTA mode.
  power_init();

  // Load configuration from Preferences (needed for OTA SSID/Pass and GPRS settings)
  fs_load_configuration();

  // Set Device ID from MAC Address, this is permanent and unique
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  // Use the last 10 characters of the MAC address for a shorter ID
  deviceID = mac.substring(mac.length() - 10);
  SerialMon.print(F("Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);

  // Finalize default OTA SSID if not customized yet
  if (ota_ssid == DEFAULT_OTA_SSID) {
    ota_ssid = String(DEFAULT_OTA_SSID) + "_" + deviceID;
  }

  // 1. Initialize and connect modem first (for registration/testing GPRS)
  SerialMon.println(F("Skipping modem initialization in OTA mode (WiFi only)."));
  gprsConnectedOTA = false;

  // 2. Start WiFi AP
  SerialMon.println(F("Starting WiFi AP..."));
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ota_ssid.c_str(), ota_password.c_str());
  IPAddress apIP = WiFi.softAPIP();
  SerialMon.print(F("AP IP address: "));
  SerialMon.println(apIP);

  // 3. Define Web Server Handlers

  // Handler for the main service page
  otaServer.on("/", HTTP_GET, []() {
    String page_content = String(ota_main_page_template);
    page_content.replace("%id%", deviceID);
    if (gprsConnectedOTA) {
      page_content.replace("%gprs_status_class%", "ok");
      page_content.replace("%gprs_status%", "Connected");
    } else {
      page_content.replace("%gprs_status_class%", "fail");
      page_content.replace("%gprs_status%", "Connection Failed");
    }
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the firmware update page
  otaServer.on("/update", HTTP_GET, []() {
    String page_content = String(update_form_page);
    page_content.replace("%id%", deviceID);
    page_content.replace("%s%", ota_ssid);
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the settings page
  otaServer.on("/settings", HTTP_GET, []() {
    String page_content = String(settings_page_template);
    page_content.replace("%apn%", apn);
    page_content.replace("%gprsUser%", gprsUser);
    page_content.replace("%gprsPass%", gprsPass);
    page_content.replace("%server%", server);
    page_content.replace("%port%", String(port));
    page_content.replace("%deviceName%", deviceName);
    page_content.replace("%ota_ssid%", ota_ssid);
    page_content.replace("%ota_password%", ota_password);
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for saving settings
  otaServer.on("/savesettings", HTTP_POST, []() {
    Preferences preferences;
    preferences.begin(PREFERENCES_NAMESPACE, false);

    // GPRS
    if (otaServer.hasArg("apn")) preferences.putString("apn", otaServer.arg("apn"));
    if (otaServer.hasArg("gprsUser")) preferences.putString("gprsUser", otaServer.arg("gprsUser"));
    
    String new_gprs_pass = otaServer.arg("gprsPass");
    String new_gprs_pass_confirm = otaServer.arg("gprsPassConfirm");
    if (new_gprs_pass == new_gprs_pass_confirm) {
        preferences.putString("gprsPass", new_gprs_pass);
    }

    // Server
    if (otaServer.hasArg("server")) preferences.putString("server", otaServer.arg("server"));
    if (otaServer.hasArg("port")) preferences.putUInt("port", otaServer.arg("port").toInt());

    // Device
    if (otaServer.hasArg("deviceName")) preferences.putString("deviceName", otaServer.arg("deviceName"));

    // OTA
    if (otaServer.hasArg("ota_ssid")) preferences.putString("ota_ssid", otaServer.arg("ota_ssid"));

    String new_ota_pass = otaServer.arg("ota_password");
    String new_ota_pass_confirm = otaServer.arg("ota_password_confirm");
    if (new_ota_pass == new_ota_pass_confirm) {
        preferences.putString("ota_password", new_ota_pass);
    }
    
    preferences.end();

    // Reload config to apply immediately for things like OTA SSID
    fs_load_configuration();

    // Redirect back to settings page with a success message (or a dedicated success page)
    otaServer.sendHeader("Location", "/settings", true);
    otaServer.send(302, "text/plain", "");
  });

  // Handler for testing GPRS connection
  otaServer.on("/testgprs", HTTP_GET, []() {
    String test_apn = otaServer.arg("apn");
    String test_user = otaServer.arg("user");
    String test_pass = otaServer.arg("pass");

    SerialMon.println("--- Testing GPRS Connection ---");
    SerialMon.printf("APN: %s, User: %s\n", test_apn.c_str(), test_user.c_str());

    modem_disconnect_gprs(); // Disconnect any existing GPRS connection
    SerialMon.println("GPRS disconnected for test.");
    delay(1000);

    bool success = modem_connect_gprs(test_apn, test_user, test_pass);

    if (success) {
      SerialMon.println("GPRS test connection successful.");
      otaServer.send(200, "application/json", "{\"success\":true}");
      modem_disconnect_gprs(); // Disconnect after test
    } else {
      SerialMon.println("GPRS test connection failed.");
      otaServer.send(200, "application/json", "{\"success\":false}");
    }

    // Reconnect with original settings (if it was connected before)
    SerialMon.println("Reconnecting to GPRS with saved settings...");
    gprsConnectedOTA = modem_connect_gprs(apn, gprsUser, gprsPass);
    if (gprsConnectedOTA) {
      SerialMon.println("Reconnected successfully.");
    } else {
      SerialMon.println("Failed to reconnect to GPRS with saved settings.");
    }
  });

  // Handler for testing server connection
  otaServer.on("/testserver", HTTP_GET, []() {
    if (!gprsConnectedOTA) {
      otaServer.send(200, "application/json", "{\"success\":false, \"reason\":\"GPRS not connected\"}");
      return;
    }

    String test_host = otaServer.arg("host");
    int test_port = otaServer.arg("port").toInt();

    SerialMon.println("--- Testing Server Connection ---");
    SerialMon.printf("Host: %s, Port: %d\n", test_host.c_str(), test_port);

    // This requires a TinyGsmClient instance, which is currently global in modem_control.cpp
    // For now, we'll assume modem_send_post_request can handle a dummy request or we need to expose client
    // A better approach would be to pass a client object or have a dedicated test function in modem_control
    // For simplicity, we'll just try to connect using the modem's internal client if available
    // This part needs actual implementation in modem_control.cpp to expose a connect test
    bool success = false; // Placeholder
    // TODO: Implement actual server connection test via modem_control
    // For now, simulate success if host is not empty
    if (test_host.length() > 0) {
      success = true; // Simulate success
    }

    if (success) {
      SerialMon.println("Server test connection successful (simulated).");
      otaServer.send(200, "application/json", "{\"success\":true}");
    } else {
      SerialMon.println("Server test connection failed (simulated).");
      otaServer.send(200, "application/json", "{\"success\":false}");
    }
  });

  // Handler for the registration form submission
  otaServer.on("/doregister", HTTP_POST, []() {
    if (!gprsConnectedOTA) {
      otaServer.send(503, "text/plain", "GPRS not connected. Cannot process registration.");
      return;
    }
    if (!otaServer.hasArg("username") || !otaServer.hasArg("password")) {
      otaServer.send(400, "text/plain", "Missing username or password.");
      return;
    }
    String username = otaServer.arg("username");
    String password = otaServer.arg("password");

    JsonDocument regDoc;
    regDoc["username"] = username;
    regDoc["password"] = password;
    regDoc["deviceId"] = deviceID;
    regDoc["name"] = deviceName;
    String registrationPayload;
    serializeJson(regDoc, registrationPayload);

    String response = modem_send_post_request(RESOURCE_REGISTER, registrationPayload);

    // Prepare styled response page
    String page_content = String(ota_response_page_template);
    String message = "";
    
    JsonDocument serverResponseDoc;
    DeserializationError error = deserializeJson(serverResponseDoc, response);

    if (!error && serverResponseDoc["success"] == true) {
      message = "Device registered successfully! Please reboot the device into normal mode.";
      page_content.replace("%status_class%", "ok");
    } else {
      message = "Registration failed. Please check credentials and try again.";
      // Optionally add more details from the server response if available
      if (response.length() > 0) {
        String server_msg = serverResponseDoc["error"].as<String>();
        if (server_msg.length() > 0) {
          message += "<br><small>Reason: " + server_msg + "</small>";
        }
      }
      page_content.replace("%status_class%", "fail");
    }
    
    page_content.replace("%message%", message);
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for the actual firmware update process
  otaServer.on("/update", HTTP_POST, []() {
    otaServer.sendHeader("Connection", "close");
    if (Update.hasError()) {
        char errorMsg[128];
        snprintf(errorMsg, sizeof(errorMsg), "Update failed! Error: %d - %s", Update.getError(), Update.errorString());
        String page_content = failure_page_template;
        page_content.replace("%s%", errorMsg);
        otaServer.send(500, "text/html", page_content);
    } else {
        otaServer.send(200, "text/html", success_page);
    }
  }, []() {
    HTTPUpload& upload = otaServer.upload();
    if (upload.status == UPLOAD_FILE_START) {
      SerialMon.printf("Update: %s\n", upload.filename.c_str());
      if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { // Start with max available size
        Update.printError(SerialMon);
      }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        Update.printError(SerialMon);
      }
    } else if (upload.status == UPLOAD_FILE_END) {
      if (Update.end(true)) { // True to set the size to the current progress
        SerialMon.printf("Update Success: %u bytes\n", upload.totalSize);
      } else {
        Update.printError(SerialMon);
      }
    }
  });

  // 4. Start Web Server
  otaServer.begin();
  SerialMon.println(F("OTA Web Server started. Waiting for connections..."));

  // 5. Loop indefinitely to handle OTA requests
  uint32_t lastBlink = millis();
  while (true) {
    otaServer.handleClient();
    if (millis() - lastBlink >= 250) {
      lastBlink = millis();
      status_led_toggle();
    }
    vTaskDelay(pdMS_TO_TICKS(5)); // Small delay to prevent watchdog timeout and yield to other tasks
  }
}
