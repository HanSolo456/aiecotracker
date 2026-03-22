import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Leaf,
  ScanLine,
  Activity,
  TrendingUp,
  Zap,
  ShieldCheck,
  Clock3,
  ChevronRight,
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

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToRecentScans(50, (data) => {
      setScans(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = computeStats(scans);
  const recentThree = scans.slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#020617"
        translucent={false}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      {/* Header - matches web */}
      <View style={styles.headerTop}>
        <View style={styles.brandLeft}>
          <View style={styles.logoBox}>
            <Leaf size={16} color="#020617" />
          </View>
          <Text style={styles.brandText}>AI‑EcoTrack</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>System Online</Text>
        </View>
      </View>

      <Text style={styles.headerTitle}>
        Reverse Manufacturing{'\n'}
        <Text style={styles.headerTitleAccent}>Command Centre</Text>
      </Text>

      {/* Hero scan CTA card */}
      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Scan' as never)}
      >
        <View style={styles.heroIconRow}>
          <View style={styles.heroIconBox}>
            <ScanLine size={18} color="#22c55e" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadge}>AI‑Powered</Text>
            <Text style={styles.heroTitle}>Identify Industrial Part</Text>
          </View>
        </View>
        <Text style={styles.heroBody}>
          Point camera at any industrial component. Get instant disassembly guide, safety
          protocols, and Digital Product Passport.
        </Text>
        <View style={styles.heroButton}>
          <ScanLine size={16} color="#020617" />
          <Text style={styles.heroButtonText}>Start Scanning</Text>
        </View>
      </TouchableOpacity>

      {/* KPI cards row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconBox}>
            <Activity size={14} color="#22c55e" />
          </View>
          <Text style={styles.kpiValue}>
            {loading ? '—' : stats.scannedToday}
          </Text>
          <Text style={styles.kpiLabel}>Parts Scanned Today</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconBox}>
            <TrendingUp size={14} color="#facc15" />
          </View>
          <Text style={styles.kpiValue}>
            {loading || scans.length === 0 ? '—' : stats.avgWRI}
          </Text>
          <Text style={styles.kpiLabel}>Avg. WRI Score</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiIconBox}>
            <Zap size={14} color="#60a5fa" />
          </View>
          <Text style={styles.kpiValue}>
            {loading ? '—' : `₹${stats.totalValueUSD}`}
          </Text>
          <Text style={styles.kpiLabel}>Recovery Value</Text>
        </View>
      </View>

      {/* Safety banner */}
      <View style={styles.safetyCard}>
        <View style={styles.safetyIconBox}>
          <ShieldCheck size={16} color="#22c55e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.safetyTitle}>Safety Protocol Coverage: 99%</Text>
          <Text style={styles.safetySubtitle}>
            OSHA · REACH · ATEX · RoHS compliant
          </Text>
        </View>
        <Text style={styles.safetyStatus}>✓ Active</Text>
      </View>

      {/* Recent passports */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Passports</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History' as never)}>
          <View style={styles.sectionLinkRow}>
            <Text style={styles.sectionLinkText}>View all</Text>
            <ChevronRight size={12} color="#9ca3af" />
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : recentThree.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>
            Scan your first industrial part to see it here.
          </Text>
        </View>
      ) : (
        recentThree.map((scan) => (
          <TouchableOpacity key={scan.id} activeOpacity={0.85}>
            <View style={styles.scanCard}>
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
                <Text style={styles.scanTitle} numberOfLines={1}>
                  {scan.partName}
                </Text>
                <Text style={styles.scanSub} numberOfLines={1}>
                  {MATERIAL_LABELS[scan.material] ?? scan.material}
                </Text>
                <View style={styles.scanMetaRow}>
                  <View style={styles.scanMetaLeft}>
                    <Clock3 size={11} color="#6b7280" />
                    <Text style={styles.scanMeta}>
                      {relativeTime(scan.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.scanMetaAccent}>WRI {scan.wriScore}</Text>
                  <Text style={styles.scanMetaValue}>
                    ₹{scan.recoveryValueUSD}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#4b5563" />
            </View>
          </TouchableOpacity>
        ))
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#9ca3af',
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  statusText: {
    fontSize: 11,
    color: '#bbf7d0',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 16,
  },
  headerTitleAccent: {
    color: '#22c55e',
  },
  heroCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#16a34a33',
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroIcon: {
    fontSize: 18,
    color: '#22c55e',
  },
  heroBadge: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  heroBody: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 14,
  },
  heroButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#020617',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: '#0b1120',
  },
  kpiIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#020617',
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: '#111827',
    marginBottom: 16,
  },
  safetyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#022c22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f9fafb',
  },
  safetySubtitle: {
    fontSize: 11,
    color: '#9ca3af',
  },
  safetyStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  sectionHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  sectionLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLinkText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  muted: {
    fontSize: 12,
    color: '#6b7280',
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: '#111827',
    marginBottom: 10,
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
  scanSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  scanMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  scanMetaLeft: {
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
  scanMetaValue: {
    fontSize: 11,
    color: '#facc15',
  },
  emptyCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 14,
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

