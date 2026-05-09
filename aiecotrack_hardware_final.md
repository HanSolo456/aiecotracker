# AI-EcoTrack — Final Hardware Specification
### Two-Product E-Waste Management Ecosystem
**Team: MakersLab** | IndiaInnovates 2026 | Delhi Govt Submission

---

## Product Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI-ECOTRACK ECOSYSTEM                            │
├───────────────────────┬─────────────────────┬───────────────────────┤
│   PRODUCT 1           │   PRODUCT 2A        │   PRODUCT 2B          │
│   AI-EcoSort          │   AI-EcoScan        │   AI-EcoScan          │
│   CONVEYOR            │   WORKER STATION    │   PUBLIC STATION      │
├───────────────────────┼─────────────────────┼───────────────────────┤
│ For: Processing       │ For: Facility       │ For: RWAs, Metro,     │
│ facilities            │ workers at DPCC     │ Malls, Schools        │
│ (Holambi Kalan)       │ centers / dhalaos   │ across Delhi wards    │
├───────────────────────┼─────────────────────┼───────────────────────┤
│ Fully automated —     │ Worker scans item → │ Citizen scans item →  │
│ belt scans + sorts    │ correct bin LED      │ drops in correct bin  │
│ automatically         │ lights up → worker  │ → earns reward points │
│                       │ drops item in bin   │ → bin alerts MCD      │
│                       │                     │ when full             │
├───────────────────────┼─────────────────────┼───────────────────────┤
│ ₹74,950 per unit      │ ₹53,450 per unit    │ ₹63,150 per unit      │
└───────────────────────┴─────────────────────┴───────────────────────┘
```

---

## The 6 Sorting Bins (All Products)

| Bin # | Colour | Category | Examples |
|-------|--------|----------|---------|
| 1 | 🔴 Red | Batteries | LiPo, Li-ion, NiMH, Lead Acid |
| 2 | 🟡 Yellow | PCBs & Electronics | Motherboards, chips, capacitors |
| 3 | 🔵 Blue | Ferrous Metal | Steel, iron components |
| 4 | 🟠 Orange | Non-Ferrous Metal | Copper, aluminium, brass |
| 5 | 🟢 Green | Wires & Cables | Insulated wires, connectors |
| 6 | ⛔ Black | Hazmat / Unknown | Lead solder, asbestos, unidentified |

---

---

## 🏭 PRODUCT 1 — AI-EcoSort Conveyor

**Deployment:** Holambi Kalan E-Waste Eco-Park / DPCC authorized processing facilities
**Used by:** Facility workers (loader role)
**Volume:** High — designed for continuous processing

### How It Works
```
Worker places item on belt entry point
              ↓
Item travels through camera tunnel (2 second exposure)
4 cameras capture simultaneously — top, front, left, right
              ↓
Raspberry Pi → Gemini 3.1 Flash → item identified
Weight recorded from load cell at tunnel entry
              ↓
DPP generated → saved to PostgreSQL → submitted to CPCB EPR portal
              ↓
Arduino told: "BIN:3"
              ↓
IR sensor at belt start → timer begins
Belt moves at fixed speed
              ↓
At correct time → Servo Gate 3 opens → item drops into Bin 3
IR sensor inside bin confirms drop → gate closes
              ↓
