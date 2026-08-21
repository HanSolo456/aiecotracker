# AI-EcoTrack: Presentation Content
> Structured content for Hackathon PowerPoint Presentation  
> Derived directly from the project codebase, architecture, and technical reports.  
> Team: **Team MakersLab** (Saumitra Matta · Satyam Anand · Siddharth Singh)

---

## SLIDE 1 — Title Slide

**Project Name:** AI-EcoTrack  
**Tagline:** AI-Driven Circular Waste Intelligence System  
**Sub-tagline:** Identify → Safeguard → Passport  
**Team:** Team MakersLab — Saumitra Matta · Satyam Anand · Siddharth Singh  
**Event:** Hackathon 2025  

**Visual Suggestion:** Dark-mode hero with a glowing circuit-board / recycling loop graphic. Show icons for: Camera → AI Brain → Safety Shield → Passport → IoT Bin → Route Map.

---

## SLIDE 2 — The Problem Statement

**Title:** The $62 Billion Problem Nobody Talks About

**Four core pain points (use icon cards):**

1. **Zero-Label Identification Challenge**  
   Industrial waste (e-waste, mechanical parts, valves, PCBs) becomes impossible to classify once decommissioned. Barcodes degrade, labels peel off, and part numbers are corroded. Workers are left guessing.

2. **Hidden Safety Hazards (The Silent Killer)**  
   Disassembling an unknown part exposes workers to asbestos, lead solder (RoHS violation), pressurized components (requiring Lockout/Tagout per OSHA 1910.147), and hydrocarbon residues (ATEX explosive atmosphere risk).

3. **Lost Recovery Value**  
   Mixing 316L Stainless Steel (₹142/kg) with Carbon Steel (₹25/kg) wipes out 83% of scrap value overnight. Inaccurate sorting costs India's recycling industry billions annually.

4. **Inefficient Collection & Zero Traceability**  
   General waste bins have no real-time monitoring. Collection fleets run fixed routes regardless of fill levels, wasting fuel and emitting unnecessary CO₂. Regulators have no audit trail.

**Bottom stat line:** India generates 3.2 million tonnes of e-waste/year — ranked 3rd globally. Only 22% is formally recycled.

---

## SLIDE 3 — Existing Solutions & Their Shortcomings

**Title:** Why Everything Else Fails

| Method | What It Does | The Fatal Gap |
|--------|-------------|---------------|
| **Manual Sorting** | Human workers sort by sight/feel | Slow, error-prone, directly hazardous to workers |
| **Barcode / RFID Scanning** | Reads embedded tags | Fails completely on degraded, old, or decommissioned parts |
| **Lab Testing (XRF Sensors)** | Extremely accurate elemental analysis | Costs ₹8,000–₹15,000 per test; impossible to scale |
| **Standard AI Vision Apps** | Identifies the item name | No material-grade inference, no safety protocols, no DPP, no compliance |
| **Basic IoT Sensors** | Measures fill levels in isolation | No AI integration, no route intelligence, no fleet optimization |

**Key insight (callout box):**  
> "Existing AI tools tell you *what* something is. They don't tell you *what it's worth*, *how to safely disassemble it*, or *what regulations apply to it*. That's the gap AI-EcoTrack fills."

---

## SLIDE 4 — Our Solution: AI-EcoTrack

**Title:** One Platform. End-to-End Circular Intelligence.

**Four pillars (large icon tiles):**

### 🔍 Zero-Label AI Identification
Point any camera (smartphone or Raspberry Pi station) at any waste item — valve, motor, PCB, battery, plastic bottle — and AI-EcoTrack identifies:
- **Part class and subtype** (e.g., `centrifugal_pump`, `pcb`, `lithium_battery`)
- **Material grade** (e.g., `316L Stainless Steel`, `Ti-6Al-4V Titanium`, `Inconel 625`)
- **Waste category** (`biodegradable` / `recyclable` / `recyclable_ewaste` / `hazardous` / `industrial_component`)
- **India scrap value in ₹** (live Mumbai MIDC pricing database)

