from __future__ import annotations

import base64
import io
import threading
import time

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
        self._preview_config = None
        self._still_config = None
        self._camera_lock = threading.Lock()
        self._preview_lock = threading.Lock()
        self._preview_condition = threading.Condition(self._preview_lock)
        self._preview_interval_seconds = max(0.08, min(self.config.preview_refresh_seconds, 0.2))
        self._preview_frame = PLACEHOLDER_SVG
        self._preview_mime_type = "image/svg+xml"
        self._preview_sequence = 0
        self._preview_thread: threading.Thread | None = None
        self.last_error: str | None = None
        self._boot_camera()
        self._start_preview_loop()

    def _boot_camera(self) -> None:
        try:
            from libcamera import Transform
            from picamera2 import Picamera2

            camera = Picamera2()
            self._preview_config = camera.create_preview_configuration(
                main={"size": (self.config.preview_width, self.config.preview_height)},
                transform=Transform(hflip=1),
                buffer_count=4,
                queue=False,
            )
            self._still_config = camera.create_still_configuration(
                main={"size": (self.config.camera_width, self.config.camera_height), "format": "YUV420"},
                transform=Transform(hflip=1),
            )
            camera.configure(self._preview_config)
            camera.start()
            self._camera = camera
            self._started = True
            self.last_error = None
        except Exception as exc:  # noqa: BLE001
            self._camera = None
            self._started = False
            self.last_error = str(exc)

    def ready(self) -> bool:
        return self._camera is not None and self._started

    def snapshot(self) -> tuple[bytes, str]:
        with self._preview_lock:
            return self._preview_frame, self._preview_mime_type

    def wait_for_preview_frame(
        self,
        last_sequence: int | None = None,
        timeout: float | None = None,
    ) -> tuple[bytes, str, int]:
        with self._preview_condition:
            if last_sequence is not None and self._preview_sequence == last_sequence:
                self._preview_condition.wait(timeout=timeout)
            return self._preview_frame, self._preview_mime_type, self._preview_sequence

    def preview_interval_seconds(self) -> float:
        return self._preview_interval_seconds

    def _start_preview_loop(self) -> None:
        if self._preview_thread and self._preview_thread.is_alive():
            return

        self._preview_thread = threading.Thread(target=self._preview_loop, daemon=True)
        self._preview_thread.start()

    def _preview_loop(self) -> None:
        while True:
            if not self.ready():
                self._store_preview(PLACEHOLDER_SVG, "image/svg+xml")
                time.sleep(1.0)
                continue

            try:
                payload = self._capture_jpeg_bytes(still=False)
                self._store_preview(payload, "image/jpeg")
            except Exception as exc:  # noqa: BLE001
                self.last_error = str(exc)
                self._store_preview(PLACEHOLDER_SVG, "image/svg+xml")
                time.sleep(1.0)
                continue

            time.sleep(self._preview_interval_seconds)

    def _store_preview(self, payload: bytes, mime_type: str) -> None:
        with self._preview_condition:
            self._preview_frame = payload
            self._preview_mime_type = mime_type
            self._preview_sequence += 1
            self._preview_condition.notify_all()

    def _capture_jpeg_bytes(self, *, still: bool) -> bytes:
        if not self.ready():
            raise RuntimeError(
                "Camera is not available. Check camera wiring and ensure picamera2 is installed."
            )

        output = io.BytesIO()

        with self._camera_lock:
            if still:
                if self._still_config is None or self._preview_config is None:
                    raise RuntimeError("Camera configurations are not available.")

                self._camera.stop()
                self._camera.configure(self._still_config)
                self._camera.start()
                time.sleep(0.12)
                self._camera.capture_file(output, format="jpeg")
                self._camera.stop()
                self._camera.configure(self._preview_config)
                self._camera.start()
                time.sleep(0.05)
            else:
                self._camera.capture_file(output, format="jpeg")

        return output.getvalue()

    def capture_base64(self) -> str:
        if not self.ready():
            raise RuntimeError(
                "Camera is not available. Check camera wiring and ensure picamera2 is installed."
            )
        payload = self._capture_jpeg_bytes(still=True)
        return base64.b64encode(payload).decode("utf-8")

    @staticmethod
    def _svg_to_data_bytes(svg_bytes: bytes) -> bytes:
        return io.BytesIO(svg_bytes).getvalue()
