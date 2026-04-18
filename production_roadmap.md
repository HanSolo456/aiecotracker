# 🚀 AI-EcoTrack: Production Roadmap
### IndiaInnovates 2026 Finale → IIT Patna Incubation → Market

> **Team MakersLab** — Saumitra Matta · Satyam Anand · Siddharth Singh  
> Status: Final round qualifier | Target: Production-ready in 6 months

---

## 🏛️ Phase 0 — Ministry Showcase (Next 2–4 weeks)

This is your immediate priority. You need to make the demo *unforgettable* for the ministry panel.

### What the Ministry Will Care About Most
1. **India-specific impact** — quantified CO₂ savings, ₹ recovered, formal waste diverted
2. **Regulatory alignment** — India E-Waste Rules 2022, EPR compliance, BIS standards  
3. **Scale story** — "This works in one factory now, here's how 1,000 factories look"
4. **Livelihood angle** — worker safety + purity-linked income (₹12,500–25,000/mo bonus)

### Immediate Software Polish (Must-do before showcase)
- [ ] **Live metrics page** — Create a `/impact` or `/public-dashboard` page with big, animated real-time numbers:
  - Total scans done (ever), Total CO₂ diverted (kg), Total ₹ recovered, Items classified
  - This should be *publicly accessible* (no login) — give ministry the URL
- [ ] **Demo dataset** — Seed Firestore with ~50 realistic scans of industrial parts so the dashboard looks rich and active
- [ ] **Mobile install prompt** — Make PWA install prominently visible (ministry may ask "can this run on a ₹8,000 phone?")
- [ ] **Hindi language toggle** — Even a basic UI locale option (key terms in Hindi) shows MeitY alignment
- [ ] **Print/export DPP** — One-click PDF export of Digital Product Passport for physical display

### Hardware for the Showcase Table
- Get your **Raspberry Pi station fully working** with a clean 3D-printed or laser-cut enclosure
- Bring **2 ESP32 smart bins** — show live fill levels changing on the dashboard in real-time
- Tablet/laptop showing the dashboard on one side, phone scanning on the other
- Have a **batch of 5–6 real industrial waste items** ready (PCB, valve, motor part, battery)

---

## 🏗️ Phase 1 — IIT Patna Incubation Readiness (Month 1–2)

Before going to the incubator, you need to look like a company, not a hackathon project.

### Software: Harden the Core ✅

#### Authentication & Multi-tenancy
- [ ] Replace Anonymous Auth with **proper Google/Email sign-in for all users** (Anonymous is fine for hackathon, not production)
- [ ] **Role-based access control**: `superadmin` / `org_admin` / `worker` / `viewer` — enforce at Firestore rules level, not just UI
- [ ] **Org onboarding flow** — self-serve signup: create org → invite members → claim devices → start scanning. End-to-end without any manual setup from you.

#### Data & API Reliability
- [ ] **Rate limiting** on all API routes — prevent abuse, protect Groq/Gemini quotas
- [ ] **Request queuing** — if 10 scans hit simultaneously, don't drop them
- [ ] Move RAG knowledge base from **static JSON files → Firestore** — so you can update scrap prices, safety regulations without redeploying
- [ ] **Scrap price live feed** — currently hardcoded Mumbai MIDC rates. Hook into a live data source (even weekly-updated sheet is fine) or build an admin panel to update prices

#### Monitoring & Reliability
- [ ] **Error tracking** — integrate Sentry (free tier) on both Next.js and Raspberry Pi Python
- [ ] **Uptime monitoring** — UptimeRobot or Better Stack (free) watching your production URL
- [ ] **API health dashboard** — internal page showing Groq key statuses, fallback triggers, Firebase latency
- [ ] **Structured logging** — add request IDs to every scan so you can trace path: scan → AI → gatekeeper → DPP → Firestore

### Software: New Features for Incubation Demo ✨

