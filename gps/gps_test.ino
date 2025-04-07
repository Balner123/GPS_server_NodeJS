#include <Arduino.h>
#include <TinyGPS++.h>

// --- CONFIGURATION ---

#define GPS_RX_PIN   27    // ESP32 RX connected to GPS TX
#define GPS_TX_PIN   26    // ESP32 TX connected to GPS RX (often unused for GPS-only)
#define GPS_POWER_PIN 25   // pin to power GPS module (high = on)
#define SAT_THRESHOLD 4    // number of satellites minimum for fix

#define SLEEP_HOURS    0
#define SLEEP_MINUTES  1
#define SLEEP_SECONDS  0

unsigned long convertToMicros(int h,int m,int s) {
  return ((uint64_t)h*3600 + (uint64_t)m*60 + (uint64_t)s)*1000000ULL;
}
uint64_t sleepTimeMicros = convertToMicros(SLEEP_HOURS, SLEEP_MINUTES, SLEEP_SECONDS);

// --- GLOBALS ---
HardwareSerial SerialGPS(2);
TinyGPSPlus gps;

// --- MAIN ---
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n--- GPS-Only Tracker ---");

  pinMode(GPS_POWER_PIN, OUTPUT);
  digitalWrite(GPS_POWER_PIN, HIGH);
  Serial.println("Powering GPS module ON...");
  delay(1000);
  
  SerialGPS.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  Serial.println("Waiting up to 5 minutes for GPS fix...");

  unsigned long tStart = millis();
  unsigned long lastPrint = 0;
  bool gotFix = false;

  while(millis() - tStart < 5UL * 60UL * 1000UL) {  // 5 min timeout
    while(SerialGPS.available()) gps.encode(SerialGPS.read());

    if (gps.location.isUpdated() && gps.location.isValid() && 
        gps.satellites.isValid() && (gps.satellites.value() >= SAT_THRESHOLD)) {

      double lat = gps.location.lat();
      double lon = gps.location.lng();
      int sats   = gps.satellites.value();
      double spd = gps.speed.kmph();
      double alt = gps.altitude.meters();
      double hdop= gps.hdop.isValid() ? gps.hdop.value()/100.0 : -1.0;
      
      Serial.println("\n*** GPS FIX OBTAINED ***");
      Serial.printf("Lat: %.6f  Lon: %.6f\n", lat, lon);
      Serial.printf("Speed: %.2f km/h  Altitude: %.2f m\n", spd, alt);
      Serial.printf("Satellites: %d  HDOP: %.2f\n", sats, hdop);

      gotFix = true;
      break;
    }

    if(millis()-lastPrint >= 5000) {   // status every 5s
      lastPrint = millis();
      Serial.print("Waiting... Sat: ");
      Serial.print(gps.satellites.isValid()? gps.satellites.value():0);
      Serial.print(", Valid Pos: "); Serial.print(gps.location.isValid());
      Serial.print(", Updated: ");  Serial.println(gps.location.isUpdated());
    }
    
    delay(10); // pace loop
  }

  SerialGPS.end();                                               
  digitalWrite(GPS_POWER_PIN, LOW);   // power off GPS module
  Serial.println(gotFix ? "GPS done, powering down GPS" : "Timeout, no GPS fix, powering down GPS");

  Serial.println("Entering deep sleep now...");
  Serial.flush();
  esp_sleep_enable_timer_wakeup(sleepTimeMicros);
  esp_deep_sleep_start();
}

void loop() {}
