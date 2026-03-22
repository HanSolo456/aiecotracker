from __future__ import annotations

import threading
import time
from typing import Any

from camera import CameraController
from config import StationConfig
from device_client import DeviceClient
from pressure import PressureSensor


class StationService:
    def __init__(
        self,
        config: StationConfig,
        client: DeviceClient,
        camera: CameraController,
        pressure: PressureSensor,
    ) -> None:
        self.config = config
        self.client = client
        self.camera = camera
        self.pressure = pressure
        self._lock = threading.Lock()

        self.state = "off"
        self.last_error: str | None = None
        self.last_result: dict[str, Any] | None = None
        self.scan_id: str | None = None
        self.captured_images: list[str] = []
        self.last_activity_at = time.time()

    def _snapshot_unlocked(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "runtimeReady": self.runtime_ready(),
            "captureCountTarget": self.config.capture_count,
            "capturedCount": len(self.captured_images),
            "scanId": self.scan_id,
            "lastError": self.last_error,
            "lastResult": self.last_result,
        }

    def runtime_ready(self) -> bool:
        return bool(self.client.runtime_token)

    def arm(self) -> None:
        with self._lock:
            if not self.runtime_ready():
                raise RuntimeError("Station runtime token is not available yet.")
            self.captured_images = []
            self.last_result = None
            self.scan_id = None
            self.last_error = None
            self.state = "armed_waiting_for_item"
            self.last_activity_at = time.time()

    def disarm(self) -> None:
        with self._lock:
            self.state = "off"
            self.captured_images = []
            self.last_error = None
            self.last_activity_at = time.time()

    def reset(self) -> None:
        with self._lock:
            self.captured_images = []
            self.last_result = None
            self.scan_id = None
            self.last_error = None
            self.state = "armed_waiting_for_item" if self.runtime_ready() else "off"
            self.last_activity_at = time.time()

    def capture(self) -> dict[str, Any]:
        with self._lock:
            if not self.runtime_ready():
                raise RuntimeError("Station is not provisioned with a runtime token yet.")

            if self.state in {"off", "armed_waiting_for_item"}:
                raise RuntimeError("Place an item on the pressure sensor before capture.")

            if self.state in {"analysing", "complete"}:
                raise RuntimeError("Current session is already finishing or finished.")

            if self.state == "error":
                raise RuntimeError("Reset the station before capturing again.")

            image = self.camera.capture_base64()
            self.captured_images.append(image)
            self.last_activity_at = time.time()

            if len(self.captured_images) >= self.config.capture_count:
                self.state = "analysing"
            elif len(self.captured_images) == 1:
                self.state = "capturing_angle_2"
            elif len(self.captured_images) == 2:
                self.state = "capturing_angle_3"

        if len(self.captured_images) >= self.config.capture_count:
            return self._submit_scan()

        return self.snapshot()

    def manual_trigger(self) -> dict[str, Any]:
        with self._lock:
            if not self.runtime_ready():
                raise RuntimeError("Station is not provisioned with a runtime token yet.")
            if self.state == "off":
                raise RuntimeError("Enable the station before triggering a scan.")
            if self.state == "armed_waiting_for_item":
                self.state = "item_detected"
                self.last_error = None
                self.last_activity_at = time.time()
            return self._snapshot_unlocked()

    def tick(self) -> None:
        with self._lock:
            now = time.time()

            if self.state == "off":
                return

            if now - self.last_activity_at > self.config.arm_timeout_seconds:
                self.state = "off"
                self.last_error = "Station auto-disabled after inactivity timeout."
                return

            if self.state == "armed_waiting_for_item" and self.pressure.item_present():
                self.state = "item_detected"
                self.last_activity_at = now
                return

            if self.state == "item_detected" and not self.pressure.item_present():
                self.state = "armed_waiting_for_item"
                return

            if self.state in {"capturing_angle_2", "capturing_angle_3"} and not self.pressure.item_present():
                self.state = "error"
                self.last_error = "Item removed before the 3-angle capture flow completed."

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._snapshot_unlocked()

    def _submit_scan(self) -> dict[str, Any]:
        try:
            result = self.client.submit_scan(self.captured_images[: self.config.capture_count])
            with self._lock:
                self.last_result = result
                self.scan_id = result.get("scan_id")
                self.state = "complete"
                self.last_error = None
                self.last_activity_at = time.time()
                return self._snapshot_unlocked()
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self.state = "error"
                self.last_error = f"Scan submission failed: {exc}"
                self.last_activity_at = time.time()
                return self._snapshot_unlocked()
