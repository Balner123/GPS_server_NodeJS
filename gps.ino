// Určete model modemu před zahrnutím knihovny
#define TINY_GSM_MODEM_SIM800

#include <Arduino.h>
#include <TinyGsmClient.h>

// Definice pinů pro SIM800L
#define SIM800_RX     27
#define SIM800_TX     26
#define SIM800_PWRKEY 4
#define SIM800_RST    5
#define SIM800_POWER  23

// Nastavení APN, URL a ID zařízení
const char apn[] = "internet.t-mobile.cz";
// const char* url = "http://gps-server-nodejs.onrender.com/device_input";  
const char* url = "http://129.151.193.104:5000/device_input";
int device = 606;

// Použijeme HardwareSerial pro komunikaci s modulem
HardwareSerial SerialAT(2);
TinyGsm modem(SerialAT);

// Pomocná funkce pro odeslání AT příkazu a čekání na očekávanou odpověď
bool sendAT(const String &command, const String &expected, unsigned long timeout = 5000) {
  Serial.print("Send ->: ");
  Serial.println(command);
  SerialAT.println(command);
  
  unsigned long start = millis();
  String response;
  while(millis() - start < timeout) {
    while(SerialAT.available()) {
      response += (char)SerialAT.read();
    }
    if (response.indexOf(expected) != -1) {
      Serial.print("Response: ");
      Serial.println(response);
      return true;
    }
  }
  Serial.print("Timeout/Error, response: ");
  Serial.println(response);
  return false;
}

// Vlastní implementace HTTP POST pomocí AT příkazů
bool gsm_http_post(String url, String postData) {
  Serial.println("----- HTTP POST Start -----");
  
  if (!sendAT("AT+HTTPINIT", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CID\",1", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"URL\",\"" + url + "\"", "OK")) return false;
  if (!sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK")) return false;
  
  String httpDataCmd = "AT+HTTPDATA=" + String(postData.length()) + ",10000";
  if (!sendAT(httpDataCmd, "DOWNLOAD")) return false;
  
  // Odeslání těla POST požadavku
  SerialAT.print(postData);
  delay(2000);
  
  if (!sendAT("AT+HTTPACTION=1", "OK")) return false;
  delay(6000);  // Čekáme na dokončení akce
  
  if (!sendAT("AT+HTTPREAD", "OK")) return false;
  
  // Ukončení HTTP session
  sendAT("AT+HTTPTERM", "OK");
  
  Serial.println("----- HTTP POST End -----");
  return true;
}

void setup() {
  // Inicializace napájení SIM800L
  pinMode(SIM800_POWER, OUTPUT);
  digitalWrite(SIM800_POWER, HIGH);

  Serial.begin(115200);
  delay(3000);  // Krátká prodleva, aby se sériový monitor stabilizoval

  // Inicializace sériové linky pro AT příkazy
  SerialAT.begin(9600, SERIAL_8N1, SIM800_TX, SIM800_RX);
  
  Serial.println("Restartuji modem...");
  modem.restart();
  delay(3000);
  
  // Připojení k GPRS síti
  Serial.print("Připojuji se k GPRS...");
  if (!modem.gprsConnect(apn, "", "")) {
    Serial.println("Připojení selhalo!");
    while (1) { delay(1000); }
  }
  Serial.println("Připojeno!");
  
  // Vygenerujeme náhodné souřadnice
  float latitude = random(-90000000, 90000000) / 1000000.0;
  float longitude = random(-180000000, 180000000) / 1000000.0;
  
  // Sestavíme data ve formátu JSON
  String postData = "{\"latitude\":" + String(latitude, 6) +
                    ",\"longitude\":" + String(longitude, 6) +
                    ",\"device\":" + String(device) + "}";
  
  Serial.println("Odesílám data: " + postData);
  
  // Odeslání HTTP POST požadavku
  if (gsm_http_post(url, postData)) {
    Serial.println("HTTP POST byl úspěšný.");
  } else {
    Serial.println("HTTP POST selhal.");
  }
  
  modem.gprsDisconnect();
  
  Serial.println("Data byla odeslána, přecházím do hlubokého spánku.");
  delay(2000);
  esp_deep_sleep_start();
}

void loop() {
  // Loop není potřeba, zařízení se po odeslání uspí.
}

