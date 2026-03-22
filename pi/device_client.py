from __future__ import annotations

from typing import Any

import requests

from config import StationConfig


class DeviceClient:
    def __init__(self, config: StationConfig, runtime_token: str | None = None) -> None:
        self.config = config
        self.runtime_token = runtime_token

    def _url(self, path: str) -> str:
        return f"{self.config.app_base_url}{path}"

    def _bootstrap_headers(self) -> dict[str, str]:
        return {
            "x-device-id": self.config.device_id,
            "x-device-bootstrap-token": self.config.bootstrap_token,
        }

    def _runtime_headers(self) -> dict[str, str]:
        if not self.runtime_token:
            raise RuntimeError("Runtime token not available yet.")
        return {
            "x-device-id": self.config.device_id,
            "x-device-token": self.runtime_token,
        }

    def set_runtime_token(self, token: str) -> None:
        self.runtime_token = token.strip()

    def bootstrap_status(self) -> dict[str, Any]:
        response = requests.get(
            self._url("/api/devices/bootstrap-status"),
            headers=self._bootstrap_headers(),
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def verify_claim(self, nonce: str) -> dict[str, Any]:
        response = requests.post(
            self._url("/api/devices/claim-verify"),
            json={"deviceId": self.config.device_id, "nonce": nonce},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def finalize_bootstrap(self) -> dict[str, Any]:
        response = requests.post(
            self._url("/api/devices/bootstrap-finalize"),
            headers=self._bootstrap_headers(),
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def submit_scan(self, images: list[str]) -> dict[str, Any]:
        response = requests.post(
            self._url("/api/pi-scan"),
            headers={
                **self._runtime_headers(),
                "Content-Type": "application/json",
            },
            json={
                "device_id": self.config.device_id,
                "images": images,
            },
            timeout=90,
        )
        response.raise_for_status()
        return response.json()

