# AI-EcoTrack Hardware Options Comparison
### Delhi E-Waste Eco-Park — IndiaInnovates 2026
**Team: MakersLab** | Prepared: April 2026

---

## System Overview

> We are building an AI + IoT system for the **Holambi Kalan E-Waste Eco-Park** that identifies every incoming item, generates a tamper-proof Digital Product Passport (DPP), and auto-submits real EPR certificates to the CPCB portal — giving DPCC real-time e-waste tracking data for Delhi.

---

## The 4 Options

---

### 🟦 Option 1 — Scanning Station Only

```
Worker picks item → places on platform →
4 cameras fire simultaneously → AI identifies in 3-4 sec →
Screen shows: "LiPo Battery — 340g — Zone 3 🔴 HAZARDOUS" →
DPP generated → CPCB portal updated →
Worker physically carries item to correct zone
```

| Parameter              | Details                                              |
|------------------------|------------------------------------------------------|
| 💰 Hardware Cost        | ₹47,050 per unit                                    |
| 🔧 Complexity           | LOW — no moving parts, simple to build & maintain   |
| ✅ Reliability           | VERY HIGH                                            |
| 📋 Data & DPP           | Full — every item logged with photo, weight, category|
| 🤖 Automation Level     | Medium — AI does identification, human does sorting  |
| ⏱️ Build Time            | 6–8 weeks                                            |
| 👷 Jobs Created          | HIGH — 1–2 operators per station + zone carriers     |
| 🏛️ Govt Appeal           | HIGH — solves data gap immediately                   |

**Hardware Components:**

| # | Component | Cost |
|---|-----------|------|
| 1 | Raspberry Pi 5 (8GB) | ₹8,500 |
| 2 | Arduino Uno | ₹550 |
| 3 | Arducam 16MP USB Camera × 4 | ₹14,000 |
| 4 | LED Ring Lights × 4 | ₹2,400 |
| 5 | 10" IPS Touchscreen | ₹5,500 |
| 6 | 20kg Load Cell + HX711 | ₹900 |
| 7 | 3D Printed Camera Rig | ₹1,500 |
| 8 | Steel Platform Base | ₹3,000 |
| 9 | SIM7600 4G Module | ₹2,800 |
| 10 | 12V SMPS + UPS Backup | ₹4,200 |
| 11 | IP54 Control Enclosure | ₹2,000 |
| 12 | Wires & Misc | ₹1,200 |
| | **TOTAL** | **₹47,050** |

> ✅ **Recommended for Phase 1**

---

### 🟨 Option 2 — Conveyor Belt with Integrated Scanning

```
Worker places item on belt →
Item moves through camera tunnel (overhead + side cameras) →
AI identifies in real-time →
Servo gate opens at correct bin position →
Item automatically drops into correct bin
```

| Parameter              | Details                                              |
|------------------------|------------------------------------------------------|
| 💰 Hardware Cost        | ₹67,550 per unit                                    |
| 🔧 Complexity           | MEDIUM — camera + belt + servo sync required         |
| ✅ Reliability           | MEDIUM — timing between scan and gate is critical    |
| 📋 Data & DPP           | Full                                                 |
| 🤖 Automation Level     | HIGH — fully automated identification + sorting      |
| ⏱️ Build Time            | 10–14 weeks                                          |
| 👷 Jobs Created          | LOW — only 1 operator needed to load items           |
| 🏛️ Govt Appeal           | HIGH visually, but politically sensitive (job loss)  |

**Hardware Components:**

| # | Component | Cost |
|---|-----------|------|
| 1 | Raspberry Pi 5 (8GB) | ₹8,500 |
| 2 | Arduino Mega 2560 | ₹700 |
| 3 | Arducam 16MP USB Camera × 4 (in tunnel) | ₹14,000 |
| 4 | Diffused LED Strips (tunnel lighting) | ₹1,200 |
| 5 | NEMA 23 Stepper Motor + TB6600 Driver | ₹3,050 |
| 6 | Conveyor Belt Frame (fabricated) | ₹20,000 |
| 7 | MG996R Servo Gates × 6 | ₹1,800 |
| 8 | Load Cell + HX711 | ₹900 |
| 9 | IR Sensors × 4 | ₹600 |
| 10 | SIM7600 4G Module | ₹2,800 |
| 11 | 7" Touchscreen | ₹3,500 |
| 12 | 24V 15A SMPS | ₹2,200 |
| 13 | Control Enclosure | ₹2,000 |
| 14 | Output Bins × 6 | ₹4,800 |
| 15 | Misc | ₹1,500 |
| | **TOTAL** | **₹67,550** |

> ⚠️ Viable standalone but consider job displacement impact

---

### 🟥 Option 3 — Both Systems, Working Independently

```
STATION (intake area): scans items → generates DPP → operator notes category
BELT (sorting area): workers manually load items into belt → belt transports only
(no communication between systems)
```

