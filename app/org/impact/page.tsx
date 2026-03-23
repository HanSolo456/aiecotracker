"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Leaf,
  TrendingUp,
  DollarSign,
  Recycle,
  ChevronLeft,
  Cpu,
  BarChart3,
  CircleDot,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import BottomNav from "@/components/BottomNav";

// ── Types ────────────────────────────────────────────────────────────────────

interface ImpactSummary {
  totalScans: number;
  totalMassKg: number;
  totalCO2Kg: number;
  totalValueINR: number;
  segregationPct: number;
  avgBinFillPct: number;
  activeBins: number;
}

interface MaterialRow {
  material: string;
  massKg: number;
  count: number;
  co2Kg: number;
  valueINR: number;
}

interface TrendPoint {
  date: string;
  massKg: number;
  co2Kg: number;
}

interface ImpactData {
  summary: ImpactSummary;
  materialBreakdown: MaterialRow[];
  trend: TrendPoint[];
}

// ── Colour palette for materials ─────────────────────────────────────────────
const MAT_COLORS: Record<string, string> = {
  aluminum: "#38BDF8",
  copper: "#F97316",
  pcb: "#A78BFA",
  plastic: "#34D399",
  glass: "#60A5FA",
  paper: "#FBBF24",
  battery: "#F87171",
  metal: "#94A3B8",
  ewaste: "#E879F9",
  default: "#6B7280",
};

function matColor(m: string) {
  return MAT_COLORS[m] ?? MAT_COLORS.default;
}

// ── Small donut chart (pure SVG) ─────────────────────────────────────────────
function DonutChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const R = 54,
    CX = 70,
    CY = 70,
    STROKE = 18;
  const circumference = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const offset = circumference - cumulative * circumference;
    cumulative += pct;
    return { ...d, dash, offset };
  });

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="var(--border)"
        strokeWidth={STROKE}
      />
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={seg.color}
          strokeWidth={STROKE}
          strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
          strokeDashoffset={seg.offset}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      ))}
      <text
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        className="text-xs"
        fill="white"
        fontSize="18"
        fontWeight="bold"
      >
        {total.toFixed(0)}
      </text>
      <text
        x={CX}
        y={CY + 12}
        textAnchor="middle"
        fill="var(--text-secondary)"
        fontSize="9"
      >
        kg total
      </text>
    </svg>
  );
}

