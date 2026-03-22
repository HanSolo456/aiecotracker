from __future__ import annotations

import base64
import io
import tempfile
from pathlib import Path

from config import StationConfig


PLACEHOLDER_SVG = """
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0b1220"/>
  <rect x="48" y="48" width="1184" height="624" rx="32" fill="#131d31" stroke="#25406b" stroke-width="2"/>
  <text x="640" y="300" text-anchor="middle" fill="#60a5fa" font-family="Arial, sans-serif" font-size="32">AI-EcoTrack Raspberry Pi Station</text>
  <text x="640" y="352" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="20">Camera preview placeholder</text>
  <text x="640" y="390" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="20">Connect a USB / CSI camera on the Pi for live capture</text>
</svg>
""".strip().encode("utf-8")


class CameraController:
    def __init__(self, config: StationConfig) -> None:
        self.config = config
        self._camera = None
        self._started = False
        self._boot_camera()

    def _boot_camera(self) -> None:
        try:
            from picamera2 import Picamera2

            camera = Picamera2()
            camera.configure(
                camera.create_still_configuration(
                    main={"size": (self.config.camera_width, self.config.camera_height)}
                )
            )
            camera.start()
            self._camera = camera
            self._started = True
        except Exception:  # noqa: BLE001
            self._camera = None
            self._started = False

    def snapshot(self) -> tuple[bytes, str]:
        if not self._camera:
            return PLACEHOLDER_SVG, "image/svg+xml"

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as handle:
            path = Path(handle.name)

        try:
            self._camera.capture_file(str(path))
            return path.read_bytes(), "image/jpeg"
        finally:
            if path.exists():
                path.unlink()

    def capture_base64(self) -> str:
        payload, mime_type = self.snapshot()
        if mime_type != "image/jpeg":
            payload = self._svg_to_data_bytes(payload)
        return base64.b64encode(payload).decode("utf-8")

    @staticmethod
    def _svg_to_data_bytes(svg_bytes: bytes) -> bytes:
        return io.BytesIO(svg_bytes).getvalue()