| Parameter              | Details                                              |
|------------------------|------------------------------------------------------|
| 💰 Hardware Cost        | ₹47,050 + ₹45,000 = **₹92,050** per setup          |
| 🔧 Complexity           | Low each, but redundant infrastructure               |
| ✅ Reliability           | High — independent systems                           |
| 📋 Data & DPP           | From scanning station only                           |
| 🤖 Automation Level     | LOW — belt is just transport, has no intelligence    |
| ⏱️ Build Time            | 10–12 weeks                                          |
| 👷 Jobs Created          | HIGH — operators for both systems                    |
| 🏛️ Govt Appeal           | LOW — expensive with no extra benefit over Option 1  |

> ❌ **Not Recommended** — costs double but adds no value over Option 1 alone

---

### 🟩 Option 4 — Both Systems, Fully Integrated

```
Worker places item on scanning station →
AI identifies → DPP generated → CPCB updated →
Signal sent to Arduino on belt: "next item = Bin 3" →
Worker places same item on belt →
Belt automatically routes and drops into correct bin →
IR sensor confirms drop → ready for next item
```

| Parameter              | Details                                                    |
|------------------------|------------------------------------------------------------|
| 💰 Hardware Cost        | ₹47,050 + ₹45,000 = **₹92,050** per setup                |
| 🔧 Complexity           | HIGH — two systems must communicate in real-time           |
| ✅ Reliability           | MEDIUM — one failure breaks the full chain                 |
| 📋 Data & DPP           | Full — most complete data pipeline                         |
| 🤖 Automation Level     | VERY HIGH — AI decides, belt executes                      |
| ⏱️ Build Time            | 14–18 weeks                                                |
| 👷 Jobs Created          | MEDIUM — 1–2 trained operators (dignified formal roles)    |
| 🏛️ Govt Appeal           | VERY HIGH — most impressive, most complete system           |

**How Belt Knows Where to Send Item:**
```
Scan Station → Serial/USB → Arduino
"BIN:3\n"         received    stores nextBin = 3

IR sensor at belt START detects item placed
Arduino starts timer (belt speed is fixed)

After X seconds → item reaches Bin 3 position
Arduino fires Servo Gate 3 → item drops
IR sensor in Bin 3 confirms → gate closes ✅
```

> ✅ **Recommended for Phase 2** (after pilot approval)

---

## Full Comparison Table

| Parameter | Option 1 | Option 2 | Option 3 | Option 4 |
|---|:---:|:---:|:---:|:---:|
| **Cost (per unit/setup)** | ₹47,050 | ₹67,550 | ₹92,050 | ₹92,050 |
| **Complexity** | 🟢 Low | 🟡 Medium | 🟢 Low | 🔴 High |
| **Reliability** | 🟢 Very High | 🟡 Medium | 🟢 High | 🟡 Medium |
| **Automation** | 🟡 Medium | 🟢 High | 🔴 Low | 🟢 Very High |
| **Jobs Created** | 🟢 High | 🔴 Low | 🟢 High | 🟡 Medium |
| **Data / DPP** | ✅ Full | ✅ Full | ✅ Partial | ✅ Full |
| **Build Time** | 6–8 wks | 10–14 wks | 10–12 wks | 14–18 wks |
| **Wow Factor** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Recommended** | ✅ Phase 1 | ⚠️ Alternative | ❌ Skip | ✅ Phase 2 |

---

## Job Creation Analysis

> Indian govt projects are evaluated on **employment generation**, especially for transitioning informal Seelampur workers into formal, safe, dignified roles at Holambi Kalan.

| Option | Jobs Created | Type of Role |
|--------|-------------|--------------|
| Option 1 | 2–3 per station | Scanning Operator + Zone Carrier — trained, formal |
| Option 2 | 1 per belt | Loader only — replaces zone sorters |
| Option 3 | 3–4 total | Operator + Belt Loader |
| Option 4 | 1–2 per setup | Scanning Operator — dignified, technology-assisted |

> ✅ **Option 1 creates the most dignified formal jobs** — best narrative for bringing Seelampur workers into the formal economy as trained AI-system operators.

---

## Recommended Phased Approach

```
PHASE 1 (Month 1–6): Submit in Quotation Now
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Build Option 1 (Scanning Station)
→ Pilot at Holambi Kalan intake zone
→ Prove data pipeline: Scan → DPP → CPCB Portal → DPCC Dashboard
→ Train 2–3 workers as scanning operators

PHASE 2 (Month 7–12): After Pilot Approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ Integrate conveyor belt → Option 4
→ Scale to all processing zones
→ Full automated routing system
→ Model trained on 10,000+ real scans from Phase 1

SCALE (Year 2): Full Delhi Deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 1 integrated system per DPCC authorized facility
→ AI model runs on-device (no API cost)
→ Real EPR data flowing into CPCB portal from Delhi
```

---

## One-Line Pitch to Delhi Govt

> *"An AI scanning station for the Holambi Kalan E-Waste Eco-Park that identifies every incoming item, generates a tamper-proof Digital Product Passport, and auto-submits verified EPR certificates to CPCB — eliminating fake compliance data and giving DPCC the first real e-waste tracking dashboard in Delhi history."*

---
*AI-EcoTrack | Team MakersLab | IndiaInnovates 2026*