// ── Sparkline bar chart (last 14 days) ──────────────────────────────────────
function Sparkline({
  points,
  color,
}: {
  points: TrendPoint[];
  color: "co2" | "mass";
}) {
  const vals = points.map((p) => (color === "co2" ? p.co2Kg : p.massKg));
  const max = Math.max(...vals, 0.01);
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {vals.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm min-h-[2px] transition-all duration-500"
          style={{
            height: `${Math.max(4, (v / max) * 100)}%`,
            background: color === "co2" ? "#4ADE80" : "#38BDF8",
            opacity: 0.7 + 0.3 * (i / vals.length),
          }}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [data, setData] = useState<ImpactData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || user.isAnonymous) {
      router.replace("/dashboard");
      return;
    }
    if (!profile?.orgId) {
      router.replace("/dashboard");
      return;
    }

    async function load() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/org/impact", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ImpactData;
        setData(json);
      } catch (e) {
        setError(String(e));
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [user, profile, loading, router]);

  const donutData = useMemo(
    () =>
      (data?.materialBreakdown ?? []).slice(0, 6).map((m) => ({
        label: m.material,
        value: m.massKg,
        color: matColor(m.material),
      })),
    [data],
  );

  const trend14 = useMemo(() => (data?.trend ?? []).slice(-14), [data]);
  const s = data?.summary;
  const stats = s
    ? [
        {
          icon: <Recycle size={15} />,
          label: "Waste Diverted",
          value: `${s.totalMassKg} kg`,
          sub: "from landfill",
          color: "#4ADE80",
        },
        {
          icon: <Leaf size={15} />,
          label: "CO₂ Avoided",
          value: `${s.totalCO2Kg} kg`,
          sub: "lifetime",
          color: "#34D399",
        },
        {
          icon: <DollarSign size={15} />,
          label: "Recovery Value",
          value: `₹${s.totalValueINR.toLocaleString("en-IN")}`,
          sub: "estimated",
          color: "#FCD34D",
        },
        {
          icon: <TrendingUp size={15} />,
          label: "Segregation Rate",
          value: `${s.segregationPct}%`,
          sub: "Grade A scans",
          color: s.segregationPct >= 70 ? "#4ADE80" : "#FB923C",
        },
        {
          icon: <BarChart3 size={15} />,
          label: "Total Scans",
          value: String(s.totalScans),
          sub: "items processed",
          color: "#84cc16",
        },
        {
          icon: <Cpu size={15} />,
          label: "Active Bins",
          value: String(s.activeBins),
          sub: `avg ${s.avgBinFillPct}% fill`,
          color: "#38BDF8",
        },
      ]
    : [];

  if (loading || fetching)
    return (
      <div
        className="min-h-screen pb-28 lg:pb-10"
        style={{ background: "var(--bg-primary)" }}
      />
    );

  return (
    <div
      className="min-h-screen pb-28 lg:pb-10"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-5 lg:px-10 lg:pt-10 lg:pb-8 bg-grid">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <ChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <CircleDot size={14} style={{ color: "#4ADE80" }} />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-dim)" }}
          >
            Circular Economy
          </span>
        </div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Space Grotesk" }}
        >
          Impact Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
          Real data from your waste classification + IoT sensors
        </p>
      </div>

      <div className="px-5 lg:px-10 flex flex-col gap-5 max-w-4xl">
        {error && (
          <div
            className="card p-3 text-sm"
            style={{ color: "#fca5a5", borderColor: "rgba(239,68,68,0.35)" }}
          >
            {error}
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.map(({ icon, label, value, sub, color }) => (
            <div
              key={label}
              className="card p-4 flex flex-col gap-2 min-w-0 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}18` }}
                >
                  <span style={{ color }}>{icon}</span>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wide truncate"
                  style={{ color: "var(--text-dim)" }}
                >
                  {label}
                </span>
              </div>
              <p
                className="font-bold text-white min-w-0 break-words leading-tight text-[clamp(1.35rem,4.6vw,2rem)]"
                style={{
                  fontFamily: "Space Grotesk",
                  overflowWrap: "anywhere",
                }}
              >
                {value}
              </p>
              <p
                className="text-[10px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {sub}
              </p>
            </div>
          ))}
        </div>

        {/* Material Breakdown + Donut */}
        {donutData.length > 0 && (
          <div className="card p-5">
            <p
              className="text-sm font-bold text-white mb-4"
              style={{ fontFamily: "Space Grotesk" }}
            >
              Materials Recovered
            </p>
            <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div className="shrink-0 mx-auto sm:mx-0">
                <DonutChart data={donutData} />
              </div>
              <div className="flex flex-col gap-2 flex-1 w-full">
                {data?.materialBreakdown.slice(0, 7).map((m) => {
                  const total = data.summary.totalMassKg || 1;
                  const pct = Math.round((m.massKg / total) * 100);
                  return (
                    <div key={m.material} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: matColor(m.material) }}
                      />
                      <span className="text-xs capitalize text-white w-16 shrink-0">
                        {m.material}
                      </span>
                      <div
                        className="flex-1 h-1.5 rounded-full"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: matColor(m.material),
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] w-12 text-right shrink-0"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {m.massKg} kg
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Trend sparklines */}
        {trend14.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-white mb-3">
                CO₂ Avoided — Last 14 Days
              </p>
              <Sparkline points={trend14} color="co2" />
              <div
                className="flex justify-between text-[9px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                <span>{trend14[0]?.date?.slice(5)}</span>
                <span>{trend14[trend14.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-white mb-3">
                Waste Diverted — Last 14 Days
              </p>
              <Sparkline points={trend14} color="mass" />
              <div
                className="flex justify-between text-[9px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                <span>{trend14[0]?.date?.slice(5)}</span>
                <span>{trend14[trend14.length - 1]?.date?.slice(5)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Segregation efficiency gauge */}
        {s && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-sm font-bold text-white"
                style={{ fontFamily: "Space Grotesk" }}
              >
                Org Segregation Efficiency
              </p>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  background:
                    s.segregationPct >= 85
                      ? "rgba(250,204,21,0.15)"
                      : s.segregationPct >= 70
                        ? "rgba(74,222,128,0.12)"
                        : "rgba(251,146,60,0.12)",
                  color:
                    s.segregationPct >= 85
                      ? "#FCD34D"
                      : s.segregationPct >= 70
                        ? "#4ADE80"
                        : "#FB923C",
                }}
              >
                {s.segregationPct >= 85
                  ? "🏆 Elite"
                  : s.segregationPct >= 70
                    ? "✅ Good"
                    : s.segregationPct >= 50
                      ? "⚠️ Needs Work"
                      : "🔴 Critical"}
              </span>
            </div>
            <div
              className="h-4 rounded-full overflow-hidden"
              style={{ background: "var(--border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${s.segregationPct}%`,
                  background:
                    s.segregationPct >= 85
                      ? "linear-gradient(90deg, #FCD34D, #F59E0B)"
                      : s.segregationPct >= 70
                        ? "linear-gradient(90deg, #4ADE80, #22C55E)"
                        : "linear-gradient(90deg, #FB923C, #EF4444)",
                }}
              />
            </div>
            <div
              className="flex justify-between mt-1.5 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              <span>0%</span>
              <span
                className="font-bold"
                style={{ color: "var(--text-secondary)" }}
              >
                {s.segregationPct}% Grade A
              </span>
              <span>100%</span>
            </div>
          </div>
        )}

        {!data && !fetching && !error && (
          <div className="card p-10 flex flex-col items-center gap-3 text-center">
            <Recycle size={32} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-semibold text-white">No data yet</p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Start scanning items to see your circular economy impact.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