#### 1. Batch Scan Mode
Industrial floors don't scan one item at a time. Add a **batch upload mode**:  
Upload 5–20 photos at once → AI processes them in parallel → single report with all items, total ₹ value, aggregate WRI score.

#### 2. Export & Reporting
- **CSV/Excel export** of scan history for the org — regulators and buyers will need this
- **Monthly PDF report** — org-level summary: scans, materials, CO₂, ₹ — auto-generated, sendable to management

#### 3. Buyer Marketplace (Seed)
A simple page: **"Post your scrap"** — org posts a batch of sorted materials → verified scrap buyers see it. This converts the platform from a tool to a **marketplace** — which is what incubators want to see (network effects, transaction volume).

#### 4. Worker Mobile App (React Native — already scaffolded)
Complete the mobile app with:
- Camera scan (the core flow)  
- My scans + earnings history  
- Leaderboard  
- Push notifications when a scan is complete

---

## ⚙️ Phase 2 — Hardware Expansion (Month 2–4)

This is where IIT Patna's hardware lab becomes your biggest asset.

### What to Add to Hardware

#### 1. Weight-Verified Smart Bins (High Priority)
- **HX711 + load cell** is already in your plan — activate it
- Use weight to **auto-validate scan accuracy**: AI says "valve, 3kg" → bin weight confirms → prevents incentive fraud
- This becomes the **anti-fraud backbone** of your purity-incentive system

#### 2. Conveyor Belt / Conveyor Sorter Integration
- Add a **servo-actuated sorting gate** after the Raspberry Pi station
- When Pi identifies the item → sends signal to Arduino → gate routes item to correct bin (metal / plastic / hazardous)
- This transforms AI-EcoTrack from *advisory* to *automated sorting* — completely different value proposition
- BOM: Arduino control, 2–3 servo motors, belt mechanism (can be lab-fabricated at IIT)

#### 3. Raspberry Pi Camera Station V2
- Upgrade from USB webcam to **Raspberry Pi Camera Module 3 NoIR** (better in industrial lighting)
- Add **ring LED lighting** (controllable brightness) for consistent image quality regardless of environment
- Add a **barcode/QR fallback scanner** — if item HAS a visible label/QR, read it first, then AI augments

#### 4. Thermal Camera Integration (Differentiated)
- Add **MLX90640 thermal camera** to the Pi station (~₹3,500)
- Thermal view detects: residual heat (recently pressurized), active leaks, lithium battery swelling
- This is a **safety gatekeeper hardware upgrade** — catches hazards the visible camera cannot see
- No competitor in India is doing this at this price point

#### 5. ESP32-S3 Upgrade (WiFi 6 + AI)
- Upgrade existing ESP32 bins to **ESP32-S3 with built-in AI acceleration**
- Run **TinyML on-device**: predict "bin will be full in 4 hours" from fill-rate pattern — reduce cloud calls
- Cost difference: ₹300 → ₹600 per bin, but eliminates cloud dependency for basic predictions

#### 6. LoRa WAN Bin for Remote Sites
- Not all industrial sites have reliable WiFi
- Add **LoRa 868MHz module** to bins (SX1276 chip, ~₹400)
- Bins in remote factory floors, mining sites, outdoor yards → still report to cloud via gateway
- One **LoRa gateway** (Raspberry Pi + RAK2245 hat) covers 5–15 km range

---

## 💻 Phase 3 — Software for Production (Month 3–6)

### Architecture Upgrades

#### Move Off "Hobby" Infrastructure
| Current | Production Replacement | Reason |
|---------|----------------------|--------|
| Next.js API Routes for everything | Split: **Next.js** (frontend) + **FastAPI/Python** (AI pipeline) | Better AI library support, async processing |
| Firebase Anonymous Auth | Firebase Google/Email auth + custom JWT for devices | Real user accounts |
| Static JSON RAG | **Vector DB (Qdrant or Pinecone)** for semantic search | Scale to 10,000+ items |
| Single deployment | **Vercel (frontend) + Cloud Run (AI API)** | Auto-scaling, separate concerns |
| No background jobs | **Firebase Cloud Functions** for async DPP generation | Don't block the user |