Green LED on station → ready for next item
```

### Full Bill of Materials

| # | Component | Specification | Qty | Unit Cost | Total |
|---|-----------|--------------|-----|-----------|-------|
| 1 | Raspberry Pi 5 | 8GB RAM | 1 | ₹8,500 | ₹8,500 |
| 2 | Arduino Mega 2560 | Belt + servo control | 1 | ₹700 | ₹700 |
| 3 | Anker USB 3.0 Powered Hub | 7-port, for 4 cameras | 1 | ₹1,500 | ₹1,500 |
| 4 | Arducam 16MP USB Camera | Sony IMX519, USB 3.0 | 4 | ₹3,500 | ₹14,000 |
| 5 | Diffused LED Strips | Cool white, inside tunnel | 4 | ₹300 | ₹1,200 |
| 6 | NEMA 23 Stepper Motor | Belt drive motor | 1 | ₹2,200 | ₹2,200 |
| 7 | TB6600 Stepper Driver | NEMA 23 compatible | 1 | ₹850 | ₹850 |
| 8 | Conveyor Belt Frame | Aluminium + rubber belt, 2.5m × 50cm, fabricated | 1 | ₹20,000 | ₹20,000 |
| 9 | MG996R Servo Motor | Bin gate actuator | 6 | ₹300 | ₹1,800 |
| 10 | 10kg Load Cell + HX711 | Weight measurement at tunnel entry | 1 | ₹900 | ₹900 |
| 11 | FC-51 IR Sensor | Item detection (belt start + bin confirm) | 4 | ₹150 | ₹600 |
| 12 | HC-SR04 Ultrasonic | Fill-level per output bin | 6 | ₹150 | ₹900 |
| 13 | SIM7600 4G HAT | Cloud connectivity | 1 | ₹2,800 | ₹2,800 |
| 14 | 7" HDMI Touchscreen | Operator interface | 1 | ₹3,500 | ₹3,500 |
| 15 | 24V 15A Industrial SMPS | Powers stepper + servos | 1 | ₹2,200 | ₹2,200 |
| 16 | 12V 7Ah LiFePO4 Battery + BMS | UPS power backup | 1 | ₹3,500 | ₹3,500 |
| 17 | IP54 Steel Control Enclosure | Houses Pi, Arduino electronics | 1 | ₹2,000 | ₹2,000 |
| 18 | Steel Output Bins × 6 | Colour-coded, labelled | 6 | ₹800 | ₹4,800 |
| 19 | 3D Printed Camera Tunnel Rig | Holds 4 cameras at fixed angles inside tunnel | 1 | ₹1,500 | ₹1,500 |
| 20 | Wires, terminals, cable management | — | — | — | ₹1,500 |
| | | | | **TOTAL** | **₹74,950** |

---

---

## 👷 PRODUCT 2A — AI-EcoScan Worker Station (with Bins)

**Deployment:** DPCC regional offices, MCD dhalaos, smaller collection centers
**Used by:** Trained facility workers
**Volume:** Medium — manual one-item-at-a-time workflow

### How It Works
```
Worker picks item from incoming e-waste pile
              ↓
Places item on scanning platform
              ↓
4 cameras fire simultaneously
AI identifies: category, material, hazard level, weight
              ↓
DPP generated → CPCB submitted → dashboard updated
              ↓
Correct bin LED strip LIGHTS UP (e.g. Bin 2 glows yellow)
Screen shows: "PCB — 180g — ⚠️ Contains Lead — Bin 2"
              ↓
Worker drops item into lit bin ✅
              ↓
Fill-level sensor updates → sends alert when bin 80% full
              ↓
MCD collection notified automatically
```

### Full Bill of Materials

| # | Component | Specification | Qty | Unit Cost | Total |
|---|-----------|--------------|-----|-----------|-------|
| 1 | Raspberry Pi 5 | 4GB RAM | 1 | ₹7,000 | ₹7,000 |
| 2 | Arduino Uno | LED + sensor control | 1 | ₹550 | ₹550 |
| 3 | Anker USB 3.0 Powered Hub | 7-port, for 4 cameras | 1 | ₹1,500 | ₹1,500 |
| 4 | Arducam 16MP USB Camera | Sony IMX519, USB 3.0 | 4 | ₹3,500 | ₹14,000 |
| 5 | LED Ring Light | Camera-mounted, dimmable | 4 | ₹600 | ₹2,400 |
| 6 | 10" IPS HDMI Touchscreen | 1280×800 operator display | 1 | ₹5,500 | ₹5,500 |
| 7 | 20kg Load Cell + HX711 | Built into scanning platform | 1 | ₹900 | ₹900 |
| 8 | 3D Printed Camera Rig | 4-angle overhead frame | 1 | ₹1,500 | ₹1,500 |
| 9 | Steel Scanning Platform | Item placement surface | 1 | ₹3,000 | ₹3,000 |
| 10 | SIM7600 4G HAT | Cloud connectivity | 1 | ₹2,800 | ₹2,800 |
| 11 | 12V 10A SMPS | Main power supply | 1 | ₹900 | ₹900 |
| 12 | 12V 7Ah LiFePO4 Battery + BMS | Power backup | 1 | ₹3,300 | ₹3,300 |
| 13 | IP54 Control Enclosure | Houses electronics | 1 | ₹2,000 | ₹2,000 |
| 14 | Colour-coded Steel Bins | 6 bins, labelled with category icons | 6 | ₹800 | ₹4,800 |
| 15 | HC-SR04 Ultrasonic Sensor | Fill-level per bin | 6 | ₹150 | ₹900 |
| 16 | LED Indicator Strip per Bin | Lights up correct bin after scan | 6 | ₹200 | ₹1,200 |
| 17 | Wires, misc | — | — | — | ₹1,200 |
| | | | | **TOTAL** | **₹53,450** |

---

---

## 🏙️ PRODUCT 2B — AI-EcoScan Public Drop-Off Station

**Deployment:** RWA complexes, metro stations, shopping malls, schools, markets
**Used by:** General public (citizens)
**Volume:** Low-medium — citizen-driven

### How It Works
```
Citizen arrives with old phone / battery / wire
              ↓
