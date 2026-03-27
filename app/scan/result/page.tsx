"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
  Cpu,
  Ruler,
  BookOpen,
  Layers,
  Recycle,
  Leaf,
  Zap,
  MapPin,
  Shield,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ContextualAssistant from "@/components/ContextualAssistant";
import ConfidenceBar from "@/components/ConfidenceBar";
import HazardBadge from "@/components/HazardBadge";
import type { PartMetadataPayload, SafetyLevel } from "@/types";
import { getSessionJSON, getSessionValue } from "@/lib/sessionState";
import { getScanById, restoreScanToSession } from "@/lib/scanService";
import { buildCitizenWasteGuidance } from "@/lib/wasteGuidance";
import { useLanguage } from "@/components/LanguageProvider";

type ScanResultPayload = PartMetadataPayload & {
  multi_view?: {
    angle_count: number;
    part_class_agreement: boolean;
    material_agreement: boolean;
  };
};

function ScanResultPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const fromHistory = searchParams.get("from") === "history";
  const scanId = searchParams.get("scan");
  const [payload, setPayload] = useState<PartMetadataPayload | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const p = getSessionJSON<PartMetadataPayload>("ecotrack_payload");
      const img = getSessionValue("ecotrack_image");
      if (p) {
        if (!cancelled) {
          setPayload(p);
          if (img) setCapturedImage(img);
        }
        return;
      }

      if (!scanId) {
        router.replace("/scan");
        return;
      }

      try {
        const scan = await getScanById(scanId);
        if (!scan?.fullPayload) {
          if (!cancelled) setLoadError("Scan result not found.");
          return;
        }

        restoreScanToSession(scan);
        const restoredPayload =
          getSessionJSON<PartMetadataPayload>("ecotrack_payload");
        const restoredImage = getSessionValue("ecotrack_image");
        if (!restoredPayload) {
          if (!cancelled) setLoadError("Saved scan data is unavailable.");
          return;
        }

        if (!cancelled) {
          setPayload(restoredPayload);
          if (restoredImage) setCapturedImage(restoredImage);
        }
      } catch {
        if (!cancelled) setLoadError("Failed to load scan result.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, scanId]);

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-4 px-8 text-center">
        <p className="text-white font-semibold">{loadError}</p>
        <button
          onClick={() => router.push("/scan")}
          className="btn-primary mt-2"
        >
          {t("scan.try_again")}
        </button>
      </div>
    );
  }

  if (!payload) return null;

  const {
    visual_id,
    material_inference,
    hazard_flags,
    geometry_descriptor,
    injected_regulations,
    escalation_required,
  } = payload;
  const enrichedPayload = payload as ScanResultPayload;
  const multiView = enrichedPayload.multi_view;
  const citizenGuidance = buildCitizenWasteGuidance(enrichedPayload);
  const wasteClass = citizenGuidance.wasteClassification;
  const aiSafety = citizenGuidance.handlingSafety;

  const CATEGORY_CONFIG: Record<
    string,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    biodegradable: {
      label: "Biodegradable",
      color: "#22c55e",
      icon: <Leaf size={14} />,
    },
    recyclable_clean: {
      label: "Recyclable",
      color: "#84cc16",
      icon: <Recycle size={14} />,
    },
    recyclable_ewaste: {
      label: "E-Waste",
      color: "#60A5FA",
      icon: <Zap size={14} />,
    },
    hazardous: {
      label: "Hazardous",
      color: "#EF4444",
      icon: <AlertTriangle size={14} />,
    },
    industrial_component: {
      label: "Special Handling",
      color: "#F59E0B",
      icon: <Package size={14} />,
    },
    mixed: {
      label: "Needs Sorting",
      color: "#94a3b8",
      icon: <Layers size={14} />,
    },
  };
  const categoryConf =
    CATEGORY_CONFIG[wasteClass.waste_category] ?? CATEGORY_CONFIG.mixed;
  const HACKATHON_CONFIG: Record<
    typeof citizenGuidance.hackathonCategory,
    { color: string; icon: React.ReactNode }
  > = {
    biodegradable: { color: "#22c55e", icon: <Leaf size={14} /> },
    recyclable: { color: "#3b82f6", icon: <Recycle size={14} /> },
    hazardous: { color: "#ef4444", icon: <AlertTriangle size={14} /> },
  };
  const topLevelConf = HACKATHON_CONFIG[citizenGuidance.hackathonCategory];

  const activeHazards = [
    {
      key: "pressurized_component",
      label: "Pressurized Component",
      reg: "OSHA 1910.147",
    },
    {
      key: "lead_solder_likelihood",
      label: "Lead Solder",
      reg: "REACH / RoHS",
    },
    {
      key: "asbestos_era_likelihood",
      label: "Asbestos Risk",
      reg: "EPA NESHAP",
    },
  ].map((h) => ({
    ...h,
    active: !!hazard_flags[h.key as keyof typeof hazard_flags],
  }));

  const hydroActive =
    hazard_flags.residual_fluid_risk?.startsWith("hydrocarbon") ||
    hazard_flags.residual_fluid_risk === "chemical_likely" ||
    hazard_flags.residual_fluid_risk === "battery_electrolyte";

  const safetyLevel: SafetyLevel = aiSafety.safety_level;

  const PPE_LABELS: Record<string, string> = {
    nitrile_gloves: "🧤 Nitrile Gloves",
    face_mask: "😷 Face Mask",
    safety_goggles: "🕶️ Goggles",
    full_PPE_suit: "🦶 Full PPE Suit",
    respirator: "🩺 Respirator",
    hard_hat: "👷 Hard Hat",
  };

  const SAFETY_CONFIG: Record<
    SafetyLevel,
    {
      bg: string;
      border: string;
      icon: string;
      title: string;
      subtitle: string;
      textColor: string;
    }
  > = {
    danger: {
      bg: "rgba(239,68,68,0.12)",
      border: "#EF4444",
      icon: "🚫",
      title: t("result.danger"),
      subtitle:
        "Hazardous item detected. Use full PPE. Contact supervisor before proceeding.",
      textColor: "#EF4444",
    },
    caution: {
      bg: "rgba(245,158,11,0.1)",
      border: "#F59E0B",
      icon: "⚠️",
      title: t("result.caution"),
      subtitle:
        "Wear protective gloves and mask. Follow safety protocol before handling.",
      textColor: "#F59E0B",
    },
    safe: {
      bg: "rgba(132,204,22,0.08)",
      border: "#84cc16",
      icon: "✅",
      title: t("result.safe"),
      subtitle:
        "Standard recycling procedures apply. Route to appropriate collection stream.",
      textColor: "#84cc16",
    },
  };
  const sc = SAFETY_CONFIG[safetyLevel];

  return (
    <div className="flex flex-col min-h-screen pb-28">
      {/* Header */}
      <div className="safe-top px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.push(fromHistory ? "/history" : "/scan")}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <ChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white">{t("result.classified")}</h1>
            {multiView && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
                <Layers size={9} />
                {multiView.angle_count}-Angle
              </span>
            )}
          </div>
          <p className="text-xs text-secondary">
            {multiView
              ? `Multi-View Analysis · ${multiView.angle_count} angles merged`
              : "AI-EcoTrack VLM Analysis Complete"}
          </p>
        </div>
      </div>

      {/* ── INSTANT SAFETY VERDICT BANNER ─────────────────────────── */}
      <div
        className="mx-5 mb-2 rounded-2xl p-4 flex items-start gap-4"
        style={{
          background: sc.bg,
          border: `2px solid ${sc.border}`,
          boxShadow:
            safetyLevel === "danger"
              ? "0 0 28px rgba(239,68,68,0.2)"
              : safetyLevel === "caution"
                ? "0 0 20px rgba(245,158,11,0.15)"
                : "none",
        }}
      >
        <span style={{ fontSize: "2.4rem", lineHeight: 1, flexShrink: 0 }}>
          {sc.icon}
        </span>
        <div className="flex-1">
          <p
            className="font-heading font-bold text-xl leading-tight"
            style={{ color: sc.textColor }}
          >
            {sc.title}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {aiSafety?.reason ?? sc.subtitle}
          </p>
          {/* PPE chips */}
          {aiSafety?.ppe_required && aiSafety.ppe_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {aiSafety.ppe_required.map((p) => (
                <span
                  key={p}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: `${sc.border}18`,
                    color: sc.textColor,
                    border: `1px solid ${sc.border}40`,
                  }}
                >
                  {PPE_LABELS[p] ?? p.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Captured image thumbnail */}
        {capturedImage && (
          <div
            className="w-full rounded-2xl overflow-hidden border border-surface-border flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.25)', maxHeight: '320px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedImage}
              alt="Scanned part"
              className="w-full h-auto max-h-[320px] object-contain rounded-2xl"
            />
          </div>
        )}

        {/* Multi-view agreement pill */}
        {multiView?.part_class_agreement && multiView?.material_agreement && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
            <Layers size={14} className="text-green-400 shrink-0" />
            <p className="text-xs text-green-400 font-medium">
              All {multiView.angle_count} angles agree — confidence boosted ✓
            </p>
          </div>
        )}

        <div
          className="card p-4 animate-fade-up"
          style={{ borderTop: `2px solid ${citizenGuidance.binColor}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${citizenGuidance.binColor}20` }}
            >
              <Shield size={14} style={{ color: citizenGuidance.binColor }} />
            </div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
              {t("result.citizen_guide")}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                {citizenGuidance.primaryAction}
              </p>
              <p className="text-sm text-secondary mt-1 leading-relaxed break-words">
                {citizenGuidance.reason}
              </p>
            </div>
            <div
              className="w-full sm:w-auto shrink-0 rounded-2xl px-3 py-2 border"
              style={{
                borderColor: `${citizenGuidance.binColor}50`,
                background: `${citizenGuidance.binColor}14`,
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: citizenGuidance.binColor }}
              >
                Use
              </p>
              <p className="text-sm sm:text-base font-bold text-white mt-0.5 break-words">
                {citizenGuidance.binLabel}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-3">
            <div className="rounded-2xl p-2.5 sm:p-3 border border-surface-border bg-surface-elevated">
              <div className="flex items-center gap-2 mb-1.5">
                <Recycle
                  size={14}
                  style={{ color: citizenGuidance.binColor }}
                />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
                  Recommended Stream
                </p>
              </div>
              <p className="text-sm font-semibold text-white">
                {citizenGuidance.streamLabel}
              </p>
            </div>
            <div className="rounded-2xl p-2.5 sm:p-3 border border-surface-border bg-surface-elevated">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin size={14} style={{ color: citizenGuidance.binColor }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
                  Drop-Off
                </p>
              </div>
              <p className="text-sm font-semibold text-white">
                {citizenGuidance.dropOffLabel}
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl p-2.5 sm:p-3"
            style={{
              background: `${citizenGuidance.binColor}10`,
              border: `1px solid ${citizenGuidance.binColor}30`,
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: citizenGuidance.binColor }}
            >
              {t("result.what_to_do")}
            </p>
            <div className="flex flex-col gap-2">
              {citizenGuidance.steps.map((step, index) => (
                <div
                  key={`${step}-${index}`}
                  className="flex items-start gap-3"
                >
                  <span
                    className="w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0"
                    style={{
                      background: `${citizenGuidance.binColor}18`,
                      color: citizenGuidance.binColor,
                      border: `1px solid ${citizenGuidance.binColor}30`,
                    }}
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm text-white/90 leading-relaxed break-words">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs text-secondary break-words">
              <span className="font-semibold text-white">Caution:</span>{" "}
              {citizenGuidance.caution}
            </p>
            <p className="text-xs text-secondary break-words">
              <span className="font-semibold text-white">Avoid:</span>{" "}
              {citizenGuidance.avoid}
            </p>
          </div>
          {citizenGuidance.hackathonCategory !== "biodegradable" && (
            <button
              onClick={() => router.push("/drop-off")}
              className="mt-3 w-full rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2 justify-center"
              style={{
                background: "var(--bg-elevated)",
                border: `1px solid ${citizenGuidance.binColor}45`,
                color: citizenGuidance.binColor,
              }}
            >
              <MapPin size={15} />
              {t("result.drop_off")}
            </button>
          )}
        </div>

        <div
          className="stat-card p-4 animate-fade-up"
          style={{ borderTop: `2px solid ${topLevelConf.color}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${topLevelConf.color}20` }}
            >
              <span style={{ color: topLevelConf.color }}>
                {topLevelConf.icon}
              </span>
            </div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Waste Category
            </p>
          </div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <span className="text-lg font-bold text-white">
                {citizenGuidance.hackathonLabel}
              </span>
              <p className="text-xs text-secondary mt-1">
                Detailed stream:{" "}
                <span className="text-white font-medium">
                  {categoryConf.label}
                </span>
              </p>
            </div>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-lg"
              style={{
                color: topLevelConf.color,
                background: `${topLevelConf.color}15`,
              }}
            >
              {wasteClass.recyclability_score}% recyclable
            </span>
          </div>
          {/* Recyclability bar */}
          <div
            className="w-full h-1.5 rounded-full mb-3"
            style={{ background: "var(--border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${wasteClass.recyclability_score}%`,
                background: topLevelConf.color,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>
              → {wasteClass.recommended_stream}
            </span>
            {wasteClass.co2_saving_kg != null && (
              <span className="font-semibold" style={{ color: "#84cc16" }}>
                CO₂ saved: {wasteClass.co2_saving_kg} kg
              </span>
            )}
          </div>
        </div>

        {/* Escalation Warning */}
        {escalation_required && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle
              size={16}
              className="text-amber-400 shrink-0 mt-0.5"
            />
            <div>
              <p className="text-xs font-semibold text-amber-400">
                Human Expert Review Required
              </p>
              <p className="text-xs text-secondary mt-0.5">
                Confidence below safety threshold. Escalate to materials
                engineer before proceeding.
              </p>
            </div>
          </div>
        )}

        {/* Part Classification */}
        <div className="card p-4 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-brand-green/15 flex items-center justify-center">
              <Package size={14} className="text-brand-green" />
            </div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
              {t("result.classification")}
            </p>
          </div>
          <p className="text-lg font-bold text-white capitalize">
            {visual_id.part_class.replace(/_/g, " ")}
          </p>
          <p className="text-sm text-secondary mt-0.5">
            {visual_id.subtype?.replace(/_/g, " ") ?? "Standard Type"}
          </p>
          <div className="mt-3">
            <ConfidenceBar
              label="Part ID Confidence"
              value={visual_id.confidence_score}
            />
          </div>
        </div>

        {/* Material Inference */}
        <div className="card p-4 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Cpu size={14} className="text-blue-400" />
            </div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
              {t("result.material")}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {material_inference.primary_material.replace(/_/g, " ")}
              </span>
              {material_inference.estimated_alloy_grade && (
                <span className="text-xs text-secondary px-2 py-0.5 rounded-md bg-surface-elevated border border-surface-border">
                  {material_inference.estimated_alloy_grade}
                </span>
              )}
            </div>
            {material_inference.secondary_material && (
              <p className="text-xs text-secondary">
                Secondary:{" "}
                {material_inference.secondary_material.replace(/_/g, " ")}
              </p>
            )}
            {material_inference.surface_condition && (
              <p className="text-xs text-secondary mt-1 capitalize">
                Condition:{" "}
                {material_inference.surface_condition.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <div className="mt-3">
            <ConfidenceBar
              label="Material Confidence"
              value={material_inference.confidence_score}
            />
          </div>
        </div>

        {/* Geometry */}
        {(geometry_descriptor.estimated_mass_kg ||
          geometry_descriptor.nominal_size_mm) && (
          <div className="card p-4 animate-fade-up">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Ruler size={14} className="text-purple-400" />
              </div>
              <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
                {t("result.geometry")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {geometry_descriptor.nominal_size_mm && (
                <div>
                  <p className="text-xs text-secondary">Nominal Size</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    DN{geometry_descriptor.nominal_size_mm}
                  </p>
                </div>
              )}
              {geometry_descriptor.estimated_mass_kg && (
                <div>
                  <p className="text-xs text-secondary">Est. Mass</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {geometry_descriptor.estimated_mass_kg} kg
                  </p>
                </div>
              )}
              {geometry_descriptor.connection_type && (
                <div className="col-span-2">
                  <p className="text-xs text-secondary">Connection</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {geometry_descriptor.connection_type.replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hazard Flags */}
        <div className="card p-4 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide">
              {t("result.hazard_assess")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeHazards.map((h) => (
              <HazardBadge
                key={h.key}
                label={h.label}
                active={h.active}
                regulation={h.active ? h.reg : undefined}
              />
            ))}
            <HazardBadge
              label={`Residual Fluid: ${hazard_flags.residual_fluid_risk?.replace(/_/g, " ") ?? "None"}`}
              active={hydroActive ?? false}
              regulation={hydroActive ? "ATEX / NFPA 30" : undefined}
            />
          </div>
          {injected_regulations && injected_regulations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-border">
              <p className="text-xs text-secondary mb-2 font-medium">
                Safety Gatekeeper Injected:
              </p>
              <div className="flex flex-col gap-1">
                {injected_regulations.map((reg) => (
                  <div key={reg} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                    <span className="text-xs text-red-300">{reg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <ContextualAssistant
          payload={payload}
          surface="scan_result"
          title="Ask About This Result"
          description="Use this to question the current classification, hazards, confidence, and handling guidance. It does not run a new scan."
        />

        {/* CTA */}
        {visual_id.part_class !== "unknown" && (
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (fromHistory) params.set("from", "history");
              if (scanId) params.set("scan", scanId);
              const query = params.toString();
              router.push(query ? `/guide?${query}` : "/guide");
            }}
            className="btn-primary mt-2"
            style={{ background: "#84cc16", color: "var(--bg-primary)" }}
          >
            <BookOpen size={18} />
            {wasteClass.waste_category === "industrial_component" ||
            wasteClass.waste_category === "hazardous"
              ? t("result.view_guide")
              : t("result.view_dispose")}
            <ChevronRight size={16} className="ml-auto" />
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
export default function ScanResultPage() {
  return (
    <Suspense fallback={null}>
      <ScanResultPageInner />
    </Suspense>
  );
}
