import { Colors, Radii } from "@/constants/Colors";
import { BIN_CONFIG } from "@/constants/bins";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAccessibility } from "@/hooks/useAccessibility";
import { useRecyclingRules } from "@/hooks/useRecyclingRules";
import { useScanner } from "@/hooks/useScanner";
import { useSession } from "@/hooks/useSession";
import { Ionicons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScannerScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [facing] = useState<CameraType>("back");

  const { user } = useSession();
  const { rules } = useRecyclingRules();
  const { settings: accessibility } = useAccessibility();
  const { result, scanning, scan, reset } = useScanner(
    rules,
    accessibility,
    user?.id
  );

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isCameraReady || !isScanning || scanning) return;

    const interval = setInterval(() => {
      void handleScan();
    }, 4000);

    return () => clearInterval(interval);
  }, [isCameraReady, isScanning, scanning]);

  const handleScan = async () => {
    if (!cameraRef.current || scanning) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });

      if (!photo?.uri) return;
      await scan(photo.uri);
    } catch (error) {
      console.log("Scan error:", error);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.helperText}>Loading camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={Colors.primary} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.helperText}>
          VirtuCycle needs camera access to scan items and identify the correct
          bin.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const binCfg = result ? BIN_CONFIG[result.binType] : null;

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onCameraReady={() => setIsCameraReady(true)}
      />

      <View style={styles.overlay}>
        <View style={styles.resultCard}>
          {scanning ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={Colors.onPrimary} />
              <Text style={styles.scanningText}>Analyzing item...</Text>
            </View>
          ) : result && binCfg ? (
            <>
              <View style={[styles.binBadge, { backgroundColor: binCfg.color }]}>
                <Ionicons name={binCfg.icon as any} size={20} color="#fff" />
                <Text style={styles.binLabel}>{binCfg.label}</Text>
              </View>
              <Text style={styles.itemName}>{result.item}</Text>
              <Text style={styles.explanation}>{result.explanation}</Text>
            </>
          ) : (
            <Text style={styles.idleText}>
              {isCameraReady
                ? isScanning
                  ? "Point at an item to scan automatically"
                  : "Scanning paused"
                : "Starting camera..."}
            </Text>
          )}
        </View>

        <View style={styles.controls}>
          {result && (
            <Pressable style={styles.resetBtn} onPress={reset}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={Colors.primary}
              />
              <Text style={styles.resetText}>Scan Again</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isScanning
                ? "Pause automatic scanning"
                : "Resume automatic scanning"
            }
            onPress={() => setIsScanning((prev) => !prev)}
            style={[styles.toggleBtn, !isScanning && styles.toggleBtnPaused]}
          >
            <Ionicons
              name={isScanning ? "pause" : "play"}
              size={18}
              color="#fff"
            />
            <Text style={styles.toggleText}>
              {isScanning ? "Pause" : "Resume"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 40,
    gap: 12,
  },
  resultCard: {
    backgroundColor: "rgba(17, 22, 12, 0.82)",
    borderRadius: Radii.md,
    padding: 20,
    gap: 10,
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  scanningText: {
    color: "#fff",
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
  },
  binBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  binLabel: {
    color: "#fff",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodySm,
  },
  itemName: {
    color: "#fff",
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleMd,
  },
  explanation: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodySm,
    lineHeight: 20,
  },
  idleText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: Radii.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resetText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodySm,
    color: Colors.primary,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toggleBtnPaused: {
    backgroundColor: Colors.outline,
  },
  toggleText: {
    color: "#fff",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodySm,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: Colors.background,
    gap: 16,
  },
  permissionTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.titleLg,
    color: Colors.primary,
    textAlign: "center",
  },
  helperText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
    textAlign: "center",
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
    color: "#fff",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: TypeScale.bodyMd,
  },
});