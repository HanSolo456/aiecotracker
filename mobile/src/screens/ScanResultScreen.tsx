import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  AlertTriangle,
  Package,
  Cpu,
  Ruler,
  BookOpen,
  Recycle,
  Leaf,
  MapPin,
  Shield,
  Zap,
} from 'lucide-react-native';
import type { ScanRecord } from '../services/scanService';

type ScanResultRoute = RouteProp<
  { ScanResult: { scan: ScanRecord } },
  'ScanResult'
>;

export default function ScanResultScreen() {
  const navigation = useNavigation();
  const route = useRoute<ScanResultRoute>();
  const scan = route.params?.scan;

  // Try to hydrate the full AI payload from Firestore (if present)
  const rawPayload = (scan as any)?.fullPayload as string | undefined;
  let payload: any | null = null;
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = null;
    }
  }

  const visual = payload?.visual_id;
  const partTitle =
    (visual?.part_class && visual.part_class.replace(/_/g, ' ')) ||
    scan?.partName ||
    '';
  const partSubtitle =
    (visual?.subtype && visual.subtype.replace(/_/g, ' ')) ||
    scan?.subtype ||
    '';

  const hazardFlags = scan?.hazardFlags ?? {};
  const wasteCategory = payload?.waste_classification?.waste_category as string | undefined;
  const safetyLevel = payload?.handling_safety?.safety_level as string | undefined;

  const hackathonCategory: 'biodegradable' | 'recyclable' | 'hazardous' =
    wasteCategory === 'biodegradable'
      ? 'biodegradable'
      : wasteCategory === 'hazardous' ||
        safetyLevel === 'danger' ||
        hazardFlags.asbestos_era_likelihood ||
        hazardFlags.residual_fluid_risk === 'chemical_likely' ||
        hazardFlags.residual_fluid_risk === 'battery_electrolyte'
        ? 'hazardous'
        : 'recyclable';

  const detailedLabel =
    wasteCategory === 'recyclable_ewaste'
      ? 'E-Waste'
      : wasteCategory === 'industrial_component'
      ? 'Special Handling'
      : wasteCategory === 'mixed'
      ? 'Needs Sorting'
      : wasteCategory === 'biodegradable'
      ? 'Biodegradable'
      : wasteCategory === 'hazardous'
      ? 'Hazardous'
      : 'Recyclable';

  const accentColor =
    hackathonCategory === 'biodegradable'
      ? '#22c55e'
      : hackathonCategory === 'hazardous'
      ? '#ef4444'
      : '#3b82f6';

  const guidanceIcon =
    hackathonCategory === 'biodegradable' ? (
      <Leaf size={16} color={accentColor} />
    ) : hackathonCategory === 'hazardous' ? (
      <AlertTriangle size={16} color={accentColor} />
    ) : wasteCategory === 'recyclable_ewaste' ? (
      <Zap size={16} color={accentColor} />
    ) : (
      <Recycle size={16} color={accentColor} />
    );

  const binLabel =
    hackathonCategory === 'biodegradable'
      ? 'Green Bin'
      : hackathonCategory === 'hazardous'
      ? 'Red Hazard Bin'
      : wasteCategory === 'recyclable_ewaste'
      ? 'E-Waste Drop-Off'
      : 'Blue Bin';

  const primaryAction =
    hackathonCategory === 'biodegradable'
      ? 'Put this in the green wet-waste stream for composting.'
      : hackathonCategory === 'hazardous'
      ? 'Keep this out of normal bins and route it to supervised hazardous disposal.'
      : wasteCategory === 'industrial_component'
      ? 'Route this through supervised collection, not a public bin.'
      : wasteCategory === 'recyclable_ewaste'
      ? 'Keep it intact and hand it to an authorised e-waste recycler.'
      : 'Place this in the blue dry-waste recycling stream.';

  const safetyReason =
    payload?.handling_safety?.reason ||
    (hackathonCategory === 'hazardous'
      ? 'Hazard indicators were detected, so this item needs careful handling.'
      : wasteCategory === 'industrial_component'
      ? 'Industrial parts should be handled through a supervised collection flow.'
      : 'This item appears suitable for the recommended waste stream.');

  const guidanceSteps =
    hackathonCategory === 'biodegradable'
      ? [
          'Remove any plastic or foil wrapping first.',
          'Keep it with food or garden waste only.',
          'Send it for composting quickly to avoid contamination.',
        ]
      : hackathonCategory === 'hazardous'
      ? [
          'Avoid direct contact and keep the item sealed if it may leak.',
          'Do not place it in household green or blue bins.',
          'Take it to a hazardous or authorised e-waste collection point.',
        ]
      : wasteCategory === 'industrial_component'
      ? [
          'Do not attempt home disassembly.',
          'Isolate the item from public recycling bins.',
          'Send it to trained staff for supervised handling.',
        ]
      : wasteCategory === 'recyclable_ewaste'
      ? [
          'Store the item in a dry place and keep it intact.',
          'Do not crush, burn, or dismantle it at home.',
          'Drop it at an authorised e-waste collection centre.',
        ]
      : [
          'Empty or wipe off visible residue first.',
          'Keep the item dry so it stays recyclable.',
          'Place it with other dry recyclables only.',
        ];

  if (!scan) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={18} color="#9ca3af" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Part Identified</Text>
            <Text style={styles.subtitle}>
              {scan.scanMode === 'multi-view'
                ? 'Multi‑View Analysis · angles merged'
                : 'AI‑EcoTrack VLM Analysis Complete'}
            </Text>
          </View>
        </View>

        {/* Multi‑view agreement pill */}
        {payload?.multi_view?.angle_count &&
          payload?.multi_view?.part_class_agreement &&
          payload?.multi_view?.material_agreement && (
            <View style={styles.multiViewPill}>
              <Layers size={14} color="#4ade80" />
              <Text style={styles.multiViewText}>
                All {payload.multi_view.angle_count} angles agree — confidence
                boosted ✓
              </Text>
            </View>
          )}

        <View style={[styles.card, styles.guidanceCard, { borderTopColor: accentColor }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconPill, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}66` }]}>
              <Shield size={16} color={accentColor} />
            </View>
            <Text style={styles.cardLabel}>Waste Guidance</Text>
          </View>

          <View style={styles.guidanceTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.guidanceAction}>{primaryAction}</Text>
              <Text style={styles.guidanceReason}>{safetyReason}</Text>
            </View>
            <View style={[styles.guidanceBinPill, { borderColor: `${accentColor}66`, backgroundColor: `${accentColor}22` }]}>
              <Text style={[styles.guidanceBinTitle, { color: accentColor }]}>Use</Text>
              <Text style={styles.guidanceBinValue}>{binLabel}</Text>
            </View>
          </View>

          <View style={styles.guidanceSummaryRow}>
            <View style={styles.guidanceSummaryCard}>
              <View style={styles.guidanceSummaryHeader}>
                {guidanceIcon}
                <Text style={styles.guidanceSummaryLabel}>Waste Category</Text>
              </View>
              <Text style={styles.guidanceSummaryValue}>
                {hackathonCategory === 'biodegradable'
                  ? 'Biodegradable'
                  : hackathonCategory === 'hazardous'
                  ? 'Hazardous'
                  : 'Recyclable'}
              </Text>
              <Text style={styles.guidanceSummarySub}>{detailedLabel}</Text>
            </View>
            <View style={styles.guidanceSummaryCard}>
              <View style={styles.guidanceSummaryHeader}>
                <MapPin size={16} color={accentColor} />
                <Text style={styles.guidanceSummaryLabel}>Drop-Off</Text>
              </View>
              <Text style={styles.guidanceSummaryValue}>
                {hackathonCategory === 'biodegradable'
                  ? 'Compost / wet waste'
                  : hackathonCategory === 'hazardous'
                  ? 'Hazardous depot'
                  : wasteCategory === 'recyclable_ewaste'
                  ? 'Authorised e-waste centre'
                  : 'Dry recycling stream'}
              </Text>
            </View>
          </View>

          <View style={[styles.guidanceStepsCard, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}14` }]}>
            <Text style={[styles.guidanceStepsTitle, { color: accentColor }]}>What To Do Now</Text>
            {guidanceSteps.map((step, index) => (
              <View key={step} style={styles.guidanceStepRow}>
                <View style={[styles.guidanceStepBadge, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}24` }]}>
                  <Text style={[styles.guidanceStepBadgeText, { color: accentColor }]}>{index + 1}</Text>
                </View>
                <Text style={styles.guidanceStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Part classification */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconPill}>
              <Package size={16} color="#22c55e" />
            </View>
            <Text style={styles.cardLabel}>Part Classification</Text>
          </View>
          <Text style={styles.partName}>{partTitle}</Text>
          {!!partSubtitle && (
            <Text style={styles.partSubtype}>{partSubtitle}</Text>
          )}
          <View style={styles.confRow}>
            <Text style={styles.confLabel}>Part ID Confidence</Text>
            <Text style={styles.confValue}>
              {Math.round(scan.partConfidence * 100)}%
            </Text>
          </View>
          <View style={styles.confBarTrack}>
            <View
              style={[
                styles.confBarFill,
                { width: `${Math.round(scan.partConfidence * 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Material inference (if payload available) */}
        {payload?.material_inference && (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconPill,
                  { backgroundColor: 'rgba(37,99,235,0.18)', borderColor: 'rgba(59,130,246,0.5)' },
                ]}
              >
                <Cpu size={16} color="#60a5fa" />
              </View>
              <Text style={styles.cardLabel}>Material Inference</Text>
            </View>

            <View style={styles.materialHeaderRow}>
              <Text style={styles.materialTitle}>
                {String(payload.material_inference.primary_material || '').replace(/_/g, ' ')}
              </Text>
              {!!payload.material_inference.estimated_alloy_grade && (
                <View style={styles.materialBadge}>
                  <Text style={styles.materialBadgeText}>
                    {payload.material_inference.estimated_alloy_grade}
                  </Text>
                </View>
              )}
            </View>

            {!!payload.material_inference.secondary_material && (
              <Text style={styles.materialLine}>
                Secondary:{' '}
                {String(payload.material_inference.secondary_material).replace(/_/g, ' ')}
              </Text>
            )}
            {!!payload.material_inference.surface_condition && (
              <Text style={styles.materialLine}>
                Condition:{' '}
                {String(payload.material_inference.surface_condition)
                  .replace(/_/g, ' ')
                  .replace(/\s+/g, ' ')}
              </Text>
            )}

            <View style={styles.confRow}>
              <Text style={styles.confLabel}>Material Confidence</Text>
              <Text style={styles.matConfValue}>
                {Math.round((payload.material_inference.confidence_score || 0) * 100)}%
              </Text>
            </View>
            <View style={styles.matConfBarTrack}>
              <View
                style={[
                  styles.matConfBarFill,
                  {
                    width: `${Math.round(
                      (payload.material_inference.confidence_score || 0) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Geometry (from payload or scan) */}
        {(payload?.geometry_descriptor || scan.nominalSizeMm || scan.estimatedMassKg) && (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconPill,
                  { backgroundColor: 'rgba(147,51,234,0.18)', borderColor: 'rgba(168,85,247,0.5)' },
                ]}
              >
                <Ruler size={16} color="#a855f7" />
              </View>
              <Text style={styles.cardLabel}>Geometry</Text>
            </View>

            <View style={styles.geomRow}>
              {(payload?.geometry_descriptor?.nominal_size_mm || scan.nominalSizeMm) && (
                <View style={styles.geomCol}>
                  <Text style={styles.geomLabel}>Nominal Size</Text>
                  <Text style={styles.geomValue}>
                    DN{payload?.geometry_descriptor?.nominal_size_mm ?? scan.nominalSizeMm}
                  </Text>
                </View>
              )}
              {(payload?.geometry_descriptor?.estimated_mass_kg || scan.estimatedMassKg) && (
                <View style={styles.geomCol}>
                  <Text style={styles.geomLabel}>Est. Mass</Text>
                  <Text style={styles.geomValue}>
                    {payload?.geometry_descriptor?.estimated_mass_kg ??
                      scan.estimatedMassKg}{' '}
                    kg
                  </Text>
                </View>
              )}
            </View>

            {payload?.geometry_descriptor?.connection_type && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.geomLabel}>Connection</Text>
                <Text style={styles.geomConnectionValue}>
                  {String(payload.geometry_descriptor.connection_type).replace(/_/g, ' ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Hazard assessment (from scan.hazardFlags) */}
        {scan.hazardFlags && (
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconPill,
                  { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(248,113,113,0.5)' },
                ]}
              >
                <AlertTriangle size={16} color="#f97373" />
              </View>
              <Text style={styles.cardLabel}>Hazard Assessment</Text>
            </View>

            <View style={styles.hazardPillsContainer}>
              {/* Pressurized component – full row */}
              <View
                style={[
                  scan.hazardFlags.pressurized_component
                    ? styles.hazardPillRed
                    : styles.hazardPillMuted,
                  styles.hazardFullWidth,
                ]}
              >
                <AlertTriangle
                  size={12}
                  color={scan.hazardFlags.pressurized_component ? '#f97373' : '#4b5563'}
                />
                <Text
                  style={
                    scan.hazardFlags.pressurized_component
                      ? styles.hazardText
                      : styles.hazardMutedText
                  }
                >
                  Pressurized Component · OSHA 1910.147
                </Text>
              </View>

              {/* Middle row: Lead + Asbestos side‑by‑side */}
              <View style={styles.hazardMiddleRow}>
                <View
                  style={[
                    scan.hazardFlags.lead_solder_likelihood
                      ? styles.hazardPillRed
                      : styles.hazardPillMuted,
                  ]}
                >
                  <AlertTriangle
                    size={12}
                    color={scan.hazardFlags.lead_solder_likelihood ? '#f97373' : '#4b5563'}
                  />
                  <Text
                    style={
                      scan.hazardFlags.lead_solder_likelihood
                        ? styles.hazardText
                        : styles.hazardMutedText
                    }
                  >
                    Lead Solder
                  </Text>
                </View>

                <View
                  style={[
                    scan.hazardFlags.asbestos_era_likelihood
                      ? styles.hazardPillRed
                      : styles.hazardPillMuted,
                  ]}
                >
                  <AlertTriangle
                    size={12}
                    color={scan.hazardFlags.asbestos_era_likelihood ? '#f97373' : '#4b5563'}
                  />
                  <Text
                    style={
                      scan.hazardFlags.asbestos_era_likelihood
                        ? styles.hazardText
                        : styles.hazardMutedText
                    }
                  >
                    Asbestos Risk
                  </Text>
                </View>
              </View>

              {/* Residual fluid – full row */}
              <View
                style={[
                  scan.hazardFlags.residual_fluid_risk &&
                  scan.hazardFlags.residual_fluid_risk !== 'none'
                    ? styles.hazardPillRed
                    : styles.hazardPillMuted,
                  styles.hazardFullWidth,
                ]}
              >
                <AlertTriangle
                  size={12}
                  color={
                    scan.hazardFlags.residual_fluid_risk &&
                    scan.hazardFlags.residual_fluid_risk !== 'none'
                      ? '#f97373'
                      : '#4b5563'
                  }
                />
                <Text
                  style={
                    scan.hazardFlags.residual_fluid_risk &&
                    scan.hazardFlags.residual_fluid_risk !== 'none'
                      ? styles.hazardText
                      : styles.hazardMutedText
                  }
                >
                  Residual Fluid:{' '}
                  {String(scan.hazardFlags.residual_fluid_risk || 'none').replace(/_/g, ' ')} · ATEX
                  / NFPA 30
                </Text>
              </View>
            </View>

            {payload?.injected_regulations && payload.injected_regulations.length > 0 && (
              <View style={styles.hazardInjectedBlock}>
                <Text style={styles.hazardInjectedTitle}>Safety Gatekeeper Injected:</Text>
                <View style={{ marginTop: 6, gap: 4 }}>
                  {payload.injected_regulations.map((reg: string) => (
                    <View key={reg} style={styles.hazardBulletRow}>
                      <View style={styles.hazardBulletDot} />
                      <Text style={styles.hazardBulletText}>{reg}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* CTA to disassembly guide */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.ctaButton}
          // @ts-expect-error loose navigation typing
          onPress={() => navigation.navigate('Guide', { scan })}
        >
          <BookOpen size={18} color="#f9fafb" />
          <Text style={styles.ctaText}>View Disassembly Guide</Text>
          <ChevronRight size={16} color="#f9fafb" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  multiViewPill: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.5)',
    backgroundColor: 'rgba(34,197,94,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiViewText: {
    fontSize: 12,
    color: '#4ade80',
    fontWeight: '500',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#111827',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#050816',
  },
  guidanceCard: {
    borderTopWidth: 2,
  },
  cardGap: {
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardLabel: {
    fontSize: 14,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  partName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#f9fafb',
    textTransform: 'capitalize',
  },
  partSubtype: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  guidanceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 12,
    marginBottom: 12,
  },
  guidanceAction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    lineHeight: 22,
  },
  guidanceReason: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    lineHeight: 18,
  },
  guidanceBinPill: {
    minWidth: 110,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guidanceBinTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  guidanceBinValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    marginTop: 4,
  },
  guidanceSummaryRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginBottom: 12,
  },
  guidanceSummaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  guidanceSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    marginBottom: 8,
  },
  guidanceSummaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  guidanceSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  guidanceSummarySub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  guidanceStepsCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  guidanceStepsTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  guidanceStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    marginBottom: 8,
  },
  guidanceStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceStepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guidanceStepText: {
    flex: 1,
    fontSize: 13,
    color: '#e5e7eb',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  statValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  geomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    columnGap: 24,
  },
  geomCol: {
    flex: 1,
  },
  geomLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  geomValue: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '700',
    color: '#f9fafb',
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
  },
  confLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  confValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  confBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  confBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  secondaryText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  materialHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  materialTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#f9fafb',
  },
  materialLine: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  materialBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    marginLeft: 8,
  },
  materialBadgeText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  geomConnectionValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  hazardPillRed: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    alignSelf: 'flex-start',
  },
  hazardText: {
    fontSize: 12,
    color: '#fecaca',
  },
  hazardPillsContainer: {
    marginTop: 6,
    gap: 6,
  },
  hazardMiddleRow: {
    flexDirection: 'row',
    columnGap: 6,
  },
  hazardFullWidth: {
    alignSelf: 'flex-start',
  },
  hazardPillMuted: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    alignSelf: 'flex-start',
  },
  hazardMutedText: {
    fontSize: 12,
    color: '#6b7280',
  },
  matConfValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#facc15',
  },
  matConfBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  matConfBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#facc15',
  },
  hazardInjectedBlock: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  hazardInjectedTitle: {
    fontSize: 12,
    color: '#e5e7eb',
    fontWeight: '600',
  },
  hazardBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 6,
  },
  hazardBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f97373',
    marginTop: 6,
  },
  hazardBulletText: {
    flex: 1,
    fontSize: 12,
    color: '#fecaca',
  },
  ctaButton: {
    marginTop: 18,
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    shadowColor: '#22c55e',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    marginLeft: 4,
  },
});
