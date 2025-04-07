#include <Arduino.h>
#include <TinyGPS++.h>

// ----- Serial port and hardware -----
HardwareSerial SIMSerial(2);

// GPIOs
#define GPS_POWER_PIN     25
#define SIM800_POWER_PIN  23    // VCC enable for SIM800L in your schematic
#define SIM800L_PWRKEY    4     // if available (else ignore or tie GND)

// shared UART2 RX/TX pins
#define UART_RX_PIN       27
#define UART_TX_PIN       26

// ------- Config --------
const char* DEVICE_ID  = "200";
String server_url      = "http://129.151.193.104:5000/device_input";  // API endpoint

String apn             = "internet.t-mobile.cz";
String apn_user        = "gprs";
String apn_pass        = "gprs";

#define GPS_BAUD_RATE    9600
#define GPRS_BAUD_RATE   9600

#define GPSTIMEOUT_MS    (5UL * 60UL * 1000UL)   // 5 minutes max wait
#define MIN_SATS         4

uint32_t default_sleep_seconds = 300;
uint32_t sleep_seconds = 300;   // updated after each POST

// GPS object
TinyGPSPlus gps;

void powerOnGPS() {
  // Power pin ON
  digitalWrite(GPS_POWER_PIN, HIGH);
  delay(500);  // Allow module startup

  // Initialize UART2 for GPS
  SIMSerial.begin(GPS_BAUD_RATE, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);
  delay(500);
}

void powerOffGPS() {
  // Close UART port
  SIMSerial.end();
  // Turn off GPS Power
  digitalWrite(GPS_POWER_PIN, LOW);
  delay(200);
}

// ---- AT Commands ----
String sendAT(String cmd, uint32_t timeout=3000){
  while(SIMSerial.available()) SIMSerial.read();  // clear buf
  
  Serial.println("AT >> "+cmd);
  SIMSerial.println(cmd);
  String resp = "";
  unsigned long t0 = millis();
  while(millis() - t0 < timeout){
    while(SIMSerial.available()){
      resp += char(SIMSerial.read());
    }
    if(resp.indexOf("OK")!=-1 || resp.indexOf("ERROR")!=-1 || resp.indexOf(">")!=-1) break;
  }
  Serial.println("Resp: " + resp);
  return resp;
}

bool acquireGPS(double &lat, double &lon, double &spd, double &alt, int &sats, double &hdop){
  unsigned long start = millis(), lastMsg=0;
  bool fixFound = false;

  while(millis()-start < GPSTIMEOUT_MS){
    while(SIMSerial.available()){ gps.encode(SIMSerial.read()); }

    if(gps.location.isValid() && gps.location.isUpdated() && 
       gps.satellites.isValid() && gps.satellites.value() >= MIN_SATS){

        lat = gps.location.lat();
        lon = gps.location.lng();
        spd = gps.speed.kmph();
        alt = gps.altitude.meters();
        sats= gps.satellites.value();
        hdop= gps.hdop.isValid() ? gps.hdop.hdop() : -1;
        fixFound = true;
        break;
    }
    if(millis()-lastMsg > 5000){
      lastMsg=millis();
      Serial.printf("Waiting GPS: sats %d, valid %d, updated %d\n",
        gps.satellites.isValid()?gps.satellites.value():0,
        gps.location.isValid(),
        gps.location.isUpdated());
    }
    delay(30);
  }
  return fixFound;
}

// ---- SIM800 control ----
void powerOnSIM800() {
  digitalWrite(SIM800_POWER_PIN, HIGH);
  delay(200);

  SIMSerial.begin(GPRS_BAUD_RATE, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN);
  delay(200);

  // Toggle PWRKEY 1.2sec low to turn ON
  digitalWrite(SIM800L_PWRKEY, LOW);
  delay(1200);
  digitalWrite(SIM800L_PWRKEY, HIGH);
  delay(5000);   // wait for network register
}

void powerOffSIM800() {
  SIMSerial.end();
  digitalWrite(SIM800_POWER_PIN, LOW);
  delay(500);
}

// ----------- GPRS and HTTP POST --------------
bool connectGPRS() {
  Serial.println("[SIM800] Getting signal...");

  sendAT("AT");
  sendAT("ATE0");
  sendAT("AT+CPIN?");
  sendAT("AT+CSQ");
  delay(500);

  sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"");
  sendAT("AT+SAPBR=3,1,\"APN\",\"" + apn + "\"");
  sendAT("AT+SAPBR=3,1,\"USER\",\"" + apn_user + "\"");
  sendAT("AT+SAPBR=3,1,\"PWD\",\"" + apn_pass + "\"");

  sendAT("AT+SAPBR=1,1", 10000);
  String resp = sendAT("AT+SAPBR=2,1");
  if(resp.indexOf("+SAPBR:") != -1) {
    Serial.println("GPRS opened");
    return true;
  }
  Serial.println("Failed to open bearer");
  return false;
}

