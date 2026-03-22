import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ChevronLeft, BookOpen } from 'lucide-react-native';
import type { ScanRecord } from '../services/scanService';

type GuideRoute = RouteProp<{ Guide: { scan: ScanRecord } }, 'Guide'>;

export default function GuideScreen() {
  const navigation = useNavigation();
  const route = useRoute<GuideRoute>();
  const scan = route.params?.scan;

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
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={18} color="#9ca3af" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Disassembly Guide</Text>
            <Text style={styles.subtitle}>
              Placeholder mobile guide view
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconPill}>
              <BookOpen size={14} color="#22c55e" />
            </View>
            <Text style={styles.cardLabel}>Selected Part</Text>
          </View>
          <Text style={styles.partName}>{scan.partName}</Text>
          <Text style={styles.partSubtype}>
            A detailed step‑by‑step disassembly guide will be implemented
            here, mirroring the web version.
          </Text>
        </View>
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
    padding: 16,
    backgroundColor: '#050816',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  partName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  partSubtype: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    lineHeight: 18,
  },
});

