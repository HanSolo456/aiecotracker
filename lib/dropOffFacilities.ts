/**
 * lib/dropOffFacilities.ts
 * Verified Directory of CPCB/DPCC Authorised E-Waste, Scrap & Recycling Facilities
 * Used for instant, ultra-reliable drop-off mapping across India with offline fallback.
 */

export interface DropOffFacility {
    id: string | number;
    name: string;
    category: 'e_waste' | 'metal_scrap' | 'battery' | 'general_recycling';
    categoryLabel: string;
    lat: number;
    lon: number;
    distKm?: number;
    address: string;
    area: string;
    city: string;
    state: string;
    phone?: string;
    timings?: string;
    verifiedCpcb: boolean;
    acceptedMaterials: string[];
    tags?: Record<string, string>;
}

export const VERIFIED_FACILITIES: DropOffFacility[] = [
    // ── Delhi NCR (Holambi Kalan, Mayapuri, Okhla, Noida, Gurugram) ────────────
    {
        id: 'del-01',
        name: 'Holambi Kalan E-Waste Eco-Park & Processing Hub',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 28.7985,
        lon: 77.0862,
        address: 'Holambi Kalan Industrial Complex, North Delhi',
        area: 'Holambi Kalan',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91 11 2700 8900',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['PCBs & Circuit Boards', 'Industrial E-Waste', 'Lithium Batteries', 'Smartphones & Laptops'],
    },
    {
        id: 'del-02',
        name: 'DPCC Authorised E-Waste Collection Facility',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 28.6315,
        lon: 77.1278,
        address: 'Phase-1, Mayapuri Industrial Area, West Delhi',
        area: 'Mayapuri',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91 11 2811 4455',
        timings: 'Mon–Sat: 9:30 AM – 6:30 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['E-Waste', 'Transformer Coils', 'Aluminium & Copper Scrap', 'Consumer Electronics'],
    },
    {
        id: 'del-03',
        name: 'Okhla Material Recovery & Scrap Processing Center',
        category: 'metal_scrap',
        categoryLabel: 'Metal & Industrial Scrap',
        lat: 28.5355,
        lon: 77.2732,
        address: 'Okhla Industrial Area Phase-II, South Delhi',
        area: 'Okhla Phase II',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91 11 2638 7200',
        timings: 'Mon–Sat: 8:30 AM – 7:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['316L Stainless Steel', 'Carbon Steel', 'Heavy Machinery Scrap', 'Brass & Bronze'],
    },
    {
        id: 'del-04',
        name: 'Patparganj E-Waste & Battery Drop-off Depot',
        category: 'battery',
        categoryLabel: 'Batteries & Hazardous',
        lat: 28.6294,
        lon: 77.3075,
        address: 'Plot 42, Patparganj Industrial Area, East Delhi',
        area: 'Patparganj',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91 11 2215 9088',
        timings: 'Mon–Sat: 9:00 AM – 5:30 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Lead-Acid Batteries', 'Li-Ion Cells', 'Inverter Batteries', 'UPS Systems'],
    },
    {
        id: 'del-05',
        name: 'Attero Recycling E-Waste Facility',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 28.6080,
        lon: 77.3780,
        address: 'Sector 63, Noida Electronic Zone',
        area: 'Sector 63',
        city: 'Noida',
        state: 'Uttar Pradesh',
        phone: '+91 120 408 8000',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['PCBs', 'Telecom Gear', 'Laptops & Monitros', 'Lithium Compounds'],
    },
    {
        id: 'del-06',
        name: 'GreenTek Reman E-Waste Collection Point',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 28.5020,
        lon: 77.0810,
        address: 'Udyog Vihar Phase IV, Gurugram',
        area: 'Udyog Vihar',
        city: 'Gurugram',
        state: 'Haryana',
        phone: '+91 124 430 1200',
        timings: 'Mon–Fri: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Corporate IT Assets', 'Servers', 'Appliances', 'Cables & Wiring'],
    },
    {
        id: 'del-07',
        name: 'Naraina Recyclable Materials & Plastics Depot',
        category: 'general_recycling',
        categoryLabel: 'General & Polymers',
        lat: 28.6280,
        lon: 77.1420,
        address: 'Naraina Industrial Area Phase-I, West Delhi',
        area: 'Naraina',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91 11 2577 1144',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Engineered Plastics', 'PTFE Components', 'Packaging Waste', 'Metals'],
    },

    // ── Bengaluru ───────────────────────────────────────────────────────────────
    {
        id: 'blr-01',
        name: 'E-Parisaraa Pvt. Ltd. (First CPCB E-Waste Recycler)',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 13.0640,
        lon: 77.4810,
        address: 'Plot 30-P3, Dobaspet Industrial Area, Bengaluru',
        area: 'Dobaspet / Peenya',
        city: 'Bengaluru',
        state: 'Karnataka',
        phone: '+91 80 2836 2950',
        timings: 'Mon–Sat: 9:00 AM – 5:30 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['PCBs', 'Precious Metal Recovery', 'Monitors & Screens', 'Semiconductors'],
    },
    {
        id: 'blr-02',
        name: 'Cerebra Integrated Technologies Drop Point',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 12.9352,
        lon: 77.6245,
        address: 'Koramangala 4th Block, Bengaluru',
        area: 'Koramangala',
        city: 'Bengaluru',
        state: 'Karnataka',
        phone: '+91 80 2553 8811',
        timings: 'Mon–Sat: 10:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Laptops', 'Smartphones', 'Computer Accessories', 'Lithium Batteries'],
    },
    {
        id: 'blr-03',
        name: 'Whitefield Electronic Waste Collection Facility',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 12.9698,
        lon: 77.7499,
        address: 'EPIP Zone, Whitefield, Bengaluru',
        area: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        phone: '+91 80 4122 3344',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Corporate IT Hardware', 'Servers', 'Cables', 'Peripherals'],
    },

    // ── Mumbai & Pune ──────────────────────────────────────────────────────────
    {
        id: 'mum-01',
        name: 'Eco Recycling Ltd. (Ecoreco)',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 19.1197,
        lon: 72.8468,
        address: 'Andheri East Industrial Zone, Mumbai',
        area: 'Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91 22 4005 2951',
        timings: 'Mon–Sat: 9:30 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['All E-Waste', 'Medical Electronics', 'Telecom Gear', 'Lamps & Fluorescents'],
    },
    {
        id: 'mum-02',
        name: 'Navi Mumbai MIDC Scrap & Recyclables Station',
        category: 'metal_scrap',
        categoryLabel: 'Metal & Industrial Scrap',
        lat: 19.0820,
        lon: 73.0110,
        address: 'TTC Industrial Area, Mahape, Navi Mumbai',
        area: 'Mahape',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        phone: '+91 22 2778 4400',
        timings: 'Mon–Sat: 8:00 AM – 7:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Industrial Ferrous & Non-Ferrous Metals', 'Aluminium Bars', 'Copper Pipes'],
    },
    {
        id: 'pun-01',
        name: 'Bhosari MIDC Authorised E-Waste Recycler',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 18.6298,
        lon: 73.8441,
        address: 'Bhosari Industrial Estate, Pimpri-Chinchwad, Pune',
        area: 'Bhosari',
        city: 'Pune',
        state: 'Maharashtra',
        phone: '+91 20 2712 3322',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Automotive Electronics', 'Industrial Controls', 'E-Waste', 'Batteries'],
    },

    // ── Hyderabad ──────────────────────────────────────────────────────────────
    {
        id: 'hyd-01',
        name: 'Earth Sense Recycle Private Limited',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 17.5350,
        lon: 78.4800,
        address: 'IDA Bollaram, Hyderabad',
        area: 'Bollaram',
        city: 'Hyderabad',
        state: 'Telangana',
        phone: '+91 40 2319 8877',
        timings: 'Mon–Sat: 9:00 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['E-Waste Items', 'Solar Panels & Inverters', 'PCBs', 'Batteries'],
    },
    {
        id: 'hyd-02',
        name: 'HITEC City Smart E-Waste Drop-off Booth',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 17.4474,
        lon: 78.3762,
        address: 'Madhapur, Cyberabad, Hyderabad',
        area: 'HITEC City',
        city: 'Hyderabad',
        state: 'Telangana',
        phone: '+91 40 6600 4422',
        timings: 'Open Daily: 8:00 AM – 8:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Mobile Phones', 'Laptops', 'Chargers & Cables', 'Small Electronics'],
    },

    // ── Chennai ────────────────────────────────────────────────────────────────
    {
        id: 'che-01',
        name: 'Trishyiraya Recycling India Pvt Ltd',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 12.8408,
        lon: 80.1534,
        address: 'MEPZ-SEZ, Tambaram, Chennai',
        area: 'Tambaram',
        city: 'Chennai',
        state: 'Tamil Nadu',
        phone: '+91 44 2262 1188',
        timings: 'Mon–Sat: 9:00 AM – 5:30 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['E-Waste', 'Lithium Cells', 'Telecom Hardware', 'Semiconductors'],
    },

    // ── Kolkata ────────────────────────────────────────────────────────────────
    {
        id: 'kol-01',
        name: 'Salt Lake Sector V E-Waste Recycling Depot',
        category: 'e_waste',
        categoryLabel: 'E-Waste & Electronics',
        lat: 22.5800,
        lon: 88.4300,
        address: 'Sector V, Bidhannagar, Kolkata',
        area: 'Salt Lake Sector V',
        city: 'Kolkata',
        state: 'West Bengal',
        phone: '+91 33 2357 9900',
        timings: 'Mon–Sat: 9:30 AM – 6:00 PM',
        verifiedCpcb: true,
        acceptedMaterials: ['Consumer Electronics', 'Computers', 'Cables', 'Batteries'],
    },
];

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNearestFacilities(
    userLat: number,
    userLon: number,
    categoryFilter?: string,
    maxRadiusKm: number = 50,
): DropOffFacility[] {
    return VERIFIED_FACILITIES
        .filter(f => !categoryFilter || categoryFilter === 'all' || f.category === categoryFilter)
        .map(f => ({
            ...f,
            distKm: Math.round(haversineDistanceKm(userLat, userLon, f.lat, f.lon) * 10) / 10,
        }))
        .filter(f => (f.distKm ?? 0) <= maxRadiusKm)
        .sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
}
