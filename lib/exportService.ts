// ─────────────────────────────────────────────────────────────────────────────
// AI-EcoTrack  ·  Export Service — CSV + PDF
// Zero external dependencies: CSV uses Blob download, PDF uses window.print()
// ─────────────────────────────────────────────────────────────────────────────

import { getScanRecoveryValueINR, type ScanRecord } from '@/lib/scanService';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MATERIAL_LABELS: Record<string, string> = {
    '316L_stainless_steel': '316L Stainless Steel',
    carbon_steel:           'Carbon Steel',
    cast_iron:              'Cast Iron',
    copper_alloy:           'Copper Alloy',
    titanium:               'Titanium',
    inconel_625:            'Inconel 625',
    aluminium_alloy:        'Aluminium Alloy',
    PTFE:                   'PTFE',
    unknown:                'Unknown Material',
};

const SURFACE_LABELS: Record<string, string> = {
    clean:                        'Clean',
    minor_wear:                   'Minor Wear',
    moderate_corrosion_grade_2:   'Moderate Corrosion',
    heavy_corrosion:              'Heavy Corrosion',
    unknown:                      'Unknown',
};

function fmt(ts: { toDate(): Date }) {
    return ts.toDate().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

function csvCell(value: string | number | boolean | null | undefined): string {
    const str = value === null || value === undefined ? '' : String(value);
    // Wrap in quotes and escape internal quotes
    return `"${str.replace(/"/g, '""')}"`;
}

// ── CSV Export ────────────────────────────────────────────────────────────────
const CSV_HEADERS = [
    'Date/Time',
    'Part Name',
    'Material',
    'Alloy Grade',
    'Surface Condition',
    'Part Confidence (%)',
    'Material Confidence (%)',
    'WRI Score',
    'Grade',
    'Estimated Mass (kg)',
    'Recovery Value (₹)',
    'CO₂ Saved (kg)',
    'Hazard — Pressurized',
    'Hazard — Fluid Risk',
    'Expert Review Required',
    'Scan Mode',
    'Source',
    'Worker',
    'Passport ID',
] as const;

function scanToCSVRow(s: ScanRecord): string {
  const recoveryINR = Math.round(getScanRecoveryValueINR(s));
    const co2 = parseFloat(((s.estimatedMassKg ?? 0.5) * 2.5).toFixed(2));
    const hasFluidRisk =
        s.hazardFlags?.residual_fluid_risk &&
        s.hazardFlags.residual_fluid_risk !== 'none' &&
        s.hazardFlags.residual_fluid_risk !== 'unknown';

    const cells = [
        fmt(s.createdAt),
        s.partName,
        MATERIAL_LABELS[s.material] ?? s.material,
        s.alloyGrade ?? '',
        SURFACE_LABELS[s.surfaceCondition] ?? s.surfaceCondition,
        Math.round(s.partConfidence * 100),
        Math.round(s.materialConfidence * 100),
        s.wriScore,
        s.grade,
        s.estimatedMassKg ?? '',
        recoveryINR,
        co2,
        s.hazardFlags?.pressurized_component ? 'Yes' : 'No',
        hasFluidRisk ? 'Yes' : 'No',
        s.escalationRequired ? 'Yes' : 'No',
        s.scanMode,
        s.source === 'raspberry_pi' ? 'Raspberry Pi' : s.source === 'web' ? 'Web' : 'Mobile',
        s.workerName ?? '',
        s.passportId ?? '',
    ];
    return cells.map(csvCell).join(',');
}

export function exportCSV(scans: ScanRecord[], filename?: string): void {
    const date = new Date().toISOString().slice(0, 10);
    const name = filename ?? `ecotrack-scans-${date}.csv`;

    const header = CSV_HEADERS.map(csvCell).join(',');
    const rows   = scans.map(scanToCSVRow);
    const csv    = [header, ...rows].join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── PDF Export (via window.print()) ──────────────────────────────────────────

function hazardBadges(s: ScanRecord): string {
    const badges: string[] = [];
    if (s.hazardFlags?.pressurized_component) badges.push('Pressurized');
    const hasFluidRisk =
        s.hazardFlags?.residual_fluid_risk &&
        s.hazardFlags.residual_fluid_risk !== 'none' &&
        s.hazardFlags.residual_fluid_risk !== 'unknown';
    if (hasFluidRisk) badges.push('Fluid Risk');
    if (s.escalationRequired) badges.push('Expert Review');
    return badges.length ? badges.join(', ') : '—';
}

function gradeColor(grade: string): string {
    if (grade === 'A') return '#84cc16';
    if (grade === 'B') return '#F59E0B';
    return '#EF4444';
}

export function exportPDF(scans: ScanRecord[], orgName?: string): void {
    const date        = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalINR    = Math.round(scans.reduce((s, r) => s + getScanRecoveryValueINR(r), 0));
    const totalCO2    = parseFloat(scans.reduce((s, r) => s + (r.estimatedMassKg ?? 0.5) * 2.5, 0).toFixed(1));
    const avgWRI      = scans.length > 0
        ? (Math.round((scans.reduce((s, r) => s + r.wriScore, 0) / scans.length) * 100) / 100)
        : 0;
    const gradeACnt   = scans.filter(s => s.grade === 'A').length;

    const tableRows = scans.map((s, i) => {
      const recoveryINR = Math.round(getScanRecoveryValueINR(s));
        const co2 = parseFloat(((s.estimatedMassKg ?? 0.5) * 2.5).toFixed(2));
        const rowBg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
        return `
        <tr style="background:${rowBg}">
            <td style="padding:7px 10px;font-size:11px;color:#374151;white-space:nowrap">${fmt(s.createdAt)}</td>
            <td style="padding:7px 10px;font-size:11px;color:#111827;font-weight:600">${s.partName}</td>
            <td style="padding:7px 10px;font-size:11px;color:#374151">${MATERIAL_LABELS[s.material] ?? s.material}</td>
            <td style="padding:7px 10px;font-size:11px;text-align:center">
                <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;color:${gradeColor(s.grade)};background:${gradeColor(s.grade)}18;border:1px solid ${gradeColor(s.grade)}40">${s.grade}</span>
            </td>
            <td style="padding:7px 10px;font-size:11px;text-align:center;font-weight:600;color:#065f46">${s.wriScore}</td>
            <td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:600;color:#d97706">₹${recoveryINR.toLocaleString('en-IN')}</td>
            <td style="padding:7px 10px;font-size:11px;text-align:center;color:#374151">${co2} kg</td>
            <td style="padding:7px 10px;font-size:11px;color:${hazardBadges(s) === '—' ? '#84cc16' : '#ef4444'}">${hazardBadges(s)}</td>
            <td style="padding:7px 10px;font-size:11px;color:#6b7280;white-space:nowrap">${s.workerName ?? '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>AI-EcoTrack · Scan Export · ${date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; }
  @page { margin: 16mm 12mm; size: A4 landscape; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
  }

  /* ── Header ── */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #84cc16; padding-bottom: 12px; margin-bottom: 18px;
  }
  .logo-area { display: flex; align-items: center; gap: 10px; }
  .logo-box {
    width: 38px; height: 38px; border-radius: 10px;
    background: #84cc1610; border: 1.5px solid #84cc1640;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .brand { font-size: 16px; font-weight: 800; color: #111827; }
  .brand-sub { font-size: 10px; color: #6b7280; margin-top: 1px; }
  .report-meta { text-align: right; }
  .report-title { font-size: 13px; font-weight: 700; color: #374151; }
  .report-date  { font-size: 11px; color: #9ca3af; margin-top: 2px; }

  /* ── KPI Row ── */
  .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi-card {
    border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px;
    background: linear-gradient(135deg, #f9fafb 0%, #fff 100%);
  }
  .kpi-label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 800; }

  /* ── Table ── */
  table   { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #111827; }
  thead th {
    padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700;
    color: #d1fae5; letter-spacing: .05em; white-space: nowrap;
  }
  thead th:nth-child(4), thead th:nth-child(5), thead th:nth-child(7) { text-align: center; }
  thead th:nth-child(6) { text-align: right; }
  tbody tr:hover { background: #f0fdf4 !important; }
  tbody td + td { border-left: 1px solid #f3f4f6; }

  /* ── Footer ── */
  .footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
  .footer-note { font-size: 9px; color: #9ca3af; }
  .footer-brand { font-size: 9px; font-weight: 700; color: #84cc16; }
</style>
</head>
<body>
<!-- Header -->
<div class="header no-break">
  <div class="logo-area">
    <div class="logo-box">🌿</div>
    <div>
      <div class="brand">AI-EcoTrack</div>
      <div class="brand-sub">Circular Waste Intelligence${orgName ? ` · ${orgName}` : ''}</div>
    </div>
  </div>
  <div class="report-meta">
    <div class="report-title">Scan Export Report</div>
    <div class="report-date">Generated on ${date}</div>
  </div>
</div>

<!-- KPI Row -->
<div class="kpi-row no-break">
  <div class="kpi-card">
    <div class="kpi-label">Total Scans</div>
    <div class="kpi-value" style="color:#111827">${scans.length}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Total Recovery</div>
    <div class="kpi-value" style="color:#d97706">₹${totalINR.toLocaleString('en-IN')}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">CO₂ Saved</div>
    <div class="kpi-value" style="color:#059669">${totalCO2} kg</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Avg WRI Score</div>
    <div class="kpi-value" style="color:#84cc16">${avgWRI}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Grade A Parts</div>
    <div class="kpi-value" style="color:#84cc16">${gradeACnt} <span style="font-size:12px;font-weight:400;color:#9ca3af">/ ${scans.length}</span></div>
  </div>
</div>

<!-- Table -->
<table>
  <thead>
    <tr>
      <th>Date / Time</th>
      <th>Part Name</th>
      <th>Material</th>
      <th style="text-align:center">Grade</th>
      <th style="text-align:center">WRI</th>
      <th style="text-align:right">Recovery (₹)</th>
      <th style="text-align:center">CO₂ Saved</th>
      <th>Hazards</th>
      <th>Worker</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#9ca3af">No scans to display</td></tr>'}
  </tbody>
</table>

<!-- Footer -->
<div class="footer no-break">
  <div class="footer-note">
    Compliance: WEEE · RoHS · E-Waste Rules 2022 · OSHA · Basel Convention · EU ESPR 2024 &nbsp;|&nbsp;
    WRI = Weighted Recyclability Index (0–1) · Recovery values in INR (₹) at current rates
  </div>
  <div class="footer-brand">AI-EcoTrack — aiecotracker.vercel.app</div>
</div>
</body>
</html>`;

    // Use a hidden iframe — never blocked by popup blockers (unlike window.open)
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for iframe content to render, then print
    iframe.onload = () => {
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 300);
    };

    // Clean up the iframe after the print dialog is dismissed
    const cleanup = () => {
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 1000);
    };

    if (iframe.contentWindow) {
        iframe.contentWindow.addEventListener('afterprint', cleanup);
        // Fallback cleanup in case afterprint doesn't fire (some browsers)
        setTimeout(cleanup, 60_000);
    }
}
