# Raspberry Pi Station Final Plan

## Summary
Build the Raspberry Pi scanner as a **headless station** with:
- external camera
- pressure sensor
- Pi-hosted local console for live preview and capture
- AI-EcoTrack website launcher page for pairing, status, and operator entry

Final design choices:
- Pairing uses the **same ownership lifecycle as ESP32**: factory bootstrap -> org claim -> claim verify -> admin confirm -> org Wi-Fi + runtime token.
- The station is **manual-arm only**. Pressure detection does nothing until the operator enables the station.
- The operator uses a **phone or desktop**.
- Because the website is HTTPS and the Pi local server is LAN HTTP, the **actual live preview/capture UI is hosted on the Pi**, and the AI-EcoTrack website provides a dedicated launcher/status page that opens the Pi console.
- Pi local address is **mDNS-based**: `http://<deviceId>.local:8080`.

## Implementation Changes

### 1. Raspberry Pi software to upload
Use the `pi/` folder as the deployment package and replace the current single-script prototype with these modules:

- `pi/app.py`
  Pi local web server on port `8080`; serves the operator console.
- `pi/bootstrap.py`
  Handles first-boot bootstrap flow with cloud APIs.
- `pi/camera.py`
  External camera preview + high-resolution still capture.
- `pi/pressure.py`
  Pressure sensor read, debounce, stability threshold.
- `pi/wifi.py`
  Applies org Wi-Fi credentials returned from the cloud and triggers reconnect/reboot.
- `pi/station.py`
  Station state machine: off, armed, waiting, capturing, analysing, complete, error.
- `pi/scan_client.py`
  Calls `/api/pi-scan`.
- `pi/config.py`
  Reads env/config values.
- `pi/requirements.txt`
  Python dependencies.
- `pi/.env`
  Device-specific configuration.

Recommended config keys:
- `APP_BASE_URL`
- `DEVICE_ID`
- `DEVICE_BOOTSTRAP_TOKEN`
- `PRESSURE_THRESHOLD_GRAMS`
- `PRESSURE_STABLE_MS`
- `ARM_TIMEOUT_SECONDS=600`
- `CAMERA_PREVIEW_WIDTH`
- `CAMERA_PREVIEW_HEIGHT`
- `CAMERA_CAPTURE_WIDTH`
- `CAMERA_CAPTURE_HEIGHT`
- `STATION_PORT=8080`

Recommended runtime:
- Python virtualenv
- `systemd` service: `ecotrack-pi-station.service`
- auto-start on boot
- Pi hostname set to `DEVICE_ID` so the station console becomes `http://<deviceId>.local:8080`

### 2. “Connect to Raspberry Pi just like ESP32” flow
Use the exact same claim model already used for hardware devices.

Factory/setup steps:
1. Superadmin creates a factory device with `deviceType = raspberry_pi` in the existing factory console.
2. The returned `bootstrapToken` is written into the Pi config as `DEVICE_BOOTSTRAP_TOKEN`.
3. Pi is booted on a temporary commissioning network.
   Default: installer Wi-Fi or Ethernet.
4. Pi starts polling:
   - `GET /api/devices/bootstrap-status`
   using:
   - `x-device-id`
   - `x-device-bootstrap-token`

Org claim steps:
1. Org admin opens existing `/org/devices`.
2. Admin claims the Pi by `deviceId`, same as ESP32.
3. Pi sees `claim_pending` and receives `claimNonce` from bootstrap-status.
4. Pi calls:
   - `POST /api/devices/claim-verify`
5. Admin presses confirm claim in `/org/devices`.
6. Pi calls:
   - `POST /api/devices/provision-wifi`
   with bootstrap token
7. Cloud returns:
   - org Wi-Fi SSID/password
   - runtime `deviceToken`
8. Pi writes org Wi-Fi into Raspberry Pi OS networking, stores runtime token locally, reboots, reconnects on org Wi-Fi.
9. After reconnect, Pi uses the runtime token for all normal operation.

This keeps the Pi onboarding aligned with the ESP32 lifecycle and reuses the current device backend.

### 3. Operator UX
Add a dedicated website launcher page:
- `/org/stations/[deviceId]`

This page is **not** the live camera page. It does:
- show device claim/active status
- show whether the station is reachable
- show station mode: off / armed / busy / analysing / error
- show button:
  `Open Station Console`
- link target:
  `http://<deviceId>.local:8080`

The live preview and capture UI is served by the Pi itself:
- `http://<deviceId>.local:8080`

Pi console UI behavior:
- default state: `Station Off`
- big button: `Enable Station`
- once enabled:
  - station enters `armed`
  - pressure detection becomes active
- when pressure is detected:
  - show live preview
  - show `Capture Angle 1`
- after capture 1:
  - prompt rotate object
  - show `Capture Angle 2`
- after capture 2:
  - prompt rotate again
  - show `Capture Angle 3`