### 🛡️ Mandatory Safety Gatekeeper
A deterministic rule engine (NOT an LLM) sits between the AI output and the user. It enforces non-negotiables:
- Flags pressurized components → injects OSHA 1910.147 Lockout/Tagout protocol
- Flags lead solder → injects REACH Annex XVII + RoHS 2011/65/EU compliance
- Flags hydrocarbon residue → injects ATEX Directive 2014/34/EU + NFPA 30
- Flags asbestos-era parts → triggers mandatory asbestos survey (EPA NESHAP / OSHA 1926.1101)
- **If AI confidence < 0.92 → escalates to human review. Never guesses.**

### 📋 Auto-Generated Digital Product Passport (DPP)
Every scan generates a permanent, compliant DPP containing:
- Full Bill of Materials (BOM) with recyclability grades (A/B/C)
- Weighted Recyclability Index (WRI) score
- Compliance profile: RoHS3, REACH, WEEE, EU ESPR 2024, BIS India standards
- Estimated recovery value in ₹ (from India scrap price database)
- Permanent record in Firebase Firestore

### 📡 Smart Bin IoT + Fleet Route Optimization
- ESP32 bins report fill level, gas (MQ-135 & MQ-7), temperature, humidity, and IR item detection in real-time
- When bins hit 80% fill threshold → automatically flagged for collection
- Greedy nearest-neighbor route algorithm generates optimized fleet collection routes
- Tracks CO₂ saved vs. unoptimized routes (0.21 kg CO₂/km baseline)

---

## SLIDE 5 — How It Works (System Architecture)

**Title:** The Full Intelligence Loop

### Step-by-Step Flow:

```
[Waste Item]
     │
     ▼
[Multi-View Camera Capture]  ←  Raspberry Pi edge station or mobile device (1–3 angles)
     │
     ▼
[Groq API → Qwen 3.6 27B VLM]  ←  Primary AI (with 3-key rotation for 0 downtime)
     │    ↕ if rate-limited or fails
     │  [Google Gemini 1.5 Flash]  ←  Automatic seamless fallback
     │
     ▼
[Multi-View Merge Engine]  ←  mergeVLMResults() combines all angles into one high-confidence payload
     │
     ▼
[Safety Gatekeeper]  ←  Deterministic Rule Engine (4 rules: OSHA, REACH, ATEX, EPA)
     │
     ├── Confidence < 0.92 → ESCALATE TO HUMAN (never guesses on safety)
     │
     ▼
[RAG Query Layer]  ←  6 Local Knowledge Bases:
                         • disassembly_guides.json
                         • material_data_sheets.json
                         • safety_regulations.json
                         • scrap_pricing_india.json (Mumbai MIDC rates)
                         • regulatory_compliance.json
                         • part_class_aliases.json
     │
     ▼
[Results Delivered to User]
     ├── Citizen guidance (which bin, what to do next)
     ├── Step-by-step disassembly guide (OSHA/NIST sourced)
     ├── Scrap value in ₹
     └── Digital Product Passport (DPP)
     │
     ▼
[Waste enters IoT Smart Bin]  ←  ESP32 sensors: fill%, gas_ppm, temp, humidity, IR trigger
     │
     ▼
[Collection Fleet Optimization]  ←  80% fill threshold triggers route planning
                                Haversine distance + nearest-neighbor algorithm
                                CO₂ savings computed vs. unoptimized baseline
     ▼
[Firebase Firestore]  ←  Permanent record: DPP, scan history, sensor readings, route plans
```

---

## SLIDE 6 — The AI Engine: Brains of the System

**Title:** Industrial-Grade AI, Built for Reliability

### Model Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| **Primary VLM** | Qwen 3.6 27B (`qwen/qwen3.6-27b`) via Groq | Vision inference |
| **Primary LLM** | GPT OSS 120B (`openai/gpt-oss-120b`) via Groq | Text inference & Chat |
| **Speech-to-Text** | Whisper Large v3 (`whisper-large-v3`) via Groq | Multilingual voice transcription |
| **Fallback VLM** | Google Gemini 1.5 Flash | Automatic failover |
| **Key Rotation** | Up to 10 Groq API keys (GROQ_API_KEY_1 … GROQ_API_KEY_10) | Zero-downtime, auto-rotates on 429/401 |
| **Multi-View Merge** | Custom `mergeVLMResults()` algorithm | Highest-confidence multi-angle consensus |
| **Safety Override** | Deterministic rule engine (4 rules) | 99% safety protocol accuracy |
| **RAG Layer** | 6 local JSON knowledge bases | Zero-latency offline reasoning |

### What the AI Classifies

