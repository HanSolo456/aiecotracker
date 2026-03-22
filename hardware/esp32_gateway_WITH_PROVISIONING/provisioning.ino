// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack — ESP-32 Provisioning State Machine (Phase 4)
// 
// This module handles zero-reflash device onboarding:
// 1. Check if WiFi credentials exist in NVS
// 2. If not, enter provisioning mode:
//    a. Log provisioning status over serial
//    b. Device ID is burned-in factory (from firmware or hardcoded)
//    c. Wait for org admin to initiate claim (POST /api/org/devices/claim)
//    d. Call claim-verify endpoint to prove possession
//    e. Poll until claim state transitions to claim_confirmed
//    f. Fetch WiFi credentials via POST /api/devices/provision-wifi
//    g. Store encrypted WiFi in NVS
//    h. Reboot onto org WiFi network
// 3. Normal operation mode: connect to stored WiFi + post sensor data
//
// Integration with esp32_gateway.ino:
//   - Call provisioningSetup() in main setup()
//   - Call provisioningLoop() at start of main loop()
//   - Define DEVICE_ID_FACTORY (burned-in from factory firmware)
//   - Define DEVICE_TOKEN (provisioning bootstrap token, or empty for NVS fetch)
// ─────────────────────────────────────────────────────────────────────────────

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>

// ── Provisioning State Machine
enum ProvisioningState {
    PROV_INIT,                    // Check NVS for WiFi credentials
    PROV_WAITING_CLAIM_INITIATION, // Waiting for admin to run POST /api/org/devices/claim
    PROV_NONCE_RECEIVED,          // Received nonce from claim initiation API
    PROV_VERIFY_CLAIM,            // Device proves possession via claim-verify
    PROV_AWAITING_CONFIRMATION,   // Waiting for admin to confirm claim
    PROV_FETCH_WIFI,              // Retrieve WiFi credentials from server
    PROV_STORE_WIFI,              // Save WiFi to NVS
    PROV_COMPLETE,                // All set; reboot to join org network
    NORMAL_OPERATION,             // Standard mode: connected and posting sensor data
};

ProvisioningState g_prov_state = PROV_INIT;
unsigned long g_prov_timeout = 0;
unsigned long g_prov_last_verify = 0;
String g_claim_nonce = "";
String g_device_token = "";
String g_bootstrap_token = "";
unsigned long g_prov_last_poll = 0;

Preferences g_nvsStorage;

String endpointFromServer(const char *server_url, const char *path) {
    String out = String(server_url);
    out.replace("/api/sensor-data", path);
    return out;
}

