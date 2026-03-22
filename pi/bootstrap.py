from __future__ import annotations

from typing import Any

import requests

from config import StationConfig
from device_client import DeviceClient


class BootstrapManager:
    def __init__(self, config: StationConfig, client: DeviceClient) -> None:
        self.config = config
        self.client = client
        self.last_status: dict[str, Any] | None = None
        self.last_error: str | None = None

    def tick(self) -> str | None:
        if self.client.runtime_token:
            return self.client.runtime_token

        try:
            status = self.client.bootstrap_status()
            self.last_status = status
            self.last_error = None

            device_status = status.get("status")
            claim_nonce = status.get("claimNonce")

            if device_status == "claim_pending" and claim_nonce:
                self.client.verify_claim(claim_nonce)
                return None

            if device_status == "claim_confirmed":
                finalized = self.client.finalize_bootstrap()
                runtime_token = (finalized.get("deviceToken") or "").strip()
                if runtime_token:
                    self.config.write_runtime_token(runtime_token)
                    self.client.set_runtime_token(runtime_token)
                    return runtime_token

            return None
        except requests.RequestException as exc:
            self.last_error = f"Bootstrap network error: {exc}"
            return None
        except Exception as exc:  # noqa: BLE001
            self.last_error = str(exc)
            return None

