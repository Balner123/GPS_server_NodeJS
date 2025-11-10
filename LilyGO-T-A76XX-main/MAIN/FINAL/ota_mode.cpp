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
bool lastGprsTestSuccess = false;
bool handshakeAttemptedOTA = false;
bool handshakeSucceededOTA = false;

void start_ota_mode() {
  SerialMon.println(F("--- OTA Service Mode Activated ---"));
#ifdef BOARD_POWERON_PIN
  pinMode(BOARD_POWERON_PIN, OUTPUT);
  digitalWrite(BOARD_POWERON_PIN, HIGH);
#endif
  status_led_set(true);

  gprsConnectedOTA = false;
  lastGprsTestSuccess = false;
  handshakeAttemptedOTA = false;
  handshakeSucceededOTA = false;

  // Ensure the power-management button ISR/task is active while in OTA mode.
  power_init();
  power_set_ota_mode_active(true);

  // Mount filesystem and open Preferences so configuration reads/writes work in OTA.
  if (!fs_init()) {
    SerialMon.println(F("[OTA] Failed to initialize filesystem; using defaults only."));
  }

  // Load configuration from Preferences (needed for OTA SSID/Pass and GPRS settings)
  fs_load_configuration();

  // Set Device ID from MAC Address, this is permanent and unique
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  // Use the last 10 characters of the MAC address for a shorter ID
  deviceID = mac.substring(mac.length() - 10);
  SerialMon.print(F("Device ID (last 10 of MAC): "));
  SerialMon.println(deviceID);

  auto finalizeOtaHotspot = [&]() {
    if (ota_ssid == DEFAULT_OTA_SSID) {
      ota_ssid = String(DEFAULT_OTA_SSID) + "_" + deviceID;
    }
  };
  finalizeOtaHotspot();

  // 1. Initialize and connect modem first (for registration/testing GPRS)
  SerialMon.println(F("Initializing modem for OTA mode..."));
  gprsConnectedOTA = false;
  if (modem_initialize()) {
    gprsConnectedOTA = modem_connect_gprs(apn, gprsUser, gprsPass);
    lastGprsTestSuccess = gprsConnectedOTA;
    if (gprsConnectedOTA) {
      SerialMon.println(F("Modem ready and connected to GPRS."));
      handshakeAttemptedOTA = true;
      SerialMon.println(F("Performing handshake in OTA mode..."));
      handshakeSucceededOTA = modem_perform_handshake();
      if (handshakeSucceededOTA) {
        SerialMon.println(F("Handshake completed successfully."));
        fs_load_configuration();
        finalizeOtaHotspot();
      } else {
        SerialMon.println(F("Handshake failed in OTA mode."));
      }
    } else {
      SerialMon.println(F("Modem initialized, but GPRS connection failed."));
    }
  } else {
    SerialMon.println(F("Modem initialization failed; OTA GPRS features unavailable."));
  }

  // 2. Start WiFi AP
  SerialMon.println(F("Starting WiFi AP..."));
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  bool apStarted = WiFi.softAP(ota_ssid.c_str(), ota_password.c_str());
  if (apStarted) {
    SerialMon.println(F("WiFi AP started with configured credentials."));
  } else {
    SerialMon.println(F("[OTA] Failed to start WiFi AP with configured credentials; fallback open AP may be used."));
  }
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

    String registrationClass = "pending";
    String registrationStatus;
    if (handshakeAttemptedOTA) {
      if (handshakeSucceededOTA) {
        if (isRegistered) {
          registrationClass = "ok";
          registrationStatus = "Registered";
        } else {
          registrationClass = "fail";
          registrationStatus = "Not Registered";
        }
      } else {
        registrationClass = "fail";
        registrationStatus = "Handshake Failed";
      }
    } else {
      registrationStatus = isRegistered ? "Registered (cached)" : "Not Registered (cached)";
    }
    page_content.replace("%registration_status_class%", registrationClass);
    page_content.replace("%registration_status%", registrationStatus);

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
    page_content.replace("%server_btn_disabled%", (gprsConnectedOTA && lastGprsTestSuccess) ? "" : "disabled");
    page_content.replace("%initial_gprs_flag%", (gprsConnectedOTA && lastGprsTestSuccess) ? "true" : "false");
    otaServer.send(200, "text/html", page_content);
  });

  // Handler for saving settings
  otaServer.on("/savesettings", HTTP_POST, []() {
    auto sendValidationError = [](const String& message) {
      String response = F("<html><body><h3>Settings not saved</h3><p>");
      response += message;
      response += F("</p><p><a href=\"/settings\">Back to settings</a></p></body></html>");
      otaServer.send(400, "text/html", response);
    };

    String requestedOtaSsid = otaServer.arg("ota_ssid");
    if (requestedOtaSsid.length() == 0 || requestedOtaSsid.length() > 31) {
      sendValidationError(F("OTA SSID must be 1-31 characters long."));
      return;
    }

    String new_ota_pass = otaServer.arg("ota_password");
    String new_ota_pass_confirm = otaServer.arg("ota_password_confirm");
    if (new_ota_pass != new_ota_pass_confirm) {
      sendValidationError(F("OTA WiFi passwords do not match."));
      return;
    }
    if (new_ota_pass.length() > 0 && (new_ota_pass.length() < 8 || new_ota_pass.length() > 63)) {
      sendValidationError(F("OTA WiFi password must be 8-63 characters (or leave empty for open network)."));
      return;
    }

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
    preferences.putString("ota_ssid", requestedOtaSsid);
    preferences.putString("ota_password", new_ota_pass);

    preferences.end();

    // Reload config to apply immediately for things like OTA SSID
    fs_load_configuration();

    modem_disconnect_gprs();
    gprsConnectedOTA = false;
    lastGprsTestSuccess = false;
    handshakeAttemptedOTA = false;
    handshakeSucceededOTA = false;

    if (modem_initialize()) {
      gprsConnectedOTA = modem_connect_gprs(apn, gprsUser, gprsPass);
      lastGprsTestSuccess = gprsConnectedOTA;
      if (gprsConnectedOTA) {
        handshakeAttemptedOTA = true;
        handshakeSucceededOTA = modem_perform_handshake();
        if (handshakeSucceededOTA) {
          fs_load_configuration();
        }
      }
    }

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
    lastGprsTestSuccess = success;

    String message = success ? "GPRS test connection successful." : "GPRS test connection failed.";
    SerialMon.println(message);

    modem_disconnect_gprs(); // Disconnect after test

    // Reconnect with original settings (if it was connected before)
    SerialMon.println("Reconnecting to GPRS with saved settings...");
    bool restored = modem_connect_gprs(apn, gprsUser, gprsPass);
    gprsConnectedOTA = restored;
    if (restored) {
      SerialMon.println("Reconnected successfully.");
    } else {
      SerialMon.println("Failed to reconnect to GPRS with saved settings.");
      handshakeAttemptedOTA = false;
      handshakeSucceededOTA = false;
      message += " Saved credentials failed to reconnect.";
    }

    DynamicJsonDocument doc(192);
    doc["success"] = success;
    doc["message"] = message;
    doc["restored"] = restored;
    String json;
    serializeJson(doc, json);
    otaServer.send(200, "application/json", json);
  });

  // Handler for testing server connection
  otaServer.on("/testserver", HTTP_GET, []() {
    DynamicJsonDocument doc(192);

    if (!gprsConnectedOTA) {
      doc["success"] = false;
      doc["message"] = "GPRS not connected.";
      String json;
      serializeJson(doc, json);
      otaServer.send(200, "application/json", json);
      return;
    }

    if (!lastGprsTestSuccess) {
      doc["success"] = false;
      doc["message"] = "Run a successful GPRS test before testing the server.";
      String json;
      serializeJson(doc, json);
      otaServer.send(200, "application/json", json);
      return;
    }

    String test_host = otaServer.arg("host");
    int test_port = otaServer.arg("port").toInt();

    if (test_host.length() == 0) {
      doc["success"] = false;
      doc["message"] = "Server host must not be empty.";
      String json;
      serializeJson(doc, json);
      otaServer.send(200, "application/json", json);
      return;
    }

    if (test_port <= 0 || test_port > 65535) {
      doc["success"] = false;
      doc["message"] = "Server port must be between 1 and 65535.";
      String json;
      serializeJson(doc, json);
      otaServer.send(200, "application/json", json);
      return;
    }

    SerialMon.println("--- Testing Server Connection ---");
    SerialMon.printf("Host: %s, Port: %d\n", test_host.c_str(), test_port);

    bool success = modem_test_server_connection(test_host, test_port);
    doc["success"] = success;
    doc["message"] = success ? "Server reachable over TCP." : "Failed to open TCP connection to server.";

    String json;
    serializeJson(doc, json);
    otaServer.send(200, "application/json", json);
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
  regDoc["client_type"] = CLIENT_TYPE;
  regDoc["username"] = username;
  regDoc["password"] = password;
  regDoc["device_id"] = deviceID;
  regDoc["name"] = deviceName;
    String registrationPayload;
    serializeJson(regDoc, registrationPayload);

  String response = modem_send_post_request(RESOURCE_REGISTER, registrationPayload, nullptr);

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

  power_set_ota_mode_active(false);
}
