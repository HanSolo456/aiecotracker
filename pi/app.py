from __future__ import annotations

import threading
import time
from html import escape

from flask import Flask, Response, jsonify, redirect

from bootstrap import BootstrapManager
from camera import CameraController
from config import StationConfig
from device_client import DeviceClient
from pressure import PressureSensor
from station import StationService


class StationRuntime:
    def __init__(self, config: StationConfig) -> None:
        self.config = config
        runtime_token = config.read_runtime_token()
        self.client = DeviceClient(config, runtime_token=runtime_token)
        self.bootstrap = BootstrapManager(config, self.client)
        self.camera = CameraController(config)
        self.pressure = PressureSensor(config)
        self.station = StationService(config, self.client, self.camera, self.pressure)
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        while True:
            try:
                if not self.station.runtime_ready():
                    self.bootstrap.tick()
                self.station.tick()
            except Exception as exc:  # noqa: BLE001
                self.station.last_error = str(exc)
            time.sleep(self.config.pressure_poll_interval_seconds)

    def state_payload(self) -> dict:
        payload = self.station.snapshot()
        payload["bootstrap"] = {
            "status": self.bootstrap.last_status.get("status") if self.bootstrap.last_status else None,
            "message": self.bootstrap.last_status.get("message") if self.bootstrap.last_status else None,
            "nextStep": self.bootstrap.last_status.get("nextStep") if self.bootstrap.last_status else None,
            "lastError": self.bootstrap.last_error,
        }
        payload["deviceId"] = self.config.device_id
        payload["deviceTokenStored"] = self.client.runtime_token is not None
        payload["cameraReady"] = self.camera.ready()
        payload["cameraError"] = self.camera.last_error
        payload["stationUrl"] = f"http://{self.config.device_id}.local:{self.config.local_port}"
        payload["resultUrl"] = (
            f"{self.config.app_base_url}/scan/result?scan={payload['scanId']}"
            if payload.get("scanId")
            else None
        )
        return payload


