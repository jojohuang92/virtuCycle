import { Colors, Radii } from '@/constants/Colors';
import { BIN_CONFIG } from '@/constants/bins';
import { FontFamily, TypeScale } from '@/constants/typography';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useRecyclingRules } from '@/hooks/useRecyclingRules';
import { useScanner } from '@/hooks/useScanner';
import { useSession } from '@/hooks/useSession';
import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScannerScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
  const [torch, setTorch] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const { user } = useSession();
  const { rules } = useRecyclingRules();
  const { settings: accessibility } = useAccessibility();
  const { result, bounds, scanning, stage, error, scan, reset } = useScanner(rules, accessibility, user?.id);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  useEffect(() => {
    if (scanning) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    scanLineAnim.setValue(0);
  }, [scanning]);

  const handleCapture = async () => {
    if (!cameraRef.current || scanning || !isCameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      await scan(photo.uri, photo.width, photo.height);
    } catch (e) {
      console.log('[Scanner] Capture error:', e);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.helperText}>Loading camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={Colors.primary} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.helperText}>
          VirtuCycle needs camera access to scan items and identify the correct bin.
        </Text>
        <Pressable accessibilityRole="button" onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const binCfg = result ? BIN_CONFIG[result.binType] : null;

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, viewSize.height * 0.6],
  });

  return (
    <View style={styles.container}>

      {/* ── Camera feed ── */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'back' as CameraType}
        enableTorch={torch}
        onCameraReady={() => setIsCameraReady(true)}
        onLayout={(e: LayoutChangeEvent) =>
          setViewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
        }
      />

      {/* ── Bounding box with label tag ── */}
      {bounds && result && (
        <View
          pointerEvents="none"
          style={[
            styles.boundingBox,
            {
              left:   bounds.x * viewSize.width,
              top:    bounds.y * viewSize.height,
              width:  bounds.width  * viewSize.width,
              height: bounds.height * viewSize.height,
            },
          ]}
        >
          <View style={styles.boundingTag}>
            <Text style={styles.boundingTagText} numberOfLines={1}>
              {result.item.toUpperCase()}  {Math.round(result.confidence * 100)}%
            </Text>
          </View>
        </View>
      )}

      {/* ── Scan line animation ── */}
      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
        />
      )}

      {/* ── Top bar ── */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable style={styles.topBtn} onPress={reset} accessibilityLabel="Reset scan">
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE DETECTION</Text>
        </View>

        <Pressable style={styles.topBtn} onPress={() => setTorch(t => !t)} accessibilityLabel="Toggle torch">
          <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color="#fff" />
        </Pressable>
      </SafeAreaView>

      {/* ── Viewfinder corner brackets (idle only) ── */}
      {!result && !scanning && (
        <View style={styles.viewfinder} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      )}

      {/* ── Result bottom sheet ── */}
      {result && binCfg ? (
        <View style={styles.bottomSheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.scanCompleteLabel}>Scanning Complete</Text>
              <Text style={styles.itemTitle} numberOfLines={2}>{result.item}</Text>
            </View>
            <View style={styles.matchBadge}>
              <Text style={styles.matchLabel}>Match</Text>
              <Text style={styles.matchValue}>{Math.round(result.confidence * 100)}%</Text>
            </View>
          </View>

          <View style={styles.binCard}>
            <View style={[styles.binIconBox, { backgroundColor: binCfg.color }]}>
              <Ionicons name={binCfg.icon as any} size={34} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.binCardLabel}>Recycle Target</Text>
              <Text style={styles.binCardName}>{binCfg.label.toUpperCase()}</Text>
              <Text style={styles.binCardDesc}>{result.explanation}</Text>
            </View>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryBtn} onPress={reset}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
            </Pressable>
            <View style={styles.sourcePill}>
              <Text style={styles.sourcePillText}>{result.source}</Text>
            </View>
          </View>
        </View>

      ) : scanning ? (
        /* ── Scanning mini-sheet ── */
        <View style={styles.scanningSheet}>
          <View style={styles.handle} />
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.scanningText}>
              {stage === 'detecting' ? 'Detecting with ML Kit…' : 'Analyzing with Gemini Vision…'}
            </Text>
          </View>
        </View>

      ) : (
        /* ── Idle shutter button ── */
        <View style={styles.shutterArea}>
          <Pressable
            style={[styles.shutterBtn, !isCameraReady && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={!isCameraReady}
            accessibilityRole="button"
            accessibilityLabel="Capture and scan item"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: Radii.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#fff',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },

  // ── Viewfinder corners ────────────────────────────────────────────────────
  viewfinder: {
    position: 'absolute',
    top: '18%',
    left: '8%',
    right: '8%',
    bottom: '26%',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: '#fff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  // ── Error text ─────────────────────────────────────────────────────────────
  errorText: {
    color: '#ba1a1a',
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: 'rgba(186,26,26,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // ── Bounding box ──────────────────────────────────────────────────────────
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#c3cc8c',
    borderRadius: 8,
  },
  boundingTag: {
    position: 'absolute',
    top: -1,
    left: -1,
    backgroundColor: 'rgba(195, 204, 140, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  boundingTagText: {
    color: '#343c0a',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Scan line ─────────────────────────────────────────────────────────────
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(195, 204, 140, 0.5)',
  },

  // ── Result bottom sheet ───────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(249, 249, 254, 0.97)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 44,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scanCompleteLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.primary,
    opacity: 0.55,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  itemTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 34,
    color: '#1a1c1f',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  matchBadge: {
    backgroundColor: '#dde5ad',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 72,
  },
  matchLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: '#5b6236',
    textTransform: 'uppercase',
  },
  matchValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    color: '#5b6236',
  },
  binCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#1a1c1f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  binIconBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  binCardLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#77786b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  binCardName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: '#1a1c1f',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  binCardDesc: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: '#47483c',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1,
    height: 62,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyMd,
  },
  sourcePill: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#dde5ad',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcePillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    color: '#5b6236',
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },

  // ── Scanning mini-sheet ───────────────────────────────────────────────────
  scanningSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(249, 249, 254, 0.97)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 44,
    gap: 12,
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  scanningText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: '#1a1c1f',
  },

  // ── Shutter ───────────────────────────────────────────────────────────────
  shutterArea: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },

  // ── Permission / loading ──────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
    gap: 16,
  },
  permissionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: Colors.primary,
    textAlign: 'center',
  },
  helperText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radii.full,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodyMd,
  },
});