Scans QR code (Aadhaar / phone number for tracking)
              ↓
Places item on scanning platform
              ↓
4 cameras identify item automatically
Screen (in Hindi + English):
"📱 Smartphone — Drop in Bin 2 (Yellow)"
Arrow animation points to correct bin
              ↓
Citizen opens ONLY that bin's flap door and drops item
              ↓
Citizen earns reward points → redeemable via UPI
              ↓
Fill-level sensor tracks how full each bin is
When 80% full → MCD gets automatic collection alert
with GPS location → truck dispatched (route optimized)
              ↓
All drops logged → DPCC ward-wise dashboard
```

### Full Bill of Materials

| # | Component | Specification | Qty | Unit Cost | Total |
|---|-----------|--------------|-----|-----------|-------|
| 1–17 | All items from Product 2A | (same scanning + bin hardware) | — | — | ₹53,450 |
| 18 | Vandal-proof ABS Outer Casing | Weatherproof, tamper-resistant for outdoor/public use | 1 | ₹5,000 | ₹5,000 |
| 19 | QR Code / UPI Scanner Module | Citizen identity + reward redemption | 1 | ₹1,200 | ₹1,200 |
| 20 | Lockable Bin Flap Doors × 6 | Solenoid-locked, only correct bin opens after scan | 6 | ₹500 | ₹3,000 |
| 21 | Solenoid Lock per Bin × 6 | 12V, controlled by Arduino | 6 | ₹250 | ₹1,500 |
| | | | | **TOTAL** | **₹64,150** |

---

---

## 💰 Pricing Summary

| Product | Deployment | Cost per Unit |
|---------|-----------|--------------|
| AI-EcoSort Conveyor | Processing facilities | ₹74,950 |
| AI-EcoScan Worker Station (with bins) | DPCC centers / dhalaos | ₹53,450 |
| AI-EcoScan Public Drop-Off Station | RWAs / metro / malls | ₹64,150 |

---

## 📊 Pilot Quotation (5 Units Each)

| Product | Units | Total |
|---------|-------|-------|
| AI-EcoSort Conveyor | 5 | ₹3,74,750 |
| AI-EcoScan Worker Station | 5 | ₹2,67,250 |
| AI-EcoScan Public Station | 10 | ₹6,41,500 |
| **Hardware Total (Pilot)** | **20 units** | **₹12,83,500** |
| Software (Year 1) | — | ₹20,350 |
| Team Stipends (3 members × 12 months) | — | ₹5,76,000 |
| Deployment & Installation | — | ₹1,50,000 |
| Contingency (10%) | — | ₹2,02,985 |
| **GRAND TOTAL (Pilot)** | | **₹22,32,835** |

---

## 🛠️ Shared Software Platform (All 3 Products)

All 3 products feed into the same software platform:

```
PRODUCT 1 ──┐
PRODUCT 2A ─┼──► Railway PostgreSQL ──► Next.js API ──► DPCC Dashboard
PRODUCT 2B ─┘         ↓                      ↓
                  Backblaze B2         CPCB EPR Portal
                  (photo storage)      (auto-submission)
```

| Software Layer | Technology | Annual Cost |
|----------------|-----------|-------------|
| AI Vision | Gemini 3.1 Flash | ₹8,000 |
| Database | Railway PostgreSQL | ₹5,000 |
| API + Hosting | Railway (Next.js) | ₹5,000 |
| Photo Storage | Backblaze B2 | ₹280 |
| Domain + SSL | Namecheap | ₹1,500 |
| Model Training | Vast.ai GPU (20 hrs) | ₹350 |
| **Total Software** | | **₹20,130/year** |

---

## 🗺️ Where Each Product Gets Deployed in Delhi

```
Delhi Map:
━━━━━━━━━━

🏭 HOLAMBI KALAN ECO-PARK (North Delhi)
   → AI-EcoSort Conveyor × 5 units
   → AI-EcoScan Worker Station × 5 units

🏘️ EACH OF 250 WARDS
   → AI-EcoScan Public Station × 1 unit minimum
   (collect → fill-level alert → optimized truck route)

🏛️ DPCC REGIONAL OFFICES (5 zones)
   → AI-EcoScan Worker Station × 1 per office
```

---

## 🎯 One-Line Pitch to Delhi Govt

> *"AI-EcoTrack is Delhi's end-to-end e-waste intelligence ecosystem — an automated sorting conveyor for Holambi Kalan's processing facility, a guided sorting station for DPCC workers, and a smart public drop-off point for citizens across 250 wards — together delivering AI classification, real EPR certificates to CPCB, citizen incentives, and optimized MCD collection routes in one unified platform."*

---
*AI-EcoTrack | Team MakersLab | IndiaInnovates 2026*
*Contact: saumitramatta@[domain]*