- after capture 3:
  - show `Analysing`
  - Pi sends images to `/api/pi-scan`
- on success:
  - show summary
  - show `Open Result`
  - deep link to `${APP_BASE_URL}/scan/result?scan=<scan_id>`
- on timeout or completion:
  - station auto-disarms

Important UX rule:
- No auto-open from leaderboard, history, settings, or dashboard.
- No background pressure-trigger prompts in v1.
- The operator must intentionally open the station console and enable it.

### 4. Station behavior
Use this state machine on the Pi:

- `OFF`
  Pressure ignored.
- `ARMED_WAITING_FOR_ITEM`
  Pressure monitored.
- `ITEM_DETECTED`
  Pressure crossed threshold and stabilized.
- `CAPTURING_ANGLE_1`
- `CAPTURING_ANGLE_2`
- `CAPTURING_ANGLE_3`
- `ANALYSING`
- `COMPLETE`
- `ERROR`

Rules:
- Pressure is valid only when above threshold for the debounce/stability window.
- One active session per Pi at a time.
- If the item is removed before all 3 captures, session resets to `ARMED_WAITING_FOR_ITEM`.
- Auto-disarm after 10 minutes of inactivity.
- Auto-disarm after successful completion.
- `Disable Station` immediately returns to `OFF`.

### 5. Pi local HTTP interface
Implement these Pi-hosted endpoints:

- `GET /`
  Station console UI.
- `GET /stream.mjpg`
  Live external camera preview.
- `GET /api/state`
  Returns current station state, current angle, last error, recent thumbnails.
- `POST /api/arm`
  Enables pressure-triggered scanning.
- `POST /api/disarm`
  Disables the station.
- `POST /api/capture`
  Captures the current angle.
- `POST /api/reset`
  Resets the current session and returns to armed/off as applicable.

No cloud relay for preview/capture in v1.

### 6. Cloud/backend changes
Reuse existing endpoints:
- `GET /api/devices/bootstrap-status`
- `POST /api/devices/claim-verify`
- `POST /api/devices/provision-wifi`
- `POST /api/pi-scan`

No new scan schema is required.
Pi scans continue using the current `scans` write path with:
- `source: 'raspberry_pi'`
- `deviceId`
- `orgId`

Website addition:
- new launcher/status page for Pi stations
- optional reachability check logic for `http://<deviceId>.local:8080`

No global background notification system is required for v1.

### 7. Hardware defaults
Use these hardware defaults for the v1 build:
- Raspberry Pi 4B 1GB
- external USB camera
- pressure sensor via **HX711 + load cell**
- stable Wi-Fi after provisioning
- no Pi desktop/browser
- no local screen required

## Public Interfaces / Types
New website route:
- `/org/stations/[deviceId]`

Pi local endpoints:
- `GET /`
- `GET /stream.mjpg`
- `GET /api/state`
- `POST /api/arm`
- `POST /api/disarm`
- `POST /api/capture`
- `POST /api/reset`

Pi station state type:
- `off`
- `armed_waiting_for_item`
- `item_detected`
- `capturing_angle_1`
- `capturing_angle_2`
- `capturing_angle_3`
- `analysing`
- `complete`
- `error`

## Test Plan
1. Factory bootstrap test
- create `raspberry_pi` device in factory console
- Pi boots with device ID + bootstrap token
- bootstrap-status polling works

2. Claim flow test
- org admin claims device in `/org/devices`
- Pi receives nonce and calls claim-verify
- admin confirms claim
- Pi fetches org Wi-Fi + runtime token through provision-wifi
- Pi reconnects on org Wi-Fi and becomes usable

3. Local console test
- website launcher page opens `http://<deviceId>.local:8080`
- station page shows off/armed/busy states correctly

4. Manual arm test
- when off, pressure does nothing
- after `Enable Station`, pressure starts the session
- inactivity auto-disarms after timeout

5. Three-angle capture test
- capture angle 1, 2, 3 in order
- rotate instructions update correctly
- duplicate captures are rejected

6. Scan pipeline test
- Pi sends 3 images to `/api/pi-scan`
- scan is saved with `source='raspberry_pi'`
- `scan_id` opens in `/scan/result?scan=<id>`

7. Failure tests
- camera disconnected
- Wi-Fi unavailable after provisioning
- nonce expired
- item removed mid-session
- Pi reboot during armed mode
- mDNS hostname not resolving

## Assumptions
- Commissioning network is available during first boot.
- Pi onboarding should match the ESP32 ownership flow, not hotspot commissioning.
- The operator and Pi are on the same LAN when using the station console.
- mDNS hostname `<deviceId>.local` is the v1 addressing model.
- The live preview/capture UI is Pi-hosted, while the AI-EcoTrack website provides the launcher/status page.
- Auto-open from unrelated pages is explicitly out of scope for v1.
