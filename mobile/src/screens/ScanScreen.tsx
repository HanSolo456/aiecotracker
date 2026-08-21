import React, { useState } from 'react';
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
  Camera,
  FlaskConical,
  Layers,
  Upload,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ScanScreen() {
  const navigation = useNavigation();
  const [angleImages, setAngleImages] = useState<(string | null)[]>([
    null,
    null,
    null,
  ]);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  const handleCameraPress = async (index: number) => {
    await requestPermissions();
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setAngleImages((prev) => {
        const next = [...prev];
        next[index] = uri;
        return next;
      });
    }
  };

  const handleUploadPress = async (index: number) => {
    await requestPermissions();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setAngleImages((prev) => {
        const next = [...prev];
        next[index] = uri;
        return next;
      });
    }
  };

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
            onPress={() => navigation.navigate('Dashboard' as never)}
            style={styles.backButton}
          >
            <ChevronLeft size={18} color="#9ca3af" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Multi‑View Scan</Text>
            <Text style={styles.headerSubtitle}>
              Up to 3 angles → merged AI analysis
            </Text>
          </View>
        </View>

        {/* Photo angles */}
        <Text style={styles.sectionLabel}>Photo Angles</Text>
        <View style={styles.anglesRow}>
          {['Front View', 'Side View', 'Top / Detail'].map((label, idx) => (
            <View key={label} style={styles.angleCard}>
              <Text style={styles.angleLabel}>{label}</Text>
              <View style={styles.angleButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.angleCamButton}
                  onPress={() => handleCameraPress(idx)}
                >
                  <Camera size={16} color="#22c55e" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.angleUploadButton}
                  onPress={() => handleUploadPress(idx)}
                >
                  <Upload size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {!!angleImages[idx] && (
                <Text style={styles.angleSelectedText}>Image selected</Text>
              )}
            </View>
          ))}
        </View>
        <Text style={styles.anglesHint}>
          More angles = higher confidence. Minimum 1 required.
        </Text>

        {/* Demo scan */}
        <TouchableOpacity activeOpacity={0.9} style={styles.demoButton}>
          <FlaskConical size={16} color="#22c55e" />
          <Text style={styles.demoText}>Run Demo Scan (Gate Valve DN100)</Text>
        </TouchableOpacity>

        {/* Golden thread flow */}
        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Golden Thread Flow</Text>
          {[
            'Capture 1–3 angle photos',
            'Parallel Qwen/Gemini VLM per angle',
            'Merge results → highest confidence',
            'Safety Gatekeeper rule engine',
            'RAG disassembly guide retrieval',
            'Digital Product Passport generation',
          ].map((step, index) => (
            <View key={step} style={styles.flowRow}>
              <View style={styles.flowIndex}>
                <Text style={styles.flowIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.flowText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Placeholder analyse CTA matching web (no logic yet) */}
        <TouchableOpacity activeOpacity={0.9} style={styles.analyseButton}>
          <Layers size={16} color="#020617" />
          <Text style={styles.analyseText}>Analyse angles with AI</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
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
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
    marginBottom: 8,
  },
  anglesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  angleCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    alignItems: 'center',
  },
  angleLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 10,
  },
  angleButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  angleCamButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  angleUploadButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  angleSelectedText: {
    marginTop: 6,
    fontSize: 10,
    color: '#22c55e',
  },
  anglesHint: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 16,
  },
  demoButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(34,197,94,0.5)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  demoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  flowCard: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#050816',
    borderWidth: 1,
    borderColor: '#111827',
    marginBottom: 16,
  },
  flowTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  flowIndex: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  flowIndexText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
  },
  flowText: {
    fontSize: 12,
    color: '#e5e7eb',
  },
  analyseButton: {
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#22c55e',
  },
  analyseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#020617',
  },
});

