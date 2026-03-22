# AI-EcoTrack Hardware — Quick Start Guide

## 📁 Folder Structure

```
hardware/
├── arduino_main/
│   └── arduino_main.ino   ← Flash to Arduino UNO
├── esp32_gateway/
│   └── esp32_gateway.ino  ← Flash to ESP-32 30-pin
└── (optional) Raspberry Pi camera trigger via ../pi/scan_trigger.py
```

---

## ⚡ Step 1 — Before Flashing

Change these values in `esp32_gateway.ino`:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "https://your-app.vercel.app/...";
const char* DEVICE_ID     = "your-unique-device-id";
const char* DEVICE_TOKEN  = "token-shown-once-in-settings";
```

Get `DEVICE_ID` + `DEVICE_TOKEN` from:
`My Org -> Settings -> Device Management -> Register Device`

Each sold machine must use its own unique `DEVICE_ID` and token.

---

## 🔧 Step 2 — Arduino IDE Setup

### Install Board Packages
1. File → Preferences → Additional Board URLs:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. Tools → Board Manager → Search `esp32` → Install **esp32 by Espressif Systems**

### Install Libraries (Tools → Manage Libraries)
| Library | Used By |
|---|---|
| `DHT sensor library` by Adafruit | Arduino |
| `Adafruit SSD1306` | ESP-32 Gateway |
| `Adafruit GFX Library` | ESP-32 Gateway |
| `LiquidCrystal I2C` by Frank de Brabander | ESP-32 Gateway |
| `ArduinoJson` by Benoit Blanchon | ESP-32 Gateway |

---

## 🚀 Step 3 — Flash Order

### 1. Flash Arduino UNO
- Board: `Arduino UNO`
- Port: `/dev/cu.usbmodem*` or `COM*`
- Upload `arduino_main.ino`
- Open Serial Monitor (9600 baud) — should show sensor readings

### 2. Flash ESP-32 Gateway
- Board: `ESP32 Dev Module`
- Port: select the ESP-32's COM port
- Upload `esp32_gateway.ino`
- Serial Monitor (115200 baud) — should show WiFi connected + sensor data from Arduino

### 3. Configure Raspberry Pi Trigger (optional)
- Use `pi/scan_trigger.py` for camera-triggered scans.
- Set `ECOTRACK_URL`, `DEVICE_ID`, and `DEVICE_TOKEN` as described in `pi/README.md`.
- Run on boot via systemd if needed.

---

## 🎮 Step 4 — Test

| Test | Expected Result |
|---|---|
| Place hand near IR sensor | Relay clicks, servo moves, buzzer beeps |
| Trigger Pi scan | HTTP POST sent, scan appears in dashboard |
| Blow near MQ-135 | Gas PPM rises on OLED, buzzer alerts if > 400 |
| Fill bin > 80% (block HC-SR04 at <5cm) | Fill bar on OLED shows 100% |

---

## 🔑 Provisioning Rule

Do not use one shared token for all devices.
Register every hardware unit in the app and flash that unit with its own token.