**30+ item classes across 4 major categories:**
- **E-waste & Electronics:** PCB, battery, cable/wire, display screen, power supply, semiconductor, mobile device, peripherals
- **Industrial Components:** Valves, pumps, motors, heat exchangers, pressure vessels, compressors, circuit breakers, transformers
- **General Waste:** Plastic (PET, HDPE), metal scrap, glass, paper/cardboard, organic/biodegradable, hazardous chemicals, mixed waste
- **Specialty Materials:** Inconel 625, Ti-6Al-4V Titanium, Lithium Cobalt Oxide, Silicon Carbide

### Confidence Scoring
- **≥ 0.92** → Automated result with full DPP generation
- **< 0.92** → Mandatory human escalation (system will not guess on safety-critical items)

---

## SLIDE 7 — Safety Gatekeeper (The Critical Differentiator)

**Title:** When AI Must Not Guess

**Key message:** Our Safety Gatekeeper is NOT an LLM — it's a hard-wired deterministic rule engine that the AI cannot override.

### The 4 Non-Negotiable Safety Rules

| Rule ID | Trigger | Injected Protocol |
|---------|---------|------------------|
| **RULE_001** | Pressurized component detected | OSHA 1910.147 — Lockout/Tagout + ISO 4126 Pressure Relief |
| **RULE_002** | Lead solder likelihood | REACH Annex XVII + RoHS Directive 2011/65/EU |
| **RULE_003** | Hydrocarbon residual fluid | ATEX Directive 2014/34/EU + NFPA 30 Flammable Liquids |
| **RULE_004** | Asbestos-era component | EPA NESHAP Asbestos + OSHA 1926.1101 |

### Escalation Logic
```
IF any hazard flag is triggered → inject mandatory safety docs
IF confidence < 0.92           → escalate to human, block auto-processing
IF both conditions              → escalate AND inject safety protocols
```

**"The system protects the worker even when the AI is uncertain."**

---

## SLIDE 8 — Digital Product Passport (DPP)

**Title:** Permanent Traceability for the Circular Economy

### What Goes Into Every DPP

- **Identity:** Part class, subtype, material grade (e.g., `316L Stainless Steel`, `Inconel 625`)
- **Bill of Materials (BOM):** Component-by-component breakdown with mass fractions and recyclability grade (A/B/C)
- **Material Recovery Value:** Live Mumbai MIDC scrap prices per kg, e.g.:
  - Copper Alloy C110 → ₹880/kg (Grade A)
  - 316L Stainless Steel → ₹142/kg (Grade A)
  - Ti-6Al-4V Titanium → ₹3,150/kg (Grade A)
  - Carbon Steel → ₹25/kg (Grade B)
  - PTFE Seat Ring → ₹8/kg (Grade C)
- **Weighted Recyclability Index (WRI):** Custom scoring algorithm for circular economy reporting
- **Compliance Profile:**
  - RoHS3 status
  - REACH (SVHC substance count, action required)
  - WEEE / India E-Waste Rules 2022
  - EU ESPR 2024 (recyclability class + end-of-life route)
  - BIS India standards
- **Permanent ID:** UUID-based passport identifier stored in Firebase Firestore

### Standards Referenced
> EU ESPR 2024 · India E-Waste Management Rules 2022 · OSHA 1910.147 · RoHS Directive 2011/65/EU · REACH Annex XVII · WEEE Directive · ISO 4126 · ATEX 2014/34/EU

---

## SLIDE 9 — IoT Smart Bin Network

**Title:** Real-Time Waste Intelligence at the Source

### Hardware Stack

| Component | Sensor | Measurement |
|----------|--------|-------------|
| **Arduino UNO** | HC-SR04 Ultrasonic | Fill level (0–100%) |
| **Arduino UNO** | MQ-135 Gas Sensor | Air quality / VOC (PPM) |
| **Arduino UNO** | MQ-7 CO Sensor | Carbon Monoxide (PPM) |
| **Arduino UNO** | DHT11/22 | Temperature (°C) + Humidity (%) |
| **Arduino UNO** | IR Sensor | Item drop detection (ON/OFF) |
| **ESP32 Gateway** | WiFi + Device Auth | Secure cloud data relay |

### Data Flow
```
Sensors → Arduino UNO → ESP32 → /api/sensor-data → Firestore → Live Dashboard
                            ↑
                   x-device-token auth  (device verified against org registry)
```