#### AI Pipeline Upgrades
- [ ] **Fine-tune a custom model** — collect your scan data (you own the data!), fine-tune on Indian industrial waste. This becomes your moat.
- [ ] **Offline AI fallback** — for factory floors with no internet: run a quantized **LLaVA or MobileVLM** locally on the Raspberry Pi 5 (8GB) — no cloud needed for basic classification
- [ ] **Confidence calibration** — log every scan where human overrides AI → build retraining dataset automatically
- [ ] **Multi-language output** — Hindi, Tamil, Gujarati output for the DPP and safety instructions (huge for India deployment)

### Business Logic Features
- [ ] **EPR (Extended Producer Responsibility) compliance dashboard** — track and report EPR obligations per org, linked to their DPP records. Regulators will love this.
- [ ] **Audit trail / tamper-proof logs** — every scan, every DPP, every override logged with timestamp + user ID. Firebase + Cloud Storage.
- [ ] **API access for enterprise** — give large orgs a REST API key to integrate AI-EcoTrack into their own ERP/WMS systems
- [ ] **White-label mode** — rebrand the platform for a recycler or municipality under their name. Revenue model.

---

## 💰 Business Model for Incubation Pitch

| Tier | Customer | Price | What They Get |
|------|----------|-------|--------------|
| **Free** | Individual workers / students | ₹0 | 50 scans/month, basic DPP |
| **Org Basic** | Small recyclers, NGOs | ₹2,500/month | 500 scans, IoT monitoring (2 bins), team of 5 |
| **Org Pro** | Mid-size industries | ₹8,000/month | Unlimited scans, unlimited bins, fleet routing, PDF reports, API access |
| **Enterprise** | Large factories, MNCs | Custom | SLA, on-premise option, custom AI fine-tuning, EPR compliance suite |
| **Hardware** | All tiers | One-time | Sell pre-configured smart bin kit (ESP32 + sensors) at ₹2,500–4,000/unit |

**Government/Tender angle**: Apply for MeitY Startup Hub, CPCB pilots, Smart Cities Mission. Ministry showcase is your entry point.

---

## 📋 30-Day Sprint Plan (Right Now)

| Week | Focus | Key Deliverable |
|------|-------|----------------|
| **Week 1** | Ministry prep | Public impact dashboard live, demo dataset seeded, Pi station in enclosure |
| **Week 2** | Ministry prep | Hindi UI, PDF DPP export, polish all existing flows |
| **Week 3** | Incubation prep | Proper auth (replace anonymous), rate limiting, Sentry error tracking |
| **Week 4** | Incubation prep | Batch scan mode, CSV export, self-serve org onboarding |

---

## 🎯 The Unique Story for the Ministry

> *"We are building the MCA21 for industrial waste — a permanent, AI-verified identity for every item that enters India's recycling ecosystem. Just like every company has a CIN, every industrial part will have an AI-EcoTrack Digital Product Passport."*

- Aligns with **India's circular economy mission**
- Aligns with **Digital India** (digital records for waste)
- Aligns with **Aatmanirbhar Bharat** (India-first AI, local pricing, local standards)
- Position yourselves as the **backbone infrastructure for India's EPR compliance** — not just a scanning app

---

## ⚠️ Risks to Address Before Incubation

1. **AI accuracy in real industrial conditions** — test in actual factories, not controlled lab. Document your accuracy rate (target: >92% as per your own threshold).
2. **Single point of failure** — your Groq API dependency. The Gemini fallback exists but test it heavily.
3. **Data privacy** — industrial companies are paranoid about scan data. Add on-premise deployment option or at minimum, clear data residency and retention policies.
4. **Team bandwidth** — you're 3 people. For incubation, you need to define clearly: what gets built vs. what gets deferred. Don't overcommit.
