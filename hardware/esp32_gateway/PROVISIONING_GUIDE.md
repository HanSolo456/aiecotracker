# ESP-32 Provisioning Guide (Final Automated Flow)

## What To Upload

Upload these two files together in the same Arduino sketch:

- `esp32_gateway_WITH_PROVISIONING.ino`
- `provisioning.ino`

No OLED is required.

## Required Firmware Constants

In `esp32_gateway_WITH_PROVISIONING.ino`, set:

- `DEVICE_ID_FACTORY` (factory-burned ID, e.g. `acme-batch-2025-unit-1`)
- `DEVICE_TOKEN_BOOTSTRAP` (factory bootstrap token)
- `SERVER_URL` (e.g. `https://aiecotracker.vercel.app/api/sensor-data`)

## Fully Automated Device Flow

1. Device boots and checks NVS for `wifi_ssid`, `wifi_password`, `device_token`.
2. If WiFi is missing, device enters provisioning mode.
3. Device polls `GET /api/devices/bootstrap-status` with:
   - `x-device-id`
   - `x-device-bootstrap-token`
4. Org admin initiates claim via `POST /api/org/devices/claim`.
5. Bootstrap status returns `claim_pending` + `claimNonce`.
6. Device automatically calls `POST /api/devices/claim-verify` with nonce.
7. Org admin confirms claim via `PATCH /api/org/devices/[deviceId]` action `confirm_claim`.
8. Device keeps polling bootstrap status until state is `claim_confirmed`.
9. Device calls `POST /api/devices/provision-wifi` with bootstrap token.
10. Server returns one-time:
    - `ssid`
    - `password`
    - `deviceToken` (runtime token)
11. Device stores all values in NVS and reboots.
12. Device sends telemetry to `POST /api/sensor-data` using `x-device-token`.

## NVS Keys

Namespace: `aieco_prov`

- `wifi_ssid`
- `wifi_password`
- `device_token`

## API Endpoints Used By Firmware

- `GET /api/devices/bootstrap-status`
- `POST /api/devices/claim-verify`
- `POST /api/devices/provision-wifi`
- `POST /api/sensor-data`

## Minimal Bring-up Checklist

1. Confirm factory inventory has the same `deviceId` and bootstrap token as firmware.
2. Set org WiFi in `/org/devices` page before confirming claim.
3. Initiate claim and then confirm claim from org admin UI.
4. Watch Serial logs for:
   - `[PROV STATUS]`
   - `[PROV VERIFY]`
   - `[PROV FETCH]`
5. After reboot, confirm sensor posts succeed.

## Common Errors

1. `Bootstrap auth failed`: wrong `DEVICE_TOKEN_BOOTSTRAP` or `DEVICE_ID_FACTORY`.
2. `Organization WiFi credentials not configured`: set WiFi in org devices page.
3. `Device not ready for WiFi provisioning`: claim not yet confirmed.
4. `WiFi provisioning already completed`: device already fetched one-time WiFi.

## Security Notes

- Bootstrap token is for first-boot provisioning.
- Runtime token (`device_token`) is used for ongoing sensor uploads.
- WiFi plaintext is returned once only, then blocked by `wifiProvisionedAt`.