def build_html(payload: dict) -> str:
    state = escape(str(payload.get("state") or "off"))
    bootstrap = payload.get("bootstrap", {})
    if payload.get("deviceTokenStored"):
        bootstrap_message_raw = bootstrap.get("message") or "Bootstrap complete. Runtime token ready."
    else:
        bootstrap_message_raw = bootstrap.get("message") or "Waiting for bootstrap state."
    bootstrap_message = escape(str(bootstrap_message_raw))
    bootstrap_error = escape(str(payload.get("bootstrap", {}).get("lastError") or ""))
    last_error = escape(str(payload.get("lastError") or ""))
    scan_id = escape(str(payload.get("scanId") or "Pending"))
    result_url = payload.get("resultUrl")
    result_link = f'<a href="{escape(result_url)}" target="_blank" rel="noreferrer">Open Result</a>' if result_url else "No result yet"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI-EcoTrack Pi Station</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      font-family: Arial, sans-serif;
      background: #0b1220;
      color: #f8fafc;
    }}
    .shell {{
      max-width: 1080px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }}
    .card {{
      background: #111b2d;
      border: 1px solid #22304a;
      border-radius: 24px;
      padding: 20px;
    }}
    .hero {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
    }}
    .grid {{
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 16px;
    }}
    .actions {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }}
    button {{
      appearance: none;
      border: 1px solid #37506f;
      background: #18243a;
      color: #f8fafc;
      border-radius: 14px;
      padding: 12px 16px;
      font-weight: 600;
      cursor: pointer;
    }}
    .primary {{ border-color: #60a5fa; color: #60a5fa; }}
    .ok {{ border-color: #84cc16; color: #84cc16; }}
    .danger {{ border-color: #ef4444; color: #f87171; }}
    img {{
      width: 100%;
      border-radius: 20px;
      border: 1px solid #22304a;
      background: #0f172a;
    }}
    .muted {{ color: #94a3b8; }}
    .badge {{
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid #37506f;
      color: #60a5fa;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }}
    @media (max-width: 860px) {{
      .grid {{ grid-template-columns: 1fr; }}
      body {{ padding: 16px; }}
    }}
  </style>
</head>
<body>
  <div class="shell">
    <div class="card hero">
      <div>
        <div class="badge">Raspberry Pi Station</div>
        <h1>Operator Console</h1>
        <p class="muted">State: <strong>{state}</strong></p>
        <p class="muted">Bootstrap: {bootstrap_message}</p>
        <p class="muted">Scan ID: {scan_id}</p>
        <p class="muted">{result_link}</p>
        <div class="actions">
          <button class="ok" onclick="post('/api/arm')">Enable Station</button>
          <button class="danger" onclick="post('/api/disarm')">Disable Station</button>
          <button class="primary" onclick="post('/api/capture')">Capture Next Angle</button>
          <button onclick="post('/api/reset')">Reset Session</button>
        </div>
      </div>
      <div>
        <p class="muted">Runtime token stored: {str(payload.get("deviceTokenStored")).lower()}</p>
        <p class="muted">Camera ready: {str(payload.get("cameraReady")).lower()}</p>
        <p class="muted">Captured angles: {payload.get("capturedCount")}/{payload.get("captureCountTarget")}</p>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Preview</h2>
        <img id="snapshot" src="/snapshot?t=0" alt="Pi station preview" />
      </div>
      <div class="card">
        <h2>Diagnostics</h2>
        <p class="muted">Camera error: {escape(str(payload.get("cameraError") or "None"))}</p>
        <p class="muted">Last bootstrap error: {bootstrap_error or "None"}</p>
        <p class="muted">Last station error: {last_error or "None"}</p>
        <p class="muted">Website launcher path: /org/stations/{escape(str(payload.get("deviceId")))}</p>
      </div>
    </div>
  </div>

  <script>
    async function post(path) {{
      const response = await fetch(path, {{ method: 'POST' }});
      if (!response.ok) {{
        const data = await response.json().catch(() => ({{ error: 'Request failed' }}));
        alert(data.error || 'Request failed');
      }}
      window.location.reload();
    }}

    setInterval(() => {{
      const img = document.getElementById('snapshot');
      img.src = '/snapshot?t=' + Date.now();
    }}, 1000);
  </script>
</body>
</html>
"""


def create_app() -> Flask:
    config = StationConfig.from_env()
    runtime = StationRuntime(config)
    runtime.start()

    app = Flask(__name__)

    @app.after_request
    def add_cors_headers(response: Response) -> Response:
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    @app.route("/api/<path:_path>", methods=["OPTIONS"])
    def api_options(_path: str) -> Response:
        return Response(status=204)

    @app.get("/")
    def index() -> str:
        return build_html(runtime.state_payload())

    @app.get("/health")
    def health() -> Response:
        return jsonify({"ok": True, **runtime.state_payload()})

    @app.get("/api/state")
    def api_state() -> Response:
        return jsonify(runtime.state_payload())

    @app.post("/api/arm")
    def api_arm() -> Response:
        try:
            runtime.station.arm()
            return jsonify(runtime.state_payload())
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": str(exc), **runtime.state_payload()}), 400

    @app.post("/api/disarm")
    def api_disarm() -> Response:
        runtime.station.disarm()
        return jsonify(runtime.state_payload())

    @app.post("/api/reset")
    def api_reset() -> Response:
        runtime.station.reset()
        return jsonify(runtime.state_payload())

    @app.post("/api/manual-trigger")
    def api_manual_trigger() -> Response:
        try:
            return jsonify(runtime.station.manual_trigger())
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": str(exc), **runtime.state_payload()}), 400

    @app.post("/api/capture")
    def api_capture() -> Response:
        try:
            return jsonify(runtime.station.capture())
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": str(exc), **runtime.state_payload()}), 400

    @app.get("/snapshot")
    def snapshot() -> Response:
        payload, mime_type = runtime.camera.snapshot()
        return Response(payload, mimetype=mime_type)

    @app.get("/open-result")
    def open_result() -> Response:
        payload = runtime.state_payload()
        result_url = payload.get("resultUrl")
        if not result_url:
            return redirect("/")
        return redirect(result_url)

    return app


def main() -> None:
    app = create_app()
    config = StationConfig.from_env()
    app.run(host="0.0.0.0", port=config.local_port, debug=False)


if __name__ == "__main__":
    main()
