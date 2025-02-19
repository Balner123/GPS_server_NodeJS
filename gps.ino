#define TINY_GSM_MODEM_SIM800

#include <Arduino.h>
#include <TinyGsmClient.h>

// Piny pro GPS modul (UART2)
#define GPS_TX 14
#define GPS_RX 27

// Piny pro SIM800L (UART1)
#define SIM800_TX 26
#define SIM800_RX 27
#define SIM800_PWRKEY 4
#define SIM800_RST 5
#define SIM800_POWER 23

// Nastavení APN a serveru
const char apn[] = "internet.t-mobile.cz";
const char* url = "http://129.151.193.104:5000/device_input";
int device = 606;

// Inicializace sériových portů
HardwareSerial SerialGPS(2);  // GPS na UART2
HardwareSerial SerialAT(1);   // SIM800L na UART1
TinyGsm modem(SerialAT);

void setup() {
  Serial.begin(115200);
  SerialGPS.begin(9600, SERIAL_8N1, GPS_TX, GPS_RX);
  SerialAT.begin(9600, SERIAL_8N1, SIM800_TX, SIM800_RX);

  Serial.println("Čekám na platné GPS souřadnice...");
  
  float latitude = 0.0, longitude = 0.0;
  bool gpsFix = false;

  // Čekáme na platné GPS souřadnice
  while (!gpsFix) {
    if (SerialGPS.available()) {
      String gpsData = SerialGPS.readStringUntil('\n');
      Serial.println("GPS RAW: " + gpsData);

      if (gpsData.startsWith("$GNGGA")) { // Formát NMEA
        char *ptr = strtok((char*)gpsData.c_str(), ",");
        int field = 0;
        while (ptr != NULL) {
          field++;
          if (field == 3) latitude = atof(ptr) / 100.0; // Šířka
          if (field == 5) longitude = atof(ptr) / 100.0; // Délka
          ptr = strtok(NULL, ",");
        }
        if (latitude != 0.0 && longitude != 0.0) gpsFix = true;
      }
    }
    delay(500);
  }

  Serial.println("GPS FIX! Souřadnice: " + String(latitude, 6) + ", " + String(longitude, 6));

  // Zapnutí napájení SIM800L
  pinMode(SIM800_POWER, OUTPUT);
  digitalWrite(SIM800_POWER, HIGH);
  delay(3000); // Čekání na zapnutí

  Serial.println("Startuji modem...");
  modem.restart();
  delay(3000);

  Serial.print("Připojuji se k GPRS...");
  if (!modem.gprsConnect(apn, "", "")) {
    Serial.println("Připojení selhalo!");
    while (1) { delay(1000); }
  }
  Serial.println("Připojeno!");

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
  // ESP32 přejde do hlubokého spánku, takže loop není potřeba.
}

// Pomocná funkce pro odeslání AT příkazu a čekání na odpověď
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

// Odesílání HTTP POST přes AT příkazy
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
