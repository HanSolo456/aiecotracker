from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_dotenv(path: str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


@dataclass
class StationConfig:
    app_base_url: str
    device_id: str
    bootstrap_token: str
    device_token_path: Path
    camera_backend: str
    usb_camera_index: int
    usb_fourcc: str
    local_port: int
    capture_count: int
    pressure_threshold_grams: float
    pressure_poll_interval_seconds: float
    arm_timeout_seconds: int
    camera_width: int
    camera_height: int
    preview_width: int
    preview_height: int
    preview_refresh_seconds: float
    preview_jpeg_quality: int
    capture_jpeg_quality: int
    button_pin: int

    @classmethod
    def from_env(cls) -> "StationConfig":
        load_dotenv()

        app_base_url = os.environ.get("APP_BASE_URL", "").strip().rstrip("/")
        device_id = os.environ.get("DEVICE_ID", "").strip().lower()
        bootstrap_token = os.environ.get("DEVICE_BOOTSTRAP_TOKEN", "").strip()
        device_token_path = Path(os.environ.get("DEVICE_TOKEN_PATH", "./.device_token")).expanduser()

        if not app_base_url:
            raise RuntimeError("APP_BASE_URL is required.")
        if not device_id:
            raise RuntimeError("DEVICE_ID is required.")
        if not bootstrap_token:
            raise RuntimeError("DEVICE_BOOTSTRAP_TOKEN is required.")

        return cls(
            app_base_url=app_base_url,
            device_id=device_id,
            bootstrap_token=bootstrap_token,
            device_token_path=device_token_path,
            camera_backend=os.environ.get("CAMERA_BACKEND", "auto").strip().lower(),
            usb_camera_index=int(os.environ.get("USB_CAMERA_INDEX", "0")),
            usb_fourcc=os.environ.get("USB_FOURCC", "MJPG").strip().upper()[:4] or "MJPG",
            local_port=int(os.environ.get("STATION_PORT", "8080")),
            capture_count=max(1, min(int(os.environ.get("CAPTURE_COUNT", "3")), 3)),
            pressure_threshold_grams=float(os.environ.get("PRESSURE_THRESHOLD_GRAMS", "50")),
            pressure_poll_interval_seconds=float(os.environ.get("PRESSURE_POLL_INTERVAL_SECONDS", "0.35")),
            arm_timeout_seconds=int(os.environ.get("ARM_TIMEOUT_SECONDS", "600")),
            camera_width=int(os.environ.get("CAMERA_CAPTURE_WIDTH", "1280")),
            camera_height=int(os.environ.get("CAMERA_CAPTURE_HEIGHT", "720")),
            preview_width=int(os.environ.get("PREVIEW_WIDTH", "640")),
            preview_height=int(os.environ.get("PREVIEW_HEIGHT", "360")),
            preview_refresh_seconds=float(os.environ.get("PREVIEW_REFRESH_SECONDS", "0.12")),
            preview_jpeg_quality=max(30, min(int(os.environ.get("PREVIEW_JPEG_QUALITY", "60")), 95)),
            capture_jpeg_quality=max(60, min(int(os.environ.get("CAPTURE_JPEG_QUALITY", "92")), 100)),
            button_pin=int(os.environ.get("BUTTON_PIN", "17")),
        )

    def read_runtime_token(self) -> str | None:
        if not self.device_token_path.exists():
            return None
        token = self.device_token_path.read_text().strip()
        return token or None

    def write_runtime_token(self, token: str) -> None:
        self.device_token_path.parent.mkdir(parents=True, exist_ok=True)
        self.device_token_path.write_text(token.strip() + "\n")
