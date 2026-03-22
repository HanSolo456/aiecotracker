from __future__ import annotations

from config import StationConfig


class PressureSensor:
    def __init__(self, config: StationConfig) -> None:
        self.config = config
        self._gpio = None
        self._use_button_fallback = False
        self._bootstrap_gpio()

    def _bootstrap_gpio(self) -> None:
        try:
            import RPi.GPIO as GPIO

            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.config.button_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            self._gpio = GPIO
            self._use_button_fallback = True
        except Exception:  # noqa: BLE001
            self._gpio = None
            self._use_button_fallback = False

    def item_present(self) -> bool:
        if self._use_button_fallback and self._gpio:
            return self._gpio.input(self.config.button_pin) == self._gpio.LOW
        return False

    def cleanup(self) -> None:
        if self._gpio:
            self._gpio.cleanup()