void provisioningSetBootstrapToken(const char *bootstrap_token) {
    g_bootstrap_token = String(bootstrap_token ? bootstrap_token : "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Provisioning Setup — Call once in main setup()
// ─────────────────────────────────────────────────────────────────────────────
void provisioningSetup() {
    g_nvsStorage.begin("aieco_prov", false);
    g_device_token = g_nvsStorage.getString("device_token", "");
    
    // Check if WiFi is already provisioned
    String stored_ssid = g_nvsStorage.getString("wifi_ssid", "");
    if (stored_ssid.length() > 0) {
        Serial.println("[PROV] WiFi already provisioned. Entering NORMAL_OPERATION.");
        g_prov_state = NORMAL_OPERATION;
        return;
    }
    
    Serial.println("[PROV] No WiFi provisioned. Entering PROV_INIT.");
    g_prov_state = PROV_INIT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provisioning Loop — Call every iteration in main loop()
// Returns: true if provisioning is complete (device can proceed to normal ops)
// ─────────────────────────────────────────────────────────────────────────────
bool provisioningLoop(const char *device_id_factory, const char *server_url) {
    unsigned long now = millis();
    
    switch (g_prov_state) {
        // ──── INIT: Check NVS ────
        case PROV_INIT: {
            String stored_ssid = g_nvsStorage.getString("wifi_ssid", "");
            if (stored_ssid.length() > 0) {
                // WiFi already stored; use it
                g_prov_state = NORMAL_OPERATION;
                Serial.println("[PROV INIT] WiFi found in NVS. Transitioning to NORMAL_OPERATION.");
            } else {
                // No WiFi stored; ask admin to initiate claim
                g_prov_state = PROV_WAITING_CLAIM_INITIATION;
                g_prov_timeout = now + (15 * 60 * 1000); // 15 min timeout
                displayProvisioningUI("Awaiting Claim", "Device ID:", device_id_factory, "Check admin panel");
                Serial.println("[PROV INIT] Transitioning to PROV_WAITING_CLAIM_INITIATION.");
            }
            break;
        }
        
        // ──── WAITING: User initiates claim via admin panel ────
        case PROV_WAITING_CLAIM_INITIATION: {
            if (now > g_prov_timeout) {
                Serial.println("[PROV] Timeout waiting for claim initiation. Restarting.");
                g_prov_state = PROV_INIT;
                break;
            }
            
            if (g_bootstrap_token.length() == 0) {
                displayProvisioningUI("Awaiting Claim", "Missing bootstrap token", "Set DEVICE_TOKEN_BOOTSTRAP", "in firmware");
                break;
            }

            if (now - g_prov_last_poll < 3000) break;
            g_prov_last_poll = now;

            String status_url = endpointFromServer(server_url, "/api/devices/bootstrap-status");
            HTTPClient http;
            http.begin(status_url);
            http.addHeader("x-device-id", device_id_factory);
            http.addHeader("x-device-bootstrap-token", g_bootstrap_token.c_str());
            int httpCode = http.GET();
            String response = http.getString();
            http.end();

            Serial.println("[PROV STATUS] HTTP " + String(httpCode) + ": " + response);

            if (httpCode == 200) {
                StaticJsonDocument<512> doc;
                if (deserializeJson(doc, response) == DeserializationError::Ok) {
                    String status = String((const char *)doc["status"]);
                    if (status == "claim_pending") {
                        g_claim_nonce = String((const char *)doc["claimNonce"]);
                        if (g_claim_nonce.length() > 0) {
                            g_prov_state = PROV_VERIFY_CLAIM;
                            g_prov_last_verify = 0;
                            displayProvisioningUI("Claim Found", "Nonce received", "Verifying now", "");
                            break;
                        }
                    }
                    if (status == "claim_verified") {
                        g_prov_state = PROV_AWAITING_CONFIRMATION;
                        g_prov_timeout = now + (10 * 60 * 1000);
                        break;
                    }
                    if (status == "claim_confirmed") {
                        g_prov_state = PROV_FETCH_WIFI;
                        break;
                    }
                }
            }

            displayProvisioningUI("Awaiting Claim", "Device Ready", device_id_factory, "Waiting...");
            break;
        }
        
        // ──── NONCE: We have the nonce; proceed to verify possession ────
        case PROV_NONCE_RECEIVED: {
            displayProvisioningUI("Verifying", "Nonce Received", "Proving possession...", "");
            g_prov_state = PROV_VERIFY_CLAIM;
            g_prov_last_verify = 0; // Force immediate verify
            Serial.println("[PROV] Nonce received. Transitioning to PROV_VERIFY_CLAIM.");
            break;
        }
        
        // ──── VERIFY: Send claim-verify to server ────
        case PROV_VERIFY_CLAIM: {
            // Verify every 5 seconds (don't hammer the server)
            if (now - g_prov_last_verify < 5000) break;
            g_prov_last_verify = now;
            
            displayProvisioningUI("Verifying", "Contacting Server", "Nonce: " + g_claim_nonce.substring(0, 8), "...");
            
            // Construct URL and payload
            String verify_url = String(server_url);
            verify_url.replace("/api/sensor-data", "/api/devices/claim-verify");
            
            StaticJsonDocument<128> payload;
            payload["deviceId"] = device_id_factory;
            payload["nonce"] = g_claim_nonce;
            
            String body;
            serializeJson(payload, body);
            
            HTTPClient http;
            http.begin(verify_url);
            http.addHeader("Content-Type", "application/json");
            
            int httpCode = http.POST(body);
            String response = http.getString();
            http.end();
            
            Serial.println("[PROV VERIFY] HTTP " + String(httpCode) + ": " + response);
            
            if (httpCode == 200) {
                // Parse response
                StaticJsonDocument<256> doc;
                if (deserializeJson(doc, response) == DeserializationError::Ok) {
                    if (doc["verified"] == true) {
                        // Device verified; wait for admin confirmation
                        g_prov_state = PROV_AWAITING_CONFIRMATION;
                        g_prov_timeout = now + (10 * 60 * 1000); // 10 min timeout for admin confirm
                        Serial.println("[PROV VERIFY] Verified! Transitioning to PROV_AWAITING_CONFIRMATION.");
                    }
                }
            }
            
            displayProvisioningUI("Verifying", "Awaiting Admin", "Confirm claim...", "");
            break;
        }
        
        // ──── AWAITING: Wait for admin confirmation ────
        case PROV_AWAITING_CONFIRMATION: {
            if (now > g_prov_timeout) {
                Serial.println("[PROV] Timeout waiting for admin confirmation. Restarting.");
                g_prov_state = PROV_INIT;
                break;
            }
            
            if (now - g_prov_last_poll < 3000) break;
            g_prov_last_poll = now;

            String status_url = endpointFromServer(server_url, "/api/devices/bootstrap-status");
            HTTPClient http;
            http.begin(status_url);
            http.addHeader("x-device-id", device_id_factory);
            http.addHeader("x-device-bootstrap-token", g_bootstrap_token.c_str());
            int httpCode = http.GET();
            String response = http.getString();
            http.end();

            Serial.println("[PROV STATUS] HTTP " + String(httpCode) + ": " + response);

            if (httpCode == 200) {
                StaticJsonDocument<512> doc;
                if (deserializeJson(doc, response) == DeserializationError::Ok) {
                    String status = String((const char *)doc["status"]);
                    if (status == "claim_confirmed" || status == "active") {
                        g_prov_state = PROV_FETCH_WIFI;
                        break;
                    }
                }
            }

            displayProvisioningUI("Awaiting Admin", "Confirm Claim", "Waiting for", "approval...");
            break;
        }
        
        // ──── FETCH: Retrieve WiFi credentials ────
        case PROV_FETCH_WIFI: {
            displayProvisioningUI("Fetching WiFi", "Contacting Server", "Getting credentials", "...");
            
            String fetch_url = endpointFromServer(server_url, "/api/devices/provision-wifi");
            
            HTTPClient http;
            http.begin(fetch_url);
            http.addHeader("x-device-id", device_id_factory);
            if (g_device_token.length() > 0) {
                http.addHeader("x-device-token", g_device_token.c_str());
            } else {
                http.addHeader("x-device-bootstrap-token", g_bootstrap_token.c_str());
            }
            
            int httpCode = http.POST("");
            String response = http.getString();
            http.end();
            
            Serial.println("[PROV FETCH] HTTP " + String(httpCode) + ": " + response);
            
            if (httpCode == 200) {
                // Parse WiFi credentials
                StaticJsonDocument<256> doc;
                if (deserializeJson(doc, response) == DeserializationError::Ok) {
                    String ssid = doc["ssid"];
                    String password = doc["password"];
                    String runtimeToken = String((const char *)doc["deviceToken"]);
                    
                    if (ssid.length() > 0 && password.length() > 0) {
                        // Store in NVS
                        g_nvsStorage.putString("wifi_ssid", ssid);
                        g_nvsStorage.putString("wifi_password", password);
                        if (runtimeToken.length() > 0) {
                            g_nvsStorage.putString("device_token", runtimeToken);
                            g_device_token = runtimeToken;
                        }
                        
                        Serial.println("[PROV FETCH] Stored WiFi: " + ssid);
                        displayProvisioningUI("WiFi Provisioned", "SSID: " + ssid, "Rebooting...", "");
                        
                        g_prov_state = PROV_STORE_WIFI;
                        g_prov_timeout = now + 3000; // Wait 3 sec before reboot
                    }
                }
            } else {
                displayProvisioningUI("Error Fetching WiFi", "HTTP " + String(httpCode), "Retrying...", "");
                g_prov_timeout = now + 10000; // Retry in 10 sec
            }
            break;
        }
        
        // ──── STORE: Save and prepare for reboot ────
        case PROV_STORE_WIFI: {
            if (now > g_prov_timeout) {
                displayProvisioningUI("Rebooting", "Device will rejoin", "org network", "");
                delay(1000);
                ESP.restart();
            }
            break;
        }
        
        // ──── COMPLETE / NORMAL: Ready to use ────
        case PROV_COMPLETE:
        case NORMAL_OPERATION: {
            // Load WiFi from NVS and connect
            String ssid = g_nvsStorage.getString("wifi_ssid", "");
            String password = g_nvsStorage.getString("wifi_password", "");
            
            if (ssid.length() > 0) {
                // Normal operation: connect to WiFi and post sensor data
                return true; // Provisioning complete
            }
            break;
        }
    }
    
    return false; // Provisioning not yet complete
}

// ─────────────────────────────────────────────────────────────────────────────
// Log provisioning status
// ─────────────────────────────────────────────────────────────────────────────
void displayProvisioningUI(String title, String line1, String line2, String line3) {
    Serial.print("[PROV UI] ");
    Serial.print(title);
    Serial.print(" | ");
    Serial.print(line1);
    Serial.print(" | ");
    Serial.print(line2);
    Serial.print(" | ");
    Serial.println(line3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Retrieve WiFi from NVS
// ─────────────────────────────────────────────────────────────────────────────
void getProvisionedWiFi(String &out_ssid, String &out_password) {
    out_ssid = g_nvsStorage.getString("wifi_ssid", "");
    out_password = g_nvsStorage.getString("wifi_password", "");
}

void getProvisionedDeviceToken(String &out_token) {
    out_token = g_nvsStorage.getString("device_token", "");
}
