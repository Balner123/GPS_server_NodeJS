/*  ESP32 SIM800L HTTP POST using TinyGSM Library
 *  Improved version of original AT command implementation
 */

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>

// SIM800L pin configuration
#define SIM800L_RX     27
#define SIM800L_TX     26
#define SIM800L_PWRKEY 4
#define SIM800L_RST    5
#define SIM800L_POWER  23

// Serial for AT commands
#define SerialAT Serial2

// TinyGSM objects
TinyGsm modem(SerialAT);
TinyGsmClient client(modem);

// Network credentials
const char apn[] = "internet.t-mobile.cz";
const char user[] = "gprs";
const char pass[] = "gprs";

// Server details
const char server[] = "129.151.193.104";
const int port = 5000;
const String resource = "/";

// HTTP client
HttpClient http(client, server, port);

void setup() {
  // Set power pin as output and turn on module
  pinMode(SIM800L_POWER, OUTPUT);
  digitalWrite(SIM800L_POWER, HIGH);
  
  // Initialize Serial
  Serial.begin(115200);
  Serial.println("ESP32+SIM800L HTTP POST Test using TinyGSM");
  
  // Initialize SerialAT for SIM800L
  SerialAT.begin(9600, SERIAL_8N1, SIM800L_TX, SIM800L_RX);
  
  // Give the module time to power up
  delay(3000);
  
  // Initialize modem
  Serial.println("Initializing modem...");
  if (!modem.init()) {
    Serial.println("Failed to initialize modem!");
    while (1) {}
  }
  
  // Display modem info
  String modemInfo = modem.getModemInfo();
  Serial.println("Modem Info: " + modemInfo);
  
  // Connect to GPRS
  connectToNetwork();
}

void loop() {
  // Check if still connected to network, reconnect if needed
  if (!modem.isNetworkConnected()) {
    Serial.println("Network disconnected!");
    connectToNetwork();
  }
  
  // Make the HTTP POST request
  sendHttpPostRequest("param=TestFromMySim800");
  
  // Wait before next request
  delay(30000);
}

void connectToNetwork() {
  Serial.println("Connecting to network...");
  
  // Wait for network registration
  if (!modem.waitForNetwork(60000L)) {
    Serial.println("Network registration failed!");
    delay(10000);
    return;
  }
  
  Serial.println("Network connected");
  
  // Connect to GPRS
  if (!modem.gprsConnect(apn, user, pass)) {
    Serial.println("GPRS connection failed!");
    delay(10000);
    return;
  }
  
  Serial.println("GPRS connected");
}

void sendHttpPostRequest(String postData) {
  Serial.println("Making HTTP POST request...");
  
  // Set content type
  http.beginRequest();
  http.post(resource);
  http.sendHeader("Content-Type", "application/x-www-form-urlencoded");
  http.sendHeader("Content-Length", postData.length());
  http.beginBody();
  http.print(postData);
  http.endRequest();
  
  // Read the status code and response
  int statusCode = http.responseStatusCode();
  String response = http.responseBody();
  
  Serial.println("Status code: " + String(statusCode));
  Serial.println("Response: " + response);
  
  // Check if successful
  if (statusCode != 200) {
    Serial.println("HTTP POST request failed");
  }
}