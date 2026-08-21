# ♻️ AI-EcoTrack

<div align="center">

![AI-EcoTrack Banner](https://img.shields.io/badge/AI--EcoTrack-Circular%20Waste%20Intelligence-10B981?style=for-the-badge&logo=recycle&logoColor=white)

**Identify → Safeguard → Value → Passport → Route**  
*AI-powered industrial waste identification, OSHA safety gatekeeping, Digital Product Passports (DPP), IoT smart bin telemetry, and collection fleet route optimization.*

[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Groq AI](https://img.shields.io/badge/Groq-GPT%20OSS%20120B%20%7C%20Qwen%203.6-F55036?style=flat-square&logo=groq&logoColor=white)](https://groq.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2%20(Rust)-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![React Native](https://img.shields.io/badge/Mobile-Expo%20%7C%20React%20Native-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%7C%20Arduino%20%7C%20Raspberry%20Pi-00979D?style=flat-square&logo=arduino&logoColor=white)](https://www.arduino.cc/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)

Built with pride by **Team MakersLab**  
**Saumitra Matta** · **Satyam Anand** · **Siddharth Singh** · **Lohitaksh Sinha**

[Live Demo](#-getting-started) • [System Architecture](#-system-architecture) • [AI & Safety Gatekeeper](#-ai-vision--safety-gatekeeper-pipeline) • [Hardware & IoT](#-hardware--iot-smart-bins) • [DPP & WRI Specs](#-digital-product-passport-dpp--wri-index) • [Fleet Routing](#-fleet-route-optimization) • [API Docs](#-api-reference)

</div>

---

## 📖 Table of Contents

- [Executive Summary](#-executive-summary)
- [The Problem We Solve](#-the-problem-we-solve)
- [Key Features & Capabilities](#-key-features--capabilities)
- [System Architecture](#-system-architecture)
- [AI Vision & Safety Gatekeeper Pipeline](#-ai-vision--safety-gatekeeper-pipeline)
- [Digital Product Passport (DPP) & WRI Index](#-digital-product-passport-dpp--wri-index)
- [Worker Gamification & Incentive Engine](#-worker-gamification--incentive-engine)
- [Hardware & IoT Smart Bins](#-hardware--iot-smart-bins)
- [Raspberry Pi Headless Scanner Station](#-raspberry-pi-headless-scanner-station)
- [Fleet Route Optimization & Drop-Off Locator](#-fleet-route-optimization--drop-off-locator)
- [Cross-Platform Ecosystem](#-cross-platform-ecosystem)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Installation](#-getting-started--installation)
- [Environment Configuration](#-environment-configuration)
- [API Reference](#-api-reference)
- [Regulatory Standards & Compliance](#-regulatory-standards--compliance)
- [Contributors & License](#-contributors--license)

---

## 🌟 Executive Summary

**AI-EcoTrack** is an end-to-end reverse-manufacturing intelligence and circular economy platform. It connects physical decommissioned industrial equipment, hazardous materials, and municipal/factory scrap to real-time AI classification, deterministic safety compliance, instant scrap valuation, verifiable Digital Product Passports, and optimized collection logistics.

By combining **Groq ultra-fast VLM inference**, **RAG against industrial standards**, **IoT sensor networks (Arduino + ESP32)**, **Raspberry Pi automated scanning stations**, and **cross-platform interfaces (Web, Desktop, Mobile)**, AI-EcoTrack closes the loop between decommissioned assets and responsible remanufacturing or recycling.

```
Point Camera / Drop on Smart Station
                ↓
[Zero-Label AI Vision (Multi-Angle Fusion)]
                ↓
[Deterministic Safety Gatekeeper (OSHA/ATEX/RoHS/REACH)]
        ↓                                 ↓
[Safe to Disassemble]           [Hazard Warning / Escalation]
        ↓                                 ↓
[Step-by-Step Audio/Visual Guide] + [Live ₹ Scrap Valuation]
                ↓
[Digital Product Passport (DPP) with WRI Score & QR]
                ↓
[Smart IoT Bins Telemetry (Gas, Fill Level, Temp)]
                ↓
[Greedy TSP Route Optimization for Collection Fleets]
```

---

## 🛑 The Problem We Solve

1. **Unidentified Scrap Loss:** Millions of tons of decommissioned valves, pumps, alloys, and electronic components enter scrap yards without identification, losing 60–80% of their recovery value.
2. **Fatal Disassembly Hazards:** Unlabeled industrial components retain toxic fluids, explosive gas residues, asbestos seals, lead solder, or high-pressure charges. Technicians risk injury without automated lockout/tagout guidance.
3. **Regulatory Non-Compliance:** Emerging mandates like the **EU ESPR 2024** (Digital Product Passport) and **India E-Waste Management Rules 2022** require immutable material provenance, which traditional scrap workflows cannot provide.
4. **Inefficient Collection Fleets:** Municipalities and scrap haulers run blind, fixed collection routes, wasting fuel and producing excess carbon emissions on half-empty bins.
5. **Worker Disincentivization:** Sorters have no objective metric or transparent reward system for segregating high-purity single-alloy streams from contaminated mixed scrap.

---

## ⚡ Key Features & Capabilities

| Module | Features & Capabilities |
|---|---|
| **🔍 Zero-Label Vision Identification** | Identifies unlabelled industrial parts (valves, motors, pumps, heat exchangers, circuit boards, batteries) and alloy grades (e.g. 316L Stainless Steel, Inconel 625, C110 Copper) with up to 3 merged camera angles. |
| **🛡️ Safety Gatekeeper** | Deterministic rule engine enforcing **OSHA 1910.147** (Lockout/Tagout), **ATEX 2014/34/EU** (Explosive atmospheres), **RoHS**, **REACH Annex XVII**, and mandatory human escalation below confidence threshold. |
| **📜 Digital Product Passports (DPP)** | Generates tamper-evident passports compliant with **EU ESPR 2024** and **India EPR 2022**, containing full BOM, lifecycle history, recyclability classes, and printable QR codes. |
| **⚖️ Weighted Recyclability Index (WRI)** | Quantifies circularity score ($0.00$ to $1.00$) per component and benchmarks facility-wide sustainability metrics. |
| **💰 Real-Time Scrap Valuation** | Dynamic localized scrap price lookup (in **₹ INR** and **$ USD**) calculated from mass fraction, base alloy purity, and spot market pricing. |
| **📡 IoT Smart Bin Telemetry** | Real-time sensor ingestion from ESP32 & Arduino nodes tracking **MQ-135** (hazardous gas PPM), **HC-SR04** (fill level %), and **DHT11/22** (temperature/humidity). |
| **🗺️ Fleet Route Optimization** | Solves the Traveling Salesperson Problem (TSP) with greedy nearest-neighbor heuristics for collection-ready bins (>80% full), computing optimal stop order, driving time, distance, and CO₂ savings. |
| **📍 Drop-Off Facility Locator** | Interactive OpenStreetMap/Leaflet integration querying the **Overpass API** to discover nearby certified recycling centers, e-waste collectors, and scrap yards. |
| **🏆 Gamified Incentive System** | Purity-linked bonus compensation formulas ($3.0\times$ for Grade A single alloy, penalties for contaminated bins), segregation streaks, worker badges, and team leaderboards. |
| **🗣️ Multilingual & Voice AI** | Full UI localization in **English** and **Hindi (हिन्दी)**, integrated Text-to-Speech (Google Cloud TTS / Web Speech) for hands-free step guidance in noisy workshops, and voice STT search. |
| **🏢 Multi-Tenant Enterprise** | Role-based access control (Admins, Technicians, Superadmins), join codes, cryptographic device claim & provisioning workflows for hardware fleets. |
| **💻 Full Cross-Platform Suite** | Web PWA, native **Rust + Tauri v2** desktop application, **React Native / Expo** mobile client, and **Raspberry Pi 4** automated capture station. |

---

## 🏗️ System Architecture

### End-to-End Information Flow

```mermaid
flowchart TD
    subgraph Capture["1. Capture & Input Layer"]
        A1["📸 Mobile Camera / Web PWA"]
        A2["🖥️ Tauri Desktop App"]
        A3["🍓 Raspberry Pi Station (Load Cell + Cam)"]
        A4["📡 ESP32 Smart Bin Sensors"]
    end

    subgraph AI["2. AI Vision & Inference Pipeline"]
        B1["Groq API Client (3-Key Round-Robin Rotation)"]
        B2["GPT OSS 120B / Qwen 3.6 27B / Whisper Large v3"]
        B3["Google Gemini 1.5 Flash (Automatic Failover)"]
        B4["Multi-View Fusion Layer (Merge 3 Angles)"]
        B1 --> B2
        B2 -. Failure Fallback .-> B3
        B2 & B3 --> B4
    end

    subgraph Gatekeeper["3. Deterministic Safety & RAG Engine"]
        C1["Safety Gatekeeper (Rule Override Engine)"]
        C2["Confidence Threshold Check (≥ 0.92)"]
        C3["RAG Knowledge Base (Disassembly, Standards, Scrap)"]
        C4{"Confidence Check"}
        C1 --> C4
        C4 -- "Score < 0.92" --> C5["⚠️ Escalate to Materials Engineer"]
        C4 -- "Score ≥ 0.92" --> C6["✅ Verified Safe Pipeline"]
        C3 --> C6
    end

    subgraph Backend["4. Cloud & Data Layer"]
        D1["Firebase Firestore (Real-Time DB)"]
        D2["Firebase Auth (RBAC & Anonymous)"]
        D3["Digital Product Passport (DPP) Generator"]
        D4["Incentive & Badge Ledger"]
    end

    subgraph Ops["5. Operations & Circular Logistics"]
        E1["Next.js Real-time Dashboard & Analytics"]
        E2["Interactive Step-by-Step Disassembly Guide (with TTS)"]
        E3["IoT Sensor Live Monitor (Gas PPM / Bin Fill)"]
        E4["Fleet Route Optimization (Nearest Neighbor TSP)"]
        E5["Recycling Drop-Off Locator (Overpass / OSM)"]
    end

    Capture --> AI
    AI --> Gatekeeper
    C6 --> Backend
    Backend --> Ops
```

---

## 🧠 AI Vision & Safety Gatekeeper Pipeline

### 1. Multi-Tiered AI Architecture & Load Balancing
AI-EcoTrack implements high-availability zero-downtime inference:
- **Primary Tier:** Groq Cloud running `openai/gpt-oss-120b` (text/chat reasoning) and `qwen/qwen3.6-27b` (multimodal vision) along with `whisper-large-v3` (speech-to-text), powered by a **Multi-Key Round-Robin Rotation** pool to maximize throughput and eliminate rate limits.
- **Failover Tier:** Automatic, transparent failover to **Google Gemini 1.5 Flash** (`@google/generative-ai`) if Groq encounters 429/500 errors.
- **Multi-View Result Merging:** Combines feature vectors across 1 to 3 distinct angles of a physical item to eliminate blind spots and calculate aggregate confidence.

### 2. Structured JSON Inference Schema (`PartMetadataPayload`)
The vision model returns typed JSON grammar instead of arbitrary text:

```json
{
  "part_metadata_payload": {
    "visual_id": {
      "part_class": "gate_valve",
      "subtype": "wedge_gate_DN100",
      "confidence_score": 0.96,
      "bounding_box": [0.12, 0.08, 0.88, 0.91]
    },
    "material_inference": {
      "primary_material": "316L_stainless_steel",
      "secondary_material": "PTFE_seat_ring",
      "confidence_score": 0.91,
      "surface_condition": "moderate_corrosion_grade_2",
      "estimated_alloy_grade": "UNS_S31603"
    },
    "hazard_flags": {
      "asbestos_era_likelihood": false,
      "lead_solder_likelihood": true,
      "pressurized_component": true,
      "residual_fluid_risk": "hydrocarbon_likely"
    },
    "geometry_descriptor": {
      "nominal_size_mm": 100,
      "connection_type": "flanged_ANSI_B16.5",
      "estimated_mass_kg": 14.2
    }
  }
}
```

### 3. Layered Safety Gatekeeper Rules
To achieve **99% Protocol Coverage Score (PCS)** for hazardous disassembly:
- **Pressurized Component:** Mandatory injection of **OSHA 1910.147** Lockout/Tagout and bleed-off protocols.
- **Lead / Toxic Solder:** Mandatory injection of **REACH Annex XVII** and **RoHS Directive** containment procedures.
- **Hydrocarbon / Chemical Residue:** Mandatory **ATEX Directive 2014/34/EU** & **NFPA 30** flammability precautions.
- **Low Confidence (< 0.92):** Automatic lock preventing automated guide generation until reviewed by a supervisor.

---

## 📜 Digital Product Passport (DPP) & WRI Index

AI-EcoTrack generates immutable, verifiable Digital Product Passports conforming to **EU ESPR 2024** and **India E-Waste Management Rules 2022**.

### Weighted Recyclability Index (WRI)
The circularity index quantifies how much of the component can be recycled into high-value streams:

$$\text{WRI} = \frac{\sum_{i=1}^{n} (m_i \times S_i)}{M_{\text{total}}}$$

*Where $m_i$ is the mass of sub-component $i$, $M_{\text{total}}$ is total mass, and $S_i$ is the recyclability class weight (Grade A = $1.0$, Grade B = $0.6$, Grade C = $0.2$, Contaminated = $0.0$).*

### DPP Features
- **Bill of Materials (BOM):** Granular breakdown of each subcomponent, alloy designation, weight fraction, and standard (e.g. ASTM A216 WCB).
- **Life-Cycle Audit Trail:** Tamper-evident log of timestamps, scan locations, technician IDs, and maintenance history.
- **QR Code & Passport Viewer:** Each passport generates a unique QR code allowing downstream smelters and remanufacturers to inspect provenance instantly.
- **Export Formats:** One-click generation of official JSON schemas and printable audit PDFs.

---

## 🏆 Worker Gamification & Incentive Engine

To prevent scrap contamination and incentivize sorting of high-value alloys, AI-EcoTrack includes a **purity-linked worker compensation engine**:

### Daily Incentive Formula

$$\text{DI} = \sum_{j=1}^{k} \Big[ (m_j \times P_{\text{LME}} \times \mu_{\text{purity}}) \times C_{\text{shift}} \Big]$$

- $m_j$ = Mass of sorted bin (kg) verified by IoT load cell.
- $P_{\text{LME}}$ = Live commodity spot price ($/kg or ₹/kg).
- $\mu_{\text{purity}}$ = Grade multiplier (**Grade A: 3.0×** | **Grade B: 1.8×** | **Grade C: 0.5×** | **Reject: -2.0× penalty**).
- $C_{\text{shift}}$ = Shift bonus coefficient ($1.25\times$ for zero rejects, $1.50\times$ for 95%+ Grade A weekly consistency).

### Anti-Gaming Mechanisms
1. **Mass Cross-Checking:** IoT load cell readings are validated against DPP predicted mass ($\pm 15\%$ tolerance) to prevent adding dead weight.
2. **RFID / Token Lock:** Bins are cryptographically paired to technician IDs at scan time.
3. **Inline Hazmat Interlock:** Detection of volatile gases or mixed density locks the bin and triggers an audit.

---

## 📡 Hardware & IoT Smart Bins

The IoT subsystem monitors physical scrap storage bins in factories and workshops in real time.

```mermaid
graph LR
    subgraph Sensors["Sensor Array"]
        S1["MQ-135 Gas Sensor"]
        S2["HC-SR04 Ultrasonic Sensor"]
        S3["DHT11 / DHT22 Sensor"]
        S4["IR Beam Sensor"]
    end

    subgraph Edge["Microcontrollers"]
        A["Arduino UNO Node"]
        B["ESP32 WiFi Gateway"]
    end

    subgraph Actuators["Local Feedback"]
        D1["SSD1306 / I2C LCD Display"]
        D2["Piezo Buzzer Alarm"]
        D3["Micro Servo / Sorting Gate"]
    end

    S1 & S2 & S3 & S4 --> A
    A -- "UART Serial (9600 baud)" --> B
    A --> D1 & D2 & D3
    B -- "HTTPS POST (WiFi JSON)" --> Cloud["AI-EcoTrack Cloud API /api/sensor-data"]
```

### Hardware Pinout & Wiring

| Sensor / Module | Arduino / ESP32 Pin | Function |
|---|---|---|
| **MQ-135 Gas Sensor** | `A0` (Analog) | Detects Ammonia, Benzene, Alcohol, Smoke, CO₂ PPM |
| **HC-SR04 Ultrasonic** | `Trig: D9`, `Echo: D10` | Measures distance to scrap surface (computes Fill %) |
| **DHT11 / DHT22** | `D2` (Digital) | Ambient temperature (°C) & relative humidity (%) |
| **IR Proximity Sensor** | `D7` (Digital) | Detects item drop into bin chute |
| **I2C OLED (SSD1306)** | `SDA: A4 (ESP32: 21)`, `SCL: A5 (ESP32: 22)` | Local visual feedback of PPM, fill level, and IP status |
| **Piezo Buzzer & Servo** | `D8` (Buzzer), `D6` (PWM Servo) | Acoustic alarms on hazard (>400 PPM) & auto-divert chute |

*For complete flashing steps and schematics, refer to [hardware/README.md](hardware/README.md).*

---

## 🍓 Raspberry Pi Headless Scanner Station

For hands-free industrial scanning, AI-EcoTrack includes an autonomous Raspberry Pi station package (`pi/`):

- **Auto-Triggering:** Monitors an **HX711 load cell** (or GPIO fallback) with debounce calibration.
- **Multi-Angle Capture:** Guides the operator through 3 sequential angle captures with live Picamera2 / OpenCV USB webcam streaming.
- **Local Console:** Serves a responsive operator UI at `http://<deviceId>.local:8080`.
- **Zero-Touch Provisioning:** Seamless 4-stage claim lifecycle identical to ESP32 devices (Bootstrap $\rightarrow$ Claim Nonce $\rightarrow$ Cryptographic Verification $\rightarrow$ Active Token).

*For setup and `systemd` deployment, see [pi/README.md](pi/README.md).*

---

## 🗺️ Fleet Route Optimization & Drop-Off Locator

AI-EcoTrack incorporates logistical intelligence to minimize collection costs and carbon footprints:

### 1. Smart Collection Route Optimization (TSP)
- **Threshold-Driven:** Filters only smart bins marked `Collection Ready` (Fill Level $\ge 80\%$ or critical gas hazard).
- **Greedy Nearest-Neighbor Algorithm:** Calculates the most efficient path starting from the driver's current GPS location.
- **Impact Metrics:** Computes baseline random route distance vs. optimized route distance, estimating **fuel saved** and **$\text{kg CO}_2$ emissions averted**.

### 2. OSM / Overpass Drop-Off Finder
- Uses OpenStreetMap's **Overpass API** to query verified recycling centers, scrap yards, battery collection banks, and e-waste depots within a custom radius.
- Visualized on an interactive **Leaflet map** with driving directions and opening hours.

---

## 💻 Cross-Platform Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI-EcoTrack Ecosystem                         │
├─────────────────┬─────────────────┬───────────────────┬─────────────────┤
│    Web PWA      │  Desktop App    │    Mobile App     │  Edge Station   │
│  (Next.js 16)   │ (Tauri 2 + Rust)│  (React Native)   │ (Raspberry Pi 4)│
├─────────────────┼─────────────────┼───────────────────┼─────────────────┤
│ • Full Portal   │ • Native Win/Mac│ • On-site Tech    │ • Hands-free    │
│ • Real-time DB  │ • Secure Auth   │ • Offline Queue   │ • Load Cell     │
│ • Admin Tools   │ • High Perf     │ • Camera Handoff  │ • MJPEG Stream  │
└─────────────────┴─────────────────┴───────────────────┴─────────────────┘
```

---

## 📂 Project Directory Structure

```
aiecotracker/
├── app/                          # Next.js 16 App Router
│   ├── api/                      # 18 Serverless API Routes
│   │   ├── identify-part/        # Single-angle VLM scan
│   │   ├── identify-part-multiview/ # 3-angle merged VLM scan
│   │   ├── generate-dpp/         # Digital Product Passport generation
│   │   ├── retrieve-guide/       # RAG disassembly guide engine
│   │   ├── sensor-data/          # IoT ESP32/Arduino sensor ingestion
│   │   ├── pi-scan/              # Raspberry Pi automated station ingest
│   │   ├── devices/              # Cryptographic device provisioning & claim
│   │   ├── chat-assistant/       # Multimodal context assistant
│   │   ├── tts/ & stt/           # Audio text-to-speech & speech-to-text
│   │   ├── overpass/             # OSM recycling drop-off query proxy
│   │   ├── org/ & superadmin/    # Multi-tenant and platform admin APIs
│   │   └── platform-stats/       # Aggregate circularity impact statistics
│   ├── scan/                     # Camera & file upload scanner interface
│   ├── passport/ & dpp/          # Digital Product Passport & QR viewer
│   ├── guide/                    # Step-by-step disassembly guide viewer
│   ├── iot-monitor/              # Real-time IoT sensor telemetry & bin map
│   ├── drop-off/                 # Leaflet/OSM nearby recycling drop-off map
│   ├── org/                      # Enterprise organization & fleet route planner
│   ├── dashboard/ & impact/      # Environmental impact & ROI analytics
│   ├── badges/                   # Gamified worker badges & leaderboard
│   ├── auth/ & join/             # Authentication & multi-tenant invite join
│   └── superadmin/               # Global factory inventory & tenant manager
│
├── components/                   # Reusable React 19 UI Components
│   ├── AppShell.tsx              # Application layout & navigation wrapper
│   ├── BottomNav.tsx             # Mobile bottom navigation bar
│   ├── SidebarNav.tsx            # Desktop collateral sidebar
│   ├── ContextualAssistant.tsx   # AI Copilot voice & text helper
│   ├── HazardBadge.tsx           # Safety hazard alert indicators
│   ├── ConfidenceBar.tsx         # Visual AI confidence score meter
│   ├── LanguageProvider.tsx      # English / Hindi (हिन्दी) localization
│   └── org/                      # RoutesPanel, LeaderboardPanel, ImpactPanel
│
├── lib/                          # Core Business Logic & Services
│   ├── groqClient.ts             # Groq 3-key rotation & rate limiter
│   ├── safetyGatekeeper.ts       # Deterministic OSHA/ATEX hazard engine
│   ├── knowledgeBase.ts          # Local RAG knowledge vector store
│   ├── mergeVLMResults.ts        # Multi-view 3-angle fusion algorithm
│   ├── routeOptimization.ts      # Nearest-neighbor TSP fleet route solver
│   ├── deviceRegistry.ts         # Hardware bootstrap & claim state machine
│   ├── wifiCrypto.ts             # Cryptographic token generator for IoT
│   ├── incentiveService.ts       # Worker purity bonus calculation
│   ├── exportService.ts          # PDF/JSON/CSV passport exporter
│   ├── ttsService.ts             # Google Cloud & Web Speech TTS synthesizer
│   ├── i18n.ts                   # English & Hindi translation dictionary
│   └── offlineQueue.ts           # IndexedDB offline scan synchronization
│
├── data/knowledge/               # Domain Knowledge Base for RAG
│   ├── disassembly_guides.json   # Step-by-step OEM disassembly procedures
│   ├── material_data_sheets.json # NIST/MatWeb alloy & polymer specifications
│   ├── safety_regulations.json   # OSHA 1910.147, REACH, RoHS, ATEX rules
│   ├── scrap_pricing_india.json  # Live Indian market scrap prices (₹/kg)
│   ├── regulatory_compliance.json# EU ESPR & India E-Waste 2022 rules
│   └── part_class_aliases.json   # Cross-industry part name mapping
│
├── hardware/                     # Embedded IoT Firmware
│   ├── arduino_main/             # Arduino UNO sensor sampling sketch
│   ├── esp32_gateway/            # ESP32 WiFi HTTPS ingestion gateway
│   ├── esp32_gateway_WITH_PROVISIONING/ # Captive portal provisioner
│   └── README.md                 # Hardware assembly & pinout guide
│
├── pi/                           # Raspberry Pi Automated Station Package
│   ├── app.py                    # Local web server & operator UI (port 8080)
│   ├── camera.py                 # OpenCV / Picamera2 capture engine
│   ├── pressure.py               # HX711 load cell / GPIO pressure trigger
│   ├── bootstrap.py              # Hardware bootstrap & claim handler
│   ├── station.py                # Station state machine
│   └── README.md                 # Raspberry Pi setup & systemd service guide
│
├── mobile/                       # React Native / Expo Mobile Application
│   ├── App.tsx                   # Mobile entry point
│   ├── src/screens/              # Scan, Passport, Guide, IoT screens
│   └── app.json                  # Expo 52 configuration
│
├── src-tauri/                    # Tauri v2 Desktop Application (Rust)
│   ├── src/                      # Rust desktop lifecycle & window management
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Native window & capability definitions
│
└── testing_photos_ecotracker/    # Verified Sample Test Images
    ├── rust_valve.png            # Corroded Gate Valve (Testing OSHA protocols)
    ├── test_stainless_heat_exchanger_*.png # 316L SS Heat Exchanger
    ├── test_battery_ewaste_*.png # Lithium/Lead Acid E-Waste
    └── Rotary-Gear-Pump.jpg.webp # Hydraulic Rotary Pump
```

---

## 🚀 Getting Started & Installation

### Prerequisites
- **Node.js:** `v18.18.0` or higher (Node 20+ recommended)
- **Package Manager:** `npm` or `pnpm`
- **Rust Toolchain:** (Optional, only needed for compiling Tauri desktop app) `cargo --version`
- **Python 3.9+:** (Optional, only needed for Raspberry Pi station)
- **Arduino IDE:** (Optional, only needed for flashing hardware)

---

### 1. Web Application Setup

```bash
# Clone the repository
git clone https://github.com/your-username/aiecotracker.git
cd aiecotracker

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# (Edit .env.local with your Groq, Gemini, and Firebase credentials)

# Start the local development server
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

### 2. Desktop Application (Tauri v2)

```bash
# Run in desktop development mode (launches native window)
npm run tauri:dev

# Build native production executable (macOS .dmg / Windows .msi / Linux .deb)
npm run build:desktop
npm run tauri:build
```

---

### 3. Mobile Application (Expo)

```bash
cd mobile
npm install
npx expo start
```

Scan the displayed QR code using the **Expo Go** app on iOS or Android.

---

### 4. Raspberry Pi Station Setup

```bash
cd pi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the local console server
python3 app.py
```

Access the operator console at **`http://<pi-ip-or-device-id>.local:8080`**.

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the root directory:

```env
# =================================================================
# AI Ingestion Keys (High Availability)
# =================================================================
GROQ_API_KEY_1=gsk_your_primary_groq_key
GROQ_API_KEY_2=gsk_your_secondary_groq_key
GROQ_API_KEY_3=gsk_your_tertiary_groq_key
GEMINI_API_KEY=AIzaSy_your_google_gemini_key

# =================================================================
# Firebase Client SDK Configuration
# =================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# =================================================================
# Firebase Admin SDK (Server-Side Operations)
# =================================================================
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# =================================================================
# Optional: Google Cloud Text-To-Speech & OAuth
# =================================================================
GOOGLE_TTS_API_KEY=your_google_cloud_tts_api_key
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
```

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/identify-part` | `POST` | Single-angle VLM image classification, hazard check, and material inference. |
| `/api/identify-part-multiview` | `POST` | Multi-view (up to 3 images) merged visual analysis with cross-angle consensus. |
| `/api/generate-dpp` | `POST` | Generates a compliant Digital Product Passport (EU ESPR / India EPR) with WRI. |
| `/api/get-passport` | `GET` | Fetches a public passport record by its unique `passportId` or `scanId`. |
| `/api/retrieve-guide` | `POST` | RAG retrieval of step-by-step disassembly sequence with safety protocols. |
| `/api/sensor-data` | `POST` | Ingests real-time IoT sensor telemetry (Gas PPM, Fill Level %, Temp/Humidity). |
| `/api/sensor-readings` | `GET` | Retrieves historical time-series sensor telemetry for a specific bin device. |
| `/api/pi-scan` | `POST` | Ingests automated 3-angle captures triggered by Raspberry Pi hardware. |
| `/api/devices/bootstrap-status` | `GET` | Hardware polling endpoint during initial commissioning. |
| `/api/devices/claim-verify` | `POST` | Verifies cryptographic ownership nonce during device onboarding. |
| `/api/devices/bootstrap-finalize` | `POST` | Issues permanent runtime auth token to claimed hardware. |
| `/api/overpass` | `POST` | Proxies queries to OpenStreetMap to locate nearby recycling/e-waste facilities. |
| `/api/chat-assistant` | `POST` | Context-aware AI copilot for operational and disassembly queries. |
| `/api/tts` & `/api/stt` | `POST` | Audio synthesis (Google TTS / ElevenLabs) and voice speech-to-text. |
| `/api/platform-stats` | `GET` | Aggregated circular economy impact figures (CO₂ averted, landfill diverted). |

---

## ⚖️ Regulatory Standards & Compliance

AI-EcoTrack is engineered to comply with major international and domestic circularity standards:

- **EU ESPR 2024 (Ecodesign for Sustainable Products Regulation):** Mandates Digital Product Passports for materials, durability, and recovery paths.
- **India E-Waste (Management) Rules, 2022:** Extended Producer Responsibility (EPR) targets and tracking of recycling credits.
- **OSHA 1910.147 (Control of Hazardous Energy):** Lockout/Tagout requirements for de-energizing mechanical and pressurized systems.
- **RoHS Directive 2011/65/EU:** Restriction of Hazardous Substances (Lead, Mercury, Cadmium, Hexavalent Chromium).
- **REACH Annex XVII:** Regulation on chemicals and hazardous substance disclosures.
- **ATEX Directive 2014/34/EU:** Equipment safety in potentially explosive atmospheres (hydrocarbon residues).
- **ISO 14067 & ISO 14224:** Carbon footprint of products and equipment reliability/maintenance data collection.

---

## 🧪 Testing with Sample Photos

The repository includes a curated set of industrial test images in [`testing_photos_ecotracker/`](testing_photos_ecotracker/):

| Test Image | Component Type | Hazard / Challenge Tested |
|---|---|---|
| `rust_valve.png` | Flanged Gate Valve | Heavy surface corrosion, pressurized fluid, OSHA lockout rules |
| `test_stainless_heat_exchanger_*.png` | Plate Heat Exchanger | 316L stainless alloy inference, gasket identification |
| `test_battery_ewaste_*.png` | Industrial Battery / Inverter | Heavy metal hazards (Lead/Lithium), chemical containment |
| `Rotary-Gear-Pump.jpg.webp` | Hydraulic Rotary Pump | Mechanical assembly sequence, oil residue detection |

---

## 👥 Contributors

Built with ❤️ by **Team MakersLab**:
- **Saumitra Matta**
- **Satyam Anand**
- **Siddharth Singh**
- **Lohitaksh Sinha**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>AI-EcoTrack — Empowering the Global Circular Economy through Artificial Intelligence & IoT.</sub>
</div>
