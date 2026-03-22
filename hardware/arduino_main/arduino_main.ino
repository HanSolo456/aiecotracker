// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack — Arduino UNO Sensor Hub (Simplified)
//
// Sensors / Actuators:
//   D2  = HC-SR04 TRIG
//   D3  = HC-SR04 ECHO
//   D4  = IR Sensor OUT
//   D6  = DHT-11 DATA
//   D8  = Red LED
//   D9  = Buzzer
//   D11 = SoftwareSerial TX → ESP-32 GPIO16
//   D12 = SoftwareSerial RX ← ESP-32 GPIO17
//   A0  = MQ-135 AOUT
// ─────────────────────────────────────────────────────────────────────────────

#include <DHT.h>
#include <SoftwareSerial.h>

// ── Pin Definitions ──────────────────────────────────────────────────────────
#define TRIG_PIN 9
#define ECHO_PIN 10
#define IR_PIN 4
#define DHT_PIN 7
#define LED_RED 8
#define BUZZER_PIN 3
#define SOFT_TX 11
#define SOFT_RX 12
#define MQ135_PIN A0

// ── Constants
// ─────────────────────────────────────────────────────────────────
#define DHT_TYPE DHT11
#define GAS_ALERT_THRESHOLD 400 // MQ-135 raw ADC threshold for alert

// HC-SR04 calibration — measure your actual bin and adjust!
#define BIN_EMPTY_CM 25 // Distance (cm) from sensor when bin is EMPTY
#define BIN_FULL_CM 5   // Distance (cm) from sensor when bin is FULL

#define SEND_INTERVAL_MS 3000 // Send data every 3 seconds

// ── Objects
// ───────────────────────────────────────────────────────────────────
SoftwareSerial espSerial(SOFT_RX, SOFT_TX);
DHT dht(DHT_PIN, DHT_TYPE);

// ── State
// ─────────────────────────────────────────────────────────────────────
unsigned long lastSend = 0;

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);
  dht.begin();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IR_PIN, INPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("[Arduino] Booted OK");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // ── Read sensors ─────────────────────────────────────────────────────────
  bool ir = digitalRead(IR_PIN) == LOW; // LOW = object detected
  int mq135 = analogRead(MQ135_PIN);
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  int fillCm = readUltrasonicCm();
  int fillPct = cmToFillPct(fillCm);

  // Handle NaN from DHT (happens on bad read)
  if (isnan(temp))
    temp = 0.0;
  if (isnan(humidity))
    humidity = 0.0;

  // ── Gas alert ─────────────────────────────────────────────────────────────
  bool gasAlert = (mq135 > GAS_ALERT_THRESHOLD);
  if (gasAlert) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER_PIN, 1000, 500);
    delay(600);
    noTone(BUZZER_PIN);
  } else {
    digitalWrite(LED_RED, LOW);
  }

  // ── Item drop beep ────────────────────────────────────────────────────────
  if (ir) {
    tone(BUZZER_PIN, 1800, 150);
    digitalWrite(LED_RED, HIGH);
    delay(200);
    noTone(BUZZER_PIN);
    digitalWrite(LED_RED, LOW);
  }

  // ── Send JSON to ESP-32 every interval ───────────────────────────────────
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendToESP(fillPct, mq135, temp, humidity, ir, gasAlert);
  }

  delay(
      3000); // Wait 15 seconds before next reading (prevent Firebase flooding)
}

// ── HC-SR04: average 3 readings, return 0 if no echo (sensor not connected) ──
int readUltrasonicCm() {
  long total = 0;
  int valid = 0;
  for (int i = 0; i < 3; i++) {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    long dur = pulseIn(ECHO_PIN, HIGH, 30000);
    int cm = (dur == 0) ? -1 : (int)(dur * 0.034 / 2);
    if (cm > 0 && cm < 400) {
      total += cm;
      valid++;
    }
    delay(30);
  }
  return valid > 0 ? (int)(total / valid) : -1; // -1 = no valid reading
}

int cmToFillPct(int cm) {
  if (cm < 0)
    return 0; // No reading → assume empty
  return constrain(map(cm, BIN_EMPTY_CM, BIN_FULL_CM, 0, 100), 0, 100);
}

void sendToESP(int fill, int gas, float temp, float hum, bool drop,
               bool alert) {
  String json = "{";
  json += "\"fill_pct\":" + String(fill) + ",";
  json += "\"gas_ppm\":" + String(gas) + ",";
  json += "\"co_ppm\":" + String(0) + ","; // not used
  json += "\"temperature\":" + String(temp, 1) + ",";
  json += "\"humidity\":" + String(hum, 1) + ",";
  json += "\"item_dropped\":" + String(drop ? "true" : "false") + ",";
  json += "\"gas_alert\":" + String(alert ? "true" : "false");
  json += "}";

  espSerial.println(json);
  Serial.println("[Arduino] Sent → " + json);
}
