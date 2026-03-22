import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Clock3,
  ScanLine,
  BookOpen,
  QrCode,
  X as XIcon,
} from 'lucide-react-native';
import {
  subscribeToRecentScans,
  computeStats,
  relativeTime,
  type ScanRecord,
} from '../services/scanService';

const MATERIAL_LABELS: Record<string, string> = {
  '316L_stainless_steel': '316L Stainless Steel',
  carbon_steel: 'Carbon Steel',
  cast_iron: 'Cast Iron',
  copper_alloy: 'Copper Alloy',
  titanium: 'Titanium',
  inconel_625: 'Inconel 625',
  aluminium_alloy: 'Aluminium Alloy',
  PTFE: 'PTFE',
  unknown: 'Unknown Material',
};

const gradeColor: Record<string, string> = {
  A: '#4ade80',
  B: '#fbbf24',
  C: '#f87171',
};

function HistoryCard({ scan }: { scan: ScanRecord }) {
  const [expanded, setExpanded] = React.useState(false);
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((prev) => !prev)}
      style={styles.card}
    >
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.gradeBadge,
            { borderColor: `${gradeColor[scan.grade]}55` },
          ]}
        >
          <Text
            style={[
              styles.gradeText,
              { color: gradeColor[scan.grade] || '#e5e7eb' },
            ]}
          >
            {scan.grade}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.scanTitle} numberOfLines={1}>
              {scan.partName}
            </Text>
          </View>
          <Text style={styles.scanSub} numberOfLines={1}>
            {MATERIAL_LABELS[scan.material] ?? scan.material}
            {scan.alloyGrade ? ` · ${scan.alloyGrade}` : ''}
          </Text>
          <View style={styles.row}>
            <View style={styles.metaLeft}>
              <Clock3 size={11} color="#6b7280" />
              <Text style={styles.scanMeta}>
                {relativeTime(scan.createdAt)}
              </Text>
            </View>
            <Text style={styles.scanMetaAccent}>WRI {scan.wriScore}</Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>Mobile</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.scanValue}>₹{scan.recoveryValueUSD}</Text>
          {expanded ? (
            <XIcon size={16} color="#4b5563" />
          ) : (
            <ChevronDown size={16} color="#4b5563" />
          )}
        </View>
      </View>
      {expanded && (
        <View style={styles.expandedRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.expandedItem}
            onPress={() =>
              // @ts-expect-error loose navigation typing
              navigation.navigate('ScanResult', { scan })
            }
          >
            <View style={styles.expandedIconBoxBlue}>
              <ScanLine size={16} color="#60a5fa" />
            </View>
            <View style={styles.expandedTextCol}>
              <Text style={styles.expandedTitle}>Scan Result</Text>
              <Text style={styles.expandedSubtitle}>
                AI identification & hazards
              </Text>
            </View>
            <ChevronRight size={14} color="#4b5563" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.expandedItem}
            onPress={() =>
              // @ts-expect-error loose navigation typing
              navigation.navigate('Guide', { scan })
            }
          >
            <View style={styles.expandedIconBoxGreen}>
              <BookOpen size={16} color="#22c55e" />
            </View>
            <View style={styles.expandedTextCol}>
              <Text style={styles.expandedTitle}>Disassembly Guide</Text>
              <Text style={styles.expandedSubtitle}>
                Step‑by‑step safety procedure
              </Text>
            </View>
            <ChevronRight size={14} color="#4b5563" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.expandedItemLast}
            onPress={() =>
              // @ts-expect-error loose navigation typing
              navigation.navigate('Passport', { scan })
            }
          >
            <View style={styles.expandedIconBoxAmber}>
              <QrCode size={16} color="#fbbf24" />
            </View>
            <View style={styles.expandedTextCol}>
              <Text style={styles.expandedTitle}>Digital Passport</Text>
              <Text style={styles.expandedSubtitle}>
                BOM, DPP & QR code
              </Text>
            </View>
            <ChevronRight size={14} color="#4b5563" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToRecentScans(100, (data) => {
      setScans(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = computeStats(scans);
  const totalValue = scans.reduce((s, sc) => s + (sc.recoveryValueUSD || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Dashboard' as never)}
            style={styles.backButton}
          >
            <ChevronLeft size={18} color="#9ca3af" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Passport Reports</Text>
            <Text style={styles.subtitle}>
              {loading
                ? 'Loading…'
                : `${scans.length} passport${
                    scans.length !== 1 ? 's' : ''
                  } generated`}
            </Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Recovery Value</Text>
            <Text style={styles.summaryValuePrimary}>
              ₹{totalValue.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Avg WRI</Text>
            <Text style={styles.summaryValueSecondary}>
              {scans.length > 0 ? stats.avgWRI : '—'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Grade A</Text>
            <View style={styles.summaryGradeRow}>
              <TrendingUp size={12} color="#22c55e" />
              <Text style={styles.summaryValueTertiary}>
                {scans.length > 0 ? `${stats.gradeAPct}%` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <Text style={styles.muted}>Loading history…</Text>
        ) : scans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No passports yet</Text>
            <Text style={styles.emptyBody}>
              Scan an industrial part to generate your first Digital Product
              Passport.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 8, paddingBottom: 16 }}>
            {scans.map((scan) => (
            <HistoryCard key={scan.id} scan={scan} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 16,
  },
  summary: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  summaryValuePrimary: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#fbbf24',
  },
  summaryValueSecondary: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#22c55e',
  },
  summaryGradeRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryValueTertiary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#111827',
  },
  muted: {
    marginTop: 16,
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#050816',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scanTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f9fafb',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  scanValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
  },
  scanSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  scanMetaAccent: {
    fontSize: 11,
    color: '#22c55e',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22c55e',
  },
  cardRight: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  expandedRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  expandedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  expandedItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  expandedIconBoxBlue: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  expandedIconBoxGreen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  expandedIconBoxAmber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  expandedTextCol: {
    flex: 1,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f9fafb',
  },
  expandedSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  emptyCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 16,
    backgroundColor: '#020617',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