### IoT Monitor Dashboard Features
- **Live sensor cards:** Fill %, Air Quality (PPM), Temperature, Humidity, IR state
- **Sparkline trend charts:** 20-reading rolling history per sensor
- **Multi-bin support:** Tab-selector when 2+ bins connected — each bin's data scoped independently
- **Collection readiness map:** Geographic SVG plot of all bins with fill-level color coding
- **Bin health events:** "Awaiting Deposit", "Item Detected", "Gas Alert" timeline
- **Status indicators:** Online/Offline per device with last-seen timestamp

### Collection Threshold
> Bins at **≥ 80% fill** are automatically flagged as "ready for collection" and included in the next optimized route plan.

---

## SLIDE 10 — Fleet Route Optimization

**Title:** Smarter Routes. Less Fuel. Less CO₂.

### The Problem with Fixed Routes
Traditional waste collection runs fixed routes regardless of bin state — collecting half-empty bins and missing full ones. This wastes fuel, time, and money.

### Our Solution: Greedy Nearest-Neighbor Algorithm

```
Input:  All bins with fill ≥ 80% + GPS coordinates
        Optional: Driver live GPS start point (browser geolocation)

Algorithm:
  1. Start from driver location (or fullest bin if no GPS)
  2. At each step: pick the nearest unvisited collection-ready bin
  3. Compute Haversine distance between each stop
  4. Build ordered stop list with estimated leg distances

Output:
  • Ordered stop sequence (Stop 1 → Stop 2 → … Stop N)
  • Total optimized distance (km)
  • Baseline distance (urgency-sorted, unoptimized)
  • Distance saved (km)
  • CO₂ saved (kg) [at 0.21 kg CO₂/km for a collection van]
  • Estimated duration (at 24 km/h avg speed + 4 min service time/stop)
  • One-click "Open in Google Maps" with all waypoints
```

### Impact Numbers (Example)
- 5 bins, avg 3 km apart → optimized route saves **~2.1 km** vs. urgency-sorted order
- CO₂ saved: **~0.44 kg per run** × daily runs = significant fleet-level reduction

---

## SLIDE 11 — Citizen Waste Guidance & Incentive Model

**Title:** Closing the Loop — From Scan to Action to Reward

### Citizen-Facing Guidance (Every Scan Result Shows)
After any scan, users see:
- **Top-level category:** Biodegradable / Recyclable / Hazardous / Industrial
- **Which bin to use** (color-coded guidance)
- **Step-by-step disposal instructions**
- **What NOT to do** (caution list)
- **Drop-off action** for relevant waste types

### Incentive Model for Workers
The platform has a built-in **purity-linked compensation system:**

- Workers earn points for each verified, accurately sorted waste item
- Higher purity sorting (preventing contamination of Grade-A materials) = higher point multiplier
- Points convert to cash bonuses
- **Projected impact:** Accurately sorting high-value scrap (e.g., preventing 316L SS contamination) generates an estimated **₹12,500–₹25,000/month bonus** per worker

### Leaderboard & Rewards
- Organization-level leaderboard ranks workers by contribution
- Public "How rewards work" page explains earning tiers
- Redemption flow for points-to-cash conversion

---

## SLIDE 12 — The Tech Stack

**Title:** Built to Scale. Built to Last.

### Full Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 16 (PWA) · TypeScript · Tailwind CSS                   │
│  Web App + Desktop (Tauri) + Mobile (React Native / Expo)        │
└───────────────────┬─────────────────────────────────────────────┘
                    │ HTTP / Firestore real-time
┌───────────────────▼─────────────────────────────────────────────┐
│                      BACKEND API (25+ routes)                    │
│  Next.js API Routes · Firebase Admin SDK                         │
│  /api/identify-part-multiview  /api/generate-dpp                 │
│  /api/sensor-data  /api/sensor-readings  /api/org/impact         │
│  /api/devices/bootstrap-status  /api/devices/claim-verify        │
│  /api/retrieve-guide  /api/chat-assistant  /api/tts  /api/stt    │
└───┬──────────────┬──────────────┬────────────────────┬──────────┘
    │              │              │                    │
    ▼              ▼              ▼                    ▼
 [Groq API]   [Gemini API]  [Firestore]        [RAG Layer]
 Qwen 3.6 /   Gemini 1.5    Real-time DB       6 JSON KBs
 GPT OSS 120B Flash         Auth + Storage     (offline, fast)
