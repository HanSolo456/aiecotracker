from __future__ import annotations

import base64
import io
import threading
import time
from typing import Any

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
        self._backend = "none"
        self._camera = None
        self._cv2: Any | None = None
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
        requested = self.config.camera_backend
        attempts: list[str] = []

        # USB webcams need a different stack from Picamera2, so allow explicit forcing
        # and also fall back automatically when the preferred backend is unavailable.
        if requested in {"usb", "auto"}:
            usb_error = self._boot_usb_camera()
            if usb_error is None:
                return
            attempts.append(f"usb: {usb_error}")
            if requested == "usb":
                self.last_error = usb_error
                return

        if requested in {"picamera2", "auto"}:
            picamera_error = self._boot_picamera2_camera()
            if picamera_error is None:
                return
            attempts.append(f"picamera2: {picamera_error}")
            if requested == "picamera2":
                self.last_error = picamera_error
                return

        self._camera = None
        self._cv2 = None
        self._started = False
        self.last_error = " | ".join(attempts) if attempts else "No camera backend could be initialized."

    def _boot_picamera2_camera(self) -> str | None:
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
            self._backend = "picamera2"
            self._started = True
            self.last_error = None
            return None
        except Exception as exc:  # noqa: BLE001
            return str(exc)

    def _boot_usb_camera(self) -> str | None:
        try:
            import cv2

            capture = cv2.VideoCapture(self.config.usb_camera_index, cv2.CAP_V4L2)
            if not capture.isOpened():
                capture.release()
                capture = cv2.VideoCapture(self.config.usb_camera_index)

            if not capture.isOpened():
                return f"Unable to open USB camera index {self.config.usb_camera_index}."

            capture.set(
                cv2.CAP_PROP_FOURCC,
                cv2.VideoWriter_fourcc(*self.config.usb_fourcc),
            )
            capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.camera_width)
            capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.camera_height)
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            for _ in range(6):
                ok, _frame = capture.read()
                if ok:
                    break
                time.sleep(0.05)

            self._camera = capture
            self._cv2 = cv2
            self._backend = "usb"
            self._started = True
            self.last_error = None
            return None
        except Exception as exc:  # noqa: BLE001
            return str(exc)

    def ready(self) -> bool:
        return self._camera is not None and self._started

    def backend_name(self) -> str:
        return self._backend

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

        if self._backend == "usb":
            return self._capture_usb_jpeg_bytes(still=still)
        if self._backend == "picamera2":
            return self._capture_picamera2_jpeg_bytes(still=still)
        raise RuntimeError("Camera backend is not initialized.")

    def _capture_picamera2_jpeg_bytes(self, *, still: bool) -> bytes:
        if self._camera is None:
            raise RuntimeError("Picamera2 backend is not available.")

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

    def _capture_usb_jpeg_bytes(self, *, still: bool) -> bytes:
        if self._camera is None or self._cv2 is None:
            raise RuntimeError("USB camera backend is not available.")

        frame = self._read_usb_frame(still=still)
        if still:
            return self._encode_usb_frame(frame, quality=self.config.capture_jpeg_quality)
        return self._encode_usb_frame(
            frame,
            quality=self.config.preview_jpeg_quality,
            size=(self.config.preview_width, self.config.preview_height),
        )

    def _read_usb_frame(self, *, still: bool) -> Any:
        if self._camera is None or self._cv2 is None:
            raise RuntimeError("USB camera backend is not available.")

        frame = None
        with self._camera_lock:
            reads = 4 if still else 1
            for _ in range(reads):
                ok, candidate = self._camera.read()
                if ok and candidate is not None:
                    frame = candidate
                if still:
                    time.sleep(0.02)

        if frame is None:
            raise RuntimeError("USB webcam did not return a frame.")

        return self._cv2.flip(frame, 1)

    def _encode_usb_frame(
        self,
        frame: Any,
        *,
        quality: int,
        size: tuple[int, int] | None = None,
    ) -> bytes:
        if self._cv2 is None:
            raise RuntimeError("OpenCV is not available for USB frame encoding.")

        working = frame
        if size is not None:
            working = self._cv2.resize(frame, size, interpolation=self._cv2.INTER_AREA)

        ok, buffer = self._cv2.imencode(
            ".jpg",
            working,
            [int(self._cv2.IMWRITE_JPEG_QUALITY), int(quality)],
        )
        if not ok:
            raise RuntimeError("Failed to encode USB webcam frame as JPEG.")
        return buffer.tobytes()

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
