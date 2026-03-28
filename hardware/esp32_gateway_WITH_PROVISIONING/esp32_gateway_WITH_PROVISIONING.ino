// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack — ESP-32 WiFi Gateway (WITH PROVISIONING + SOFTAP SETUP)
//
// First-boot flow:
//   1. No WiFi in NVS → ESP32 creates hotspot "EcoTrack-Setup"
//   2. Connect your phone/laptop to "EcoTrack-Setup" (no password)
//   3. Open browser → 192.168.4.1 → fill in your WiFi SSID + password
//   4. ESP32 saves to NVS, reboots, connects to your WiFi
//   5. Provisioning state machine runs (polls server, etc.)
//   6. Org admin claims device in admin panel
//   7. After confirm → ESP32 downloads org WiFi, switches permanently
//
// Pins:
//   GPIO16 = Serial2 RX (← Arduino D11)
//   GPIO17 = Serial2 TX (→ Arduino D12)
// ─────────────────────────────────────────────────────────────────────────────

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

// ── Extern: g_device_token is defined in provisioning.ino ──
extern String g_device_token;

// ── Factory-Burned Settings ────────────────────────────────────────────────
const char *DEVICE_ID_FACTORY      = "bin_green_1";
const char *DEVICE_TOKEN_BOOTSTRAP = "e175967cde6d0ba66ddc3df46bcc501582b6c1b3928e9eb88280837860224341";
const char *SERVER_URL             = "https://aiecotracker.vercel.app/api/sensor-data";

// ── SoftAP config ────────────────────────────────────────────────────────────
const char *AP_SSID = "EcoTrack-Setup";  // hotspot name (no password)

// ── NVS keys for setup WiFi (separate from org-provisioned WiFi) ─────────────
const char *NVS_NS          = "ecotrack";
const char *NVS_SETUP_SSID  = "setup_ssid";
const char *NVS_SETUP_PASS  = "setup_pass";

// ── Globals ──────────────────────────────────────────────────────────────────
WebServer    apServer(80);
Preferences  prefs;
String       serialBuffer = "";

