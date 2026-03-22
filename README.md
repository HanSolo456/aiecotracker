# AI-EcoTrack

> **Identify → Safeguard → Passport** — AI-powered industrial waste identification and circular economy platform.

Built by **Team MakersLab** (Saumitra Matta · Satyam Anand · Siddharth Singh)

---

## What It Does

Point a camera at any industrial part — valve, motor, pipe fitting, circuit board — and AI-EcoTrack tells you:

- **What it is** — part class, subtype, alloy grade (e.g. 316L Stainless Steel)
- **Is it safe** — hazard flags: pressurized, lead solder, asbestos, hydrocarbon residue
- **What it's worth** — India-specific scrap value in ₹
- **How to disassemble it** — step-by-step guide with OSHA safety protocols
- **A permanent record** — auto-generated Digital Product Passport (DPP) with WRI score

No barcode. No label. No lab. Just a photo.

---

## System Overview

```
[Item Detected — IR Sensor]
        ↓
[Raspberry Pi or edge camera captures 1–3 angle photos]
        ↓
[Groq API → Llama 4 Scout VLM]  ←→  [RAG: disassembly guides + material sheets + scrap prices]
        ↓
[Safety Gatekeeper — hazard check + confidence threshold]
        ↓                    ↓
  [Safe to proceed]    [Escalate to human]
        ↓
[WRI Score + Digital Product Passport → Firebase]
        ↓
[Next.js Dashboard updates in real-time]
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Vision** | Llama 4 Scout (`meta-llama/llama-4-scout-17b-16e-instruct`) via Groq |
| **AI Fallback** | Gemini 1.5 Flash (Google) |
| **Frontend** | Next.js 16 — PWA, works on any phone |
| **Database** | Firebase Firestore (real-time) |
| **Auth** | Firebase Anonymous Auth |
| **Hardware** | Arduino UNO + ESP32 Gateway + Raspberry Pi |
| **Sensors** | MQ-135 (gas), HC-SR04 (fill level), DHT (temp/humidity), IR |
| **Styling** | Tailwind CSS |
| **Language** | TypeScript |

---

## Key Features

- **Zero-label identification** — works on any decommissioned industrial part
- **Multi-view scan** — up to 3 angles merged for highest confidence
- **Safety Gatekeeper** — mandatory human escalation below confidence threshold
- **Auto-generated DPP** — EU ESPR 2024 & India EPR 2022 compliant
- **Live IoT monitor** — real-time bin fill, air quality, temperature dashboard
- **Groq key rotation** — 3-key fallback + Gemini backup, zero downtime
- **WRI Score** — Weighted Recyclability Index for circular economy reporting

---

## Project Structure

```
app/
├── api/
│   ├── identify-part/       # Single-view VLM scan
│   ├── identify-part-multiview/  # Multi-angle merged scan
│   ├── generate-dpp/        # Digital Product Passport generation
│   ├── retrieve-guide/      # RAG disassembly guide retrieval
│   ├── sensor-data/         # IoT sensor readings
│   └── pi-scan/             # Raspberry Pi triggered scan
├── scan/                    # Scan interface
├── iot-monitor/             # Live sensor dashboard
├── passport/                # DPP viewer
├── history/                 # Scan history
└── guide/                   # Disassembly guides

lib/
├── groqClient.ts            # Groq key rotation utility
├── knowledgeBase.ts         # RAG local knowledge retrieval
├── safetyGatekeeper.ts      # Hazard rule engine
├── mergeVLMResults.ts       # Multi-view result merging
└── scanService.ts           # Firestore persistence layer

data/knowledge/
├── disassembly_guides.json
├── material_data_sheets.json
├── safety_regulations.json
├── scrap_pricing_india.json
└── regulatory_compliance.json

hardware/
├── arduino_main/            # Arduino sensor sketch
└── esp32_gateway/           # ESP32 WiFi gateway sketch
```

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-username/aiecotracker.git
cd aiecotracker
npm install
```

### 2. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required keys:

```env
# AI
GROQ_API_KEY_1=your_groq_key
GROQ_API_KEY_2=your_groq_key_2
GROQ_API_KEY_3=your_groq_key_3
GEMINI_API_KEY=your_gemini_key

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# IoT Device Auth
# Register each device in My Org -> Settings -> Device Management
# and flash that device with its own DEVICE_ID + DEVICE_TOKEN.
```

### 3. Run

```bash
npm run dev
```

Open `http://localhost:3000`

---

## Hardware Setup

See [hardware/README.md](hardware/README.md) for full wiring and flashing instructions for Arduino and ESP32 Gateway.

---

## Standards Referenced

- EU ESPR 2024 — Digital Product Passport mandate
- India E-Waste Management Rules, 2022
- OSHA 1910.147 — Lockout/Tagout
- RoHS Directive 2011/65/EU
- REACH Annex XVII

---

## License

MIT