bool postData(double lat, double lon, double spd, double alt, int sats, double hdop){

  // create JSON payload
  String json = "{";
  json += "\"device\":\""+String(DEVICE_ID)+"\",";
  json += "\"longitude\":" + String(lon,6) + ",";
  json += "\"latitude\":" + String(lat,6) + ",";
  json += "\"speed\":" + String(spd,2) + ",";
  json += "\"altitude\":" + String(alt,2) + ",";
  json += "\"accuracy\":" + String(hdop,2) + ",";
  json += "\"satellites\":" + String(sats);
  json += "}";

  Serial.println("Sending JSON:");
  Serial.println(json);

  sendAT("AT+HTTPTERM");
  sendAT("AT+HTTPINIT");
  sendAT("AT+HTTPPARA=\"CID\",1");
  sendAT("AT+HTTPPARA=\"URL\",\"" + server_url + "\"");
  sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"");

  sendAT("AT+HTTPDATA="+String(json.length())+",10000");
  delay(100);
  SIMSerial.print(json);
  delay(1000);   // short wait to ensure data sent

  // POST request
  sendAT("AT+HTTPACTION=1", 10000);
  String r = readResponse(5000);
  Serial.println("HTTPACTION:\n" + r);
  
  if(r.indexOf(",200,") != -1){
    Serial.println("HTTP OK!");

    sendAT("AT+HTTPREAD",5000);
    String sresp = readResponse(3000);
    Serial.println("Server reply:\n"+sresp);

    // Parse sleep_interval
    int idx = sresp.indexOf("\"sleep_interval\":");
    if(idx != -1){
      String remain = sresp.substring(idx+17); // after :
      remain.trim();
      int endIdx = remain.indexOf("}");
      String sval = remain;
      if(endIdx!=-1) sval = remain.substring(0,endIdx);
      sval.trim();
      int sval_int = sval.toInt();
      if(sval_int>0 && sval_int<=3600){
        sleep_seconds = sval_int;
        Serial.printf("Updated sleep to %u sec\n", sleep_seconds);
      }
    } else {
      Serial.println("No sleep_interval found, using default");
      sleep_seconds = default_sleep_seconds;
    }

    sendAT("AT+HTTPTERM");
    sendAT("AT+SAPBR=0,1");
    return true;
  } else {
    Serial.println("HTTP POST failed");
    sendAT("AT+HTTPTERM");
    sendAT("AT+SAPBR=0,1");
    sleep_seconds = default_sleep_seconds;
    return false;
  }
}


String readResponse(uint32_t timeout){
  String resp="";
  unsigned long t0 = millis();
  while(millis()-t0<timeout){
    while(SIMSerial.available()){
      resp += char(SIMSerial.read());
    }
    delay(10);
  }
  return resp;
}

// ---- Sleep ----
void deepSleepSeconds(uint32_t seconds){
  uint64_t us = (uint64_t)seconds * 1000000ULL;
  Serial.println("Entering deep sleep...");
  Serial.flush();
  delay(100);
  esp_sleep_enable_timer_wakeup(us);
  esp_deep_sleep_start();
}

// === Setup ===
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(GPS_POWER_PIN, OUTPUT);
  pinMode(SIM800_POWER_PIN, OUTPUT);
  pinMode(SIM800L_PWRKEY, OUTPUT);
  digitalWrite(GPS_POWER_PIN, LOW);
  digitalWrite(SIM800_POWER_PIN, LOW);
  digitalWrite(SIM800L_PWRKEY, LOW);

  Serial.println("\n=== GPS + GSM Tracker Start ===");

  double lat=0, lon=0, spd=0, alt=0, hdop=0;
  int sats=0;

  //------------------------------
  Serial.println("[1] GPS Acquire");
  powerOnGPS();
  bool gotFix = acquireGPS(lat, lon, spd, alt, sats, hdop);
  powerOffGPS();

  if(gotFix){
    Serial.printf("GPS Fix: %.6f, %.6f, Speed %.2f, Alt %.2f, sats %d, HDOP %.2f\n", lat, lon, spd, alt, sats, hdop);
  } else {
    Serial.println("NO GPS fix, reporting zeros.");
    lat=lon=spd=alt=hdop=0; sats=0;
  }

  //------------------------------
  Serial.println("[2] Connecting GPRS, sending data");
  powerOnSIM800();
  delay(5000);

  if(connectGPRS()){
    if(!postData(lat, lon, spd, alt, sats, hdop)){
      Serial.println("HTTP POST failed");
    }
  } else {
    Serial.println("GPRS connection failed");
  }

  powerOffSIM800();

  Serial.printf("Sleeping for %u seconds\n", sleep_seconds);
  delay(300);
  deepSleepSeconds(sleep_seconds);
}

void loop() {}