// ─────────────────────────────────────────────────────────────────────────────
// SoftAP config page HTML
// ─────────────────────────────────────────────────────────────────────────────
const char *CONFIG_HTML = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EcoTrack WiFi Setup</title>
<style>
  body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
        padding:32px;max-width:380px;width:90%;box-shadow:0 4px 32px rgba(0,0,0,0.5)}
  h1{margin:0 0 6px;font-size:22px;color:#a3e635}
  p{margin:0 0 24px;font-size:13px;color:#94a3b8}
  label{display:block;font-size:13px;color:#94a3b8;margin-bottom:6px}
  input{width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #475569;
        color:#e2e8f0;border-radius:10px;padding:10px 14px;font-size:14px;margin-bottom:16px}
  button{width:100%;background:#a3e635;color:#0f172a;border:none;border-radius:10px;
         padding:12px;font-size:15px;font-weight:700;cursor:pointer}
  button:hover{background:#84cc16}
  .ok{color:#a3e635;text-align:center;margin-top:16px;font-size:14px}
</style></head><body>
<div class="card">
  <h1>EcoTrack Setup</h1>
  <p>Enter your WiFi credentials so the device can connect to the internet.</p>
  <form method="POST" action="/save">
    <label>WiFi SSID</label>
    <input name="ssid" placeholder="Your WiFi name" required>
    <label>WiFi Password</label>
    <input name="pass" type="password" placeholder="Your WiFi password">
    <button type="submit">Save &amp; Connect</button>
  </form>
</div></body></html>
)rawliteral";

const char *SAVED_HTML = R"rawliteral(
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Saved!</title>
<style>
  body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
        padding:32px;max-width:380px;width:90%;text-align:center}
  h1{color:#a3e635;margin:0 0 8px}
  p{color:#94a3b8;font-size:14px}
</style></head><body>
<div class="card">
  <h1>✓ Saved!</h1>
  <p>WiFi credentials saved. The device will now reboot and connect to your network.</p>
  <p>You can close this page.</p>
</div></body></html>
)rawliteral";

// ─────────────────────────────────────────────────────────────────────────────
// Connect to a WiFi network (station mode)
// ─────────────────────────────────────────────────────────────────────────────
bool connectWiFi(const char *ssid, const char *password) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Connecting to ");
  Serial.print(ssid);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected: " + WiFi.localIP().toString());
    return true;
  }
  Serial.println("\n[WiFi] FAILED to connect.");
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SoftAP: start the config hotspot and web server
// ─────────────────────────────────────────────────────────────────────────────
void startConfigAP() {
  Serial.println("[AP] Starting config hotspot: " + String(AP_SSID));
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID);
  Serial.println("[AP] IP: " + WiFi.softAPIP().toString());

  apServer.on("/", HTTP_GET, []() {
    apServer.send(200, "text/html", CONFIG_HTML);
  });

  // /configure?ssid=MyWiFi&pass=password
  // Called from the admin-panel-generated URL — auto-saves without user typing
  apServer.on("/configure", HTTP_GET, []() {
    String ssid = apServer.arg("ssid");
    String pass = apServer.arg("pass");

    if (ssid.length() == 0) {
      apServer.send(400, "text/plain", "Missing ssid param");
      return;
    }

    prefs.begin(NVS_NS, false);
    prefs.putString(NVS_SETUP_SSID, ssid);
    prefs.putString(NVS_SETUP_PASS, pass);
    prefs.end();

    apServer.send(200, "text/html", SAVED_HTML);
    Serial.println("[AP] Auto-configured via URL. SSID: " + ssid + ". Rebooting...");
    delay(2000);
    ESP.restart();
  });

  apServer.on("/save", HTTP_POST, []() {
    String ssid = apServer.arg("ssid");
    String pass = apServer.arg("pass");

    if (ssid.length() == 0) {
      apServer.send(400, "text/plain", "SSID required");
      return;
    }

    // Save to NVS
    prefs.begin(NVS_NS, false);
    prefs.putString(NVS_SETUP_SSID, ssid);
    prefs.putString(NVS_SETUP_PASS, pass);
    prefs.end();

    apServer.send(200, "text/html", SAVED_HTML);
    Serial.println("[AP] Credentials saved for: " + ssid + ". Rebooting...");
    delay(2000);
    ESP.restart();
  });

  // Captive portal redirect for any unknown URL
  apServer.onNotFound([]() {
    apServer.sendHeader("Location", "http://192.168.4.1/", true);
    apServer.send(302, "text/plain", "");
  });

  apServer.begin();
  Serial.println("[AP] Web server started. Connect to '" + String(AP_SSID) + "' and open 192.168.4.1");
}

// ─────────────────────────────────────────────────────────────────────────────
// setup()
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);

  // Read setup WiFi from NVS
  prefs.begin(NVS_NS, true);
  String setupSsid = prefs.getString(NVS_SETUP_SSID, "");
  String setupPass = prefs.getString(NVS_SETUP_PASS, "");
  prefs.end();

  if (setupSsid.length() == 0) {
    // No WiFi stored → boot into AP config mode
    // Loop here until user provides credentials (reboot exits loop)
    startConfigAP();
    while (true) {
      apServer.handleClient();
      delay(10);
    }
    // Never reaches here; ESP.restart() in /save handler
  }

  // WiFi credentials available → connect
  bool connected = connectWiFi(setupSsid.c_str(), setupPass.c_str());
  if (!connected) {
    Serial.println("[SETUP] WiFi connection failed. Rebooting into setup mode...");
    // Clear stored credentials so next boot goes to AP mode again
    prefs.begin(NVS_NS, false);
    prefs.remove(NVS_SETUP_SSID);
    prefs.remove(NVS_SETUP_PASS);
    prefs.end();
    delay(2000);
    ESP.restart();
  }

  // Initialize provisioning state machine
  provisioningSetBootstrapToken(DEVICE_TOKEN_BOOTSTRAP);
  provisioningSetup();
  Serial.println("[SETUP] Provisioning system ready.");
}

// ─────────────────────────────────────────────────────────────────────────────
// loop()
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // Run provisioning state machine
  bool provisioning_complete = provisioningLoop(DEVICE_ID_FACTORY, SERVER_URL);

  if (!provisioning_complete) {
    delay(100);
    return;
  }

  // Provisioning done — switch to org WiFi if not already on it
  static bool orgWifiLoaded = false;
  if (!orgWifiLoaded) {
    String orgSsid = "", orgPass = "";
    getProvisionedWiFi(orgSsid, orgPass);

    if (orgSsid.length() > 0) {
      Serial.println("[LOOP] Switching to org WiFi: " + orgSsid);
      connectWiFi(orgSsid.c_str(), orgPass.c_str());
    }

    String provisionedToken = "";
    getProvisionedDeviceToken(provisionedToken);
    if (provisionedToken.length() > 0) {
      g_device_token = provisionedToken;
    }

    orgWifiLoaded = true;
  }

  // Normal sensor data processing
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
// Process Arduino sensor data and post to server
// ─────────────────────────────────────────────────────────────────────────────
void processArduinoData(String jsonStr) {
  Serial.println("[ESP32] Received: " + jsonStr);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, jsonStr);
  if (err) {
    Serial.println("[ESP32] JSON parse error: " + String(err.c_str()));
    return;
  }

  float temp     = doc["temperature"];
  float humidity = doc["humidity"];
  float ec       = doc["ec"];
  float ph       = doc["ph"];

  if (WiFi.isConnected()) {
    postSensorData(temp, humidity, ec, ph);
  } else {
    Serial.println("[ESP32] WiFi not connected; skipping POST");
  }
}

void postSensorData(float temp, float humidity, float ec, float ph) {
  if (g_device_token.length() == 0) {
    String tok = "";
    getProvisionedDeviceToken(tok);
    g_device_token = tok;
  }

  if (g_device_token.length() == 0) {
    Serial.println("[ESP32] No device token; skipping POST");
    return;
  }

  StaticJsonDocument<256> payload;
  payload["device_id"]             = DEVICE_ID_FACTORY;
  payload["timestamp"]             = millis();
  payload["temperature"]           = temp;
  payload["humidity"]              = humidity;
  payload["electricalConductivity"] = ec;
  payload["pH"]                    = ph;

  String body;
  serializeJson(payload, body);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", g_device_token);

  int httpCode = http.POST(body);
  String response = http.getString();
  http.end();

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("[ESP32] Data posted (HTTP " + String(httpCode) + ")");
  } else {
    Serial.println("[ESP32] POST failed (HTTP " + String(httpCode) + "): " + response);
  }
}