```

### Tech Choices

| Layer | Tech | Why |
|-------|------|-----|
| **AI Vision** | Qwen 3.6 27B (`qwen/qwen3.6-27b` via Groq) | State-of-art VLM, ultra-fast 500 T/s visual inference |
| **AI Text / LLM** | GPT OSS 120B (`openai/gpt-oss-120b` via Groq) | 500 T/s high-reasoning LLM, 131k context window |
| **Voice STT** | Whisper Large v3 (`whisper-large-v3` via Groq) | Low-latency multilingual speech-to-text |
| **AI Fallback** | Gemini 1.5 Flash | Automatic, zero-config failover |
| **Key Rotation** | Up to 10 GROQ keys | Zero downtime even at rate limits |
| **Frontend** | Next.js 16 + TypeScript | SSR + PWA + type safety |
| **DB** | Firebase Firestore | Real-time sync, offline support |
| **Auth** | Firebase Anonymous + Google | Frictionless, secure |
| **IoT** | Arduino UNO + ESP32 + Raspberry Pi | Low-cost, production-proven |
| **KV Store / RAG** | Local JSON (6 files) | Sub-1ms retrieval, no API cost |
| **Voice** | TTS + STT APIs (`/api/tts`, `/api/stt`) | Accessibility + hands-free scanning |
| **Maps** | Leaflet.js + CartoDBDark tiles | Offline-compatible, open-source |

---

## SLIDE 13 — Multi-Platform Support

**Title:** Works Everywhere Workers Are

### Three Scanning Surfaces

| Surface | How It Works | Best For |
|---------|-------------|----------|
| **Web App (Primary)** | Camera on any smartphone/laptop browser — PWA installable | Individual workers, field use |
| **Raspberry Pi Station** | Headless scanner with external USB camera + pressure sensor (HX711 load cell), 3-angle capture protocol, served at `http://<deviceId>.local:8080` | Industrial floor, factory gates |
| **Desktop App (Tauri)** | Native desktop wrapper with deep system integration and Google OAuth | Admin / supervisor workstations |

### Raspberry Pi Station Flow
```
Operator enables station on phone/laptop
         ↓
Pi enters ARMED state — pressure sensor active
         ↓
Item placed on platform — pressure crosses threshold + stabilizes
         ↓
Pi captures Angle 1 → prompt rotate → Angle 2 → prompt rotate → Angle 3
         ↓
Pi sends 3 images to /api/pi-scan → AI analysis
         ↓
Result link pushed to operator device
         ↓
Station auto-disarms on completion (10-min inactivity timeout)
```

### Station State Machine
`OFF → ARMED_WAITING_FOR_ITEM → ITEM_DETECTED → CAPTURING_ANGLE_1 → CAPTURING_ANGLE_2 → CAPTURING_ANGLE_3 → ANALYSING → COMPLETE`

---

## SLIDE 14 — Organization Dashboard

**Title:** Command Center for Sustainability Managers

### What Org Admins See

**Key Performance Indicators (KPI Cards):**
- Total scans (org-wide)
- Total estimated mass recycled (kg)
- Total CO₂ impact (kg CO₂ diverted)
- Total recovery value (₹) from properly sorted material

**Scan Activity Charts:**
- Daily scans over time (area chart)
- Mass recycled per day (bar chart)
- Recovery value trend (line chart)
- CO₂ impact over time

**Worker Management:**
- Team member list with roles (admin/member)
- Search by name or email
- Invite new members

**IoT Device Management:**
- Claim and configure ESP32 smart bins
- Set device GPS location (one-click browser geolocation)
- Configure waste stream category per bin (Recyclable / Biodegradable / Hazardous)
- Org-wide WiFi provisioning for all devices
- Device health: Active / Claim-Pending / Inactive

**Route Planning:**
- View all bins on real-time map
- Generate optimized collection route
- Export to Google Maps with all waypoints

---

## SLIDE 15 — Impact & Why It Matters

**Title:** Measurable Impact Across Every Stakeholder

### For Workers & Technicians
- ✅ Mandatory safety protocols before any disassembly starts (zero ambiguity)
- ✅ Purity-linked incentive compensation (estimated ₹12,500–₹25,000/month bonus potential)
- ✅ Voice-guided scanning (TTS/STT) for hands-free or accessibility use

