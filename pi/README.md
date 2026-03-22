# Raspberry Pi Setup — AI-EcoTrack Station

## What this package does
- boots with `DEVICE_ID` + `DEVICE_BOOTSTRAP_TOKEN`
- polls the claim flow already used by hardware devices
- verifies claim when a nonce is issued
- finalizes bootstrap through `/api/devices/bootstrap-finalize`
- stores the runtime token locally
- serves a lightweight operator console on `http://<deviceId>.local:8080`
- runs the 3-angle capture flow and submits to `/api/pi-scan`

## Hardware
| Component | Notes |
|---|---|
| Raspberry Pi 4 | 1GB or above is fine |
| USB / CSI camera | Used for still capture |
| Pressure trigger | Current fallback is a GPIO button on pin 17 |

## Wiring for the fallback GPIO trigger
```
Button pin 1 → GPIO 17 (Pin 11)
Button pin 2 → GND     (Pin 9)
```
The code currently uses the GPIO button as a lightweight pressure trigger fallback. Replace `pressure.py` with your HX711/load-cell reader when the hardware is ready.

## Install
```bash
sudo apt update
sudo apt install -y python3-pip
cd /path/to/aiecotracker/pi
python3 -m pip install -r requirements.txt
```

Enable the camera if you are using the Pi camera module:
```bash
sudo raspi-config
# Interface Options -> Camera -> Enable
```

## Configure
Copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
```

Required values:
- `APP_BASE_URL`
- `DEVICE_ID`
- `DEVICE_BOOTSTRAP_TOKEN`

You do not need the runtime token at install time. The Pi will fetch it after org claim confirmation.

## Claim flow
1. Superadmin creates the Raspberry Pi device in factory inventory.
2. Put `DEVICE_ID` and `DEVICE_BOOTSTRAP_TOKEN` into `.env`.
3. Boot the Pi with working internet.
4. Org admin claims the device from `/org/devices`.
5. Pi sees `claim_pending`, calls `/api/devices/claim-verify`, then waits.
6. After admin confirmation, Pi calls `/api/devices/bootstrap-finalize`.
7. The runtime token is stored in `.device_token`.
8. The station is ready for operator use.

## Run
```bash
python3 app.py
```

The local console is served on:
```text
http://<deviceId>.local:8080
```

Useful endpoints:
- `/`
- `/health`
- `/api/state`
- `/api/arm`
- `/api/disarm`
- `/api/capture`
- `/api/reset`
- `/snapshot`

## Run on boot
```bash
# /etc/systemd/system/ecotrack-pi-station.service
[Unit]
Description=AI-EcoTrack Raspberry Pi Station
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/aiecotracker/pi
ExecStart=/usr/bin/python3 /home/pi/aiecotracker/pi/app.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ecotrack-pi-station
sudo systemctl start ecotrack-pi-station
```
