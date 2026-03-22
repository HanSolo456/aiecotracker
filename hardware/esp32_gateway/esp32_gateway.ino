// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack — ESP-32 WiFi Gateway
// Receives sensor JSON from Arduino via Serial2 and posts to /api/sensor-data.
//
// Pins:
//   GPIO16 = Serial2 RX (← Arduino D11)
//   GPIO17 = Serial2 TX (→ Arduino D12)
// ─────────────────────────────────────────────────────────────────────────────

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

// ── WiFi Credentials — CHANGE THESE ──────────────────────────────────────────
const char *WIFI_SSID = "Aqua_4th Floor";
const char *WIFI_PASSWORD = "Orange@2025";

// ── Server Config — CHANGE THESE ─────────────────────────────────────────────
const char *SERVER_URL = "https://aiecotracker.vercel.app/api/sensor-data";
// Use token and device ID issued from My Org -> Settings -> Device Management.
const char *DEVICE_TOKEN = "replace-with-device-token";
const char *DEVICE_ID = "esp-gateway-001";

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[ESP32] Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[ESP32] WiFi connected: " + WiFi.localIP().toString());
    delay(1500);
  } else {
    Serial.println("\n[ESP32] WiFi FAILED — running offline");
    delay(1500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
String serialBuffer = "";

void loop() {
  while (Serial2.available()) {
    char c = Serial2.read();
    if (c == '\n') {
      if (serialBuffer.length() > 2) {
        processArduinoData(serialBuffer);
      }
      serialBuffer = "";
    } else {
      serialBuffer += c;
    }
  }
  delay(10);
}

// ─────────────────────────────────────────────────────────────────────────────
void processArduinoData(String jsonStr) {
  Serial.println("[ESP32] Received: " + jsonStr);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err) {
    Serial.println("[ESP32] JSON parse error: " + String(err.c_str()));
    return;
  }

  int fillPct = doc["fill_pct"] | 0;
  int gasPpm = doc["gas_ppm"] | 0;
  int coPpm = doc["co_ppm"] | 0;
  float temperature = doc["temperature"] | 0.0;
  float humidity = doc["humidity"] | 0.0;
  bool itemDropped = doc["item_dropped"] | false;
  bool gasAlert = doc["gas_alert"] | false;

  postSensorData(fillPct, gasPpm, coPpm, temperature, humidity, itemDropped,
                 gasAlert);
}

// ─────────────────────────────────────────────────────────────────────────────
void postSensorData(int fill, int gas, int co, float temp, float hum, bool drop,
                    bool alert) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ESP32] Not connected — skipping POST");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String body = "{";
  body += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  body += "\"fill_level\":" + String(fill) + ",";
  body += "\"gas_ppm\":" + String(gas) + ",";
  body += "\"co_ppm\":" + String(co) + ",";
  body += "\"temperature\":" + String(temp, 1) + ",";
  body += "\"humidity\":" + String(hum, 1) + ",";
  body += "\"item_dropped\":" + String(drop ? "true" : "false") + ",";
  body += "\"gas_alert\":" + String(alert ? "true" : "false");
  body += "}";

  int httpCode = http.POST(body);
  Serial.println("[ESP32] POST → HTTP " + String(httpCode));
  http.end();
}