### For Organizations & Facilities
- ✅ Accurate scrap value extraction (prevents cross-contamination loss)
- ✅ Regulatory compliance automatic (RoHS, REACH, WEEE, EU ESPR 2024, BIS India)
- ✅ Fleet fuel savings via smart route optimization
- ✅ CO₂ reduction reporting (per scan, per route, org-wide totals)

### For Regulators & the Environment
- ✅ Every item gets a permanent DPP — full audit trail for EPR compliance
- ✅ WRI score enables circular economy reporting
- ✅ Real-time bin telemetry prevents overflow and illegal dumping

### CO₂ Impact Formula (Live in Dashboard)
```
CO₂ diverted = mass_kg × CO₂_factor[material]

Factors used (EPA/IPCC):
  • Aluminium:  9.16 kg CO₂/kg recycled
  • PCB/E-waste: 3.10–4.20 kg CO₂/kg recycled
  • Plastic:     2.53 kg CO₂/kg recycled
  • Metal:       1.46 kg CO₂/kg recycled
  • Glass:       0.31 kg CO₂/kg recycled
```

---

## SLIDE 16 — Future Scope

**Title:** Where We Go From Here

### Short-Term (3–6 months)
- **🛢️ Advanced Load-Cell Integration:** Cross-check AI weight estimation against live bin weight (HX711) to prevent gaming of the incentive system. Anti-fraud by design.
- **📱 Full Mobile Parity:** Complete React Native app with scan, DPP, and leaderboard at feature parity with web.
- **🗺️ Municipal Rollout:** Citizen-facing mobile app for localized waste drop-off guidance with community reward points.

### Medium-Term (6–18 months)
- **✈️ Aerospace MRO Adaptation:** Expand classification to aerospace-grade alloys (Ti-6Al-4V, Inconel 718 — already in the material lookup table) with FAA/EASA life-limit compliance tracking.
- **🔗 Blockchain DPP:** Anchor DPP hashes to a public ledger for tamper-proof circular economy reporting.
- **🤖 Predictive Bin Fill:** ML model to predict when bins will reach threshold based on historical fill patterns, enabling pre-emptive route scheduling.

### Long-Term Vision
- **Industry-wide platform:** Connect scrap buyers, recyclers, and facilities on a single marketplace where every item has a verified, AI-generated passport.
- **Carbon credit integration:** Convert WRI scores and CO₂ impact into verifiable carbon credits for organizations.

---

## SLIDE 17 — Live Demo Flow (For Judges)

**Title:** See It In Action

### 5-Minute Demo Script

1. **[0:00]** Open AI-EcoTrack dashboard — show org KPIs (scans, CO₂, ₹ recovery value)
2. **[0:45]** Go to Scan — photograph a PCB or valve — show real-time AI classification with material grade
3. **[1:30]** Show Safety Gatekeeper firing — hazard flag injecting OSHA protocol
4. **[2:00]** Open the auto-generated DPP — show BOM, WRI score, compliance profile, ₹ recovery value
5. **[2:45]** Switch to IoT Monitor — show live bin readings (fill %, gas, temp, humidity) from 2 connected ESP32s
6. **[3:30]** Go to Collection Routes — show map with bins plotted, click "Generate Route" — show optimized stops, distance saved, CO₂ saved
7. **[4:15]** Show Organization Dashboard — worker leaderboard, recovery value chart, scan history
8. **[4:45]** Wrap: "One scan. One passport. Zero guessing. Full circular economy traceability."

---

## SLIDE 18 — Team & Closing

**Title:** Team MakersLab

| Name | Role |
|------|------|
| **Saumitra Matta** | Full-stack, AI pipeline, IoT integration, Cloud |
| **Satyam Anand** | Hardware (Arduino + ESP32 + Raspberry Pi), Firmware |
| **Siddharth Singh** | AI/ML research, Knowledge base curation, Testing |

**Built with:**  
Groq · Google Gemini · Firebase · Next.js · Arduino · ESP32 · Raspberry Pi · Leaflet · TypeScript

**Closing line:**  
> *"AI-EcoTrack doesn't just classify waste — it creates a permanent, safe, and valuable record for every item that enters the circular economy."*

---

*Generated from live codebase analysis — March 2025*
