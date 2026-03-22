import { Colors, Radii } from "@/constants/Colors";
import { BIN_CONFIG } from "@/constants/bins";
import { FontFamily, TypeScale } from "@/constants/typography";
import { useAccessibility } from "@/hooks/useAccessibility";
import { useRecyclingRules } from "@/hooks/useRecyclingRules";
import { useScanner } from "@/hooks/useScanner";
import { useSession } from "@/hooks/useSession";
import {
  createDetectObjectsPlugin,
  type VisionDetectedObject,
} from "@/services/visionObjectDetection";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  type Orientation,
} from "react-native-vision-camera";
import { Worklets } from "react-native-worklets-core";

const LIVE_MIN_CONFIDENCE = 0.45;
const SHEET_DISMISS_THRESHOLD = 120;
const LIVE_FRAME_PROCESSOR_FPS = 12;

type NormalizedBox = {
  id: string;
  label: string;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
};

function rotateRectToPreview(
  rect: Rect,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
): { rect: Rect; width: number; height: number } {
  const left = rect.x;
  const top = rect.y;
  const width = rect.width;
  const height = rect.height;

  switch (orientation) {
    case "landscape-left":
      return {
        rect: {
          x: top,
          y: frameWidth - (left + width),
          width: height,
          height: width,
        },
        width: frameHeight,
        height: frameWidth,
      };
    case "landscape-right":
      return {
        rect: {
          x: frameHeight - (top + height),
          y: left,
          width: height,
          height: width,
        },
        width: frameHeight,
        height: frameWidth,
      };
    case "portrait-upside-down":
      return {
        rect: {
          x: frameWidth - (left + width),
          y: frameHeight - (top + height),
          width,
          height,
        },
        width: frameWidth,
        height: frameHeight,
      };
    case "portrait":
    default:
      return {
        rect: { x: left, y: top, width, height },
        width: frameWidth,
        height: frameHeight,
      };
  }
}

function projectRectToView(
  rect: Rect,
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
): Rect {
  const safeSourceWidth = sourceWidth > 0 ? sourceWidth : 1;
  const safeSourceHeight = sourceHeight > 0 ? sourceHeight : 1;
  const safeViewWidth = viewWidth > 0 ? viewWidth : 1;
  const safeViewHeight = viewHeight > 0 ? viewHeight : 1;

  const scale = Math.max(
    safeViewWidth / safeSourceWidth,
    safeViewHeight / safeSourceHeight,
  );
  const scaledWidth = safeSourceWidth * scale;
  const scaledHeight = safeSourceHeight * scale;
  const offsetX = (safeViewWidth - scaledWidth) / 2;
  const offsetY = (safeViewHeight - scaledHeight) / 2;

  return {
    x: offsetX + rect.x * scale,
    y: offsetY + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function normalizeFrameDetection(
  detection: VisionDetectedObject,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
  viewWidth: number,
  viewHeight: number,
  index: number,
): NormalizedBox | null {
  const label = detection.labels[0]?.text?.trim() || "Object";
  const confidence = detection.labels[0]?.confidence ?? 0;
  const rotated = rotateRectToPreview(
    {
      x: detection.bounds.left,
      y: detection.bounds.top,
      width: detection.bounds.width,
      height: detection.bounds.height,
    },
    frameWidth,
    frameHeight,
    orientation,
  );
  const projected = projectRectToView(
    rotated.rect,
    rotated.width,
    rotated.height,
    viewWidth,
    viewHeight,
  );

  const safeViewWidth = viewWidth > 0 ? viewWidth : 1;
  const safeViewHeight = viewHeight > 0 ? viewHeight : 1;

  const normalizedBounds = {
    x: projected.x / safeViewWidth,
    y: projected.y / safeViewHeight,
    width: projected.width / safeViewWidth,
    height: projected.height / safeViewHeight,
  };

  return {
    id: `${detection.trackingId ?? label}-${index}`,
    label,
    confidence,
    bounds: normalizedBounds,
  };
}

function isInsideViewfinder(bounds: NormalizedBox["bounds"]) {
  const zone = { left: 0.08, right: 0.92, top: 0.18, bottom: 0.74 };
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return (
    centerX >= zone.left &&
    centerX <= zone.right &&
    centerY >= zone.top &&
    centerY <= zone.bottom
  );
}

export default function ScannerScreen() {
  const cameraRef = useRef<Camera | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
  const [torch, setTorch] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [liveDetections, setLiveDetections] = useState<NormalizedBox[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(
    null,
  );
  const [capturedDetection, setCapturedDetection] =
    useState<NormalizedBox | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  const { user } = useSession();
  const { rules } = useRecyclingRules();
  const { settings: accessibility } = useAccessibility();
  const { result, bounds, scanning, stage, error, scan, reset } = useScanner(
    rules,
    accessibility,
    user?.id,
  );
  const detectionPlugin = useMemo(() => createDetectObjectsPlugin(), []);

  const publishDetections = useMemo(
    () =>
      Worklets.createRunOnJS(
        (
          detections: VisionDetectedObject[],
          frameWidth: number,
          frameHeight: number,
          orientation: Orientation,
        ) => {
          const nextDetections = detections
            .map((detection, index) =>
              normalizeFrameDetection(
                detection,
                frameWidth,
                frameHeight,
                orientation,
                viewSize.width,
                viewSize.height,
                index,
              ),
            )
            .filter((detection): detection is NormalizedBox =>
              Boolean(detection),
            )
            .filter((detection) => detection.confidence >= LIVE_MIN_CONFIDENCE)
            .filter((detection) => isInsideViewfinder(detection.bounds))
            .sort((left, right) => right.confidence - left.confidence)
            .slice(0, 3);

          setLiveDetections(nextDetections);
        },
      ),
    [viewSize.height, viewSize.width],
  );

  const clearDetections = useMemo(
    () => Worklets.createRunOnJS(() => setLiveDetections([])),
    [],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      runAtTargetFps(LIVE_FRAME_PROCESSOR_FPS, () => {
        "worklet";

        const detections = detectionPlugin.detectObjects(frame);
        if (!detections.length) {
          clearDetections();
          return;
        }

        publishDetections(
          detections,
          frame.width,
          frame.height,
          frame.orientation,
        );
      });
    },
    [detectionPlugin, publishDetections, clearDetections],
  );

  const resultOverlayBounds = useMemo(() => {
    if (bounds && capturedPhoto) {
      return {
        x: bounds.x * viewSize.width,
        y: bounds.y * viewSize.height,
        width: bounds.width * viewSize.width,
        height: bounds.height * viewSize.height,
      };
    }

    if (capturedDetection) {
      return {
        x: capturedDetection.bounds.x * viewSize.width,
        y: capturedDetection.bounds.y * viewSize.height,
        width: capturedDetection.bounds.width * viewSize.width,
        height: capturedDetection.bounds.height * viewSize.height,
      };
    }

    return null;
  }, [
    bounds,
    capturedDetection,
    capturedPhoto,
    viewSize.height,
    viewSize.width,
  ]);

  const handleReset = () => {
    setLiveDetections([]);
    setLivePaused(false);
    setCapturedPhoto(null);
    setCapturedDetection(null);
    sheetTranslateY.setValue(0);
    reset();
  };

  const dismissSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      handleReset();
    });
  };

  const resultSheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        gestureState.dy > 8 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_event, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (
          gestureState.dy > SHEET_DISMISS_THRESHOLD ||
          gestureState.vy > 1.1
        ) {
          dismissSheet();
          return;
        }

        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (result) {
      sheetTranslateY.setValue(0);
    }
  }, [result, sheetTranslateY]);

  useEffect(() => {
    if (scanning) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    scanLineAnim.setValue(0);
  }, [scanning]);

  useEffect(() => {
    if (livePaused || scanning || result) {
      setLiveDetections([]);
    }
  }, [livePaused, scanning, result]);

  const handleCapture = async () => {
    if (!cameraRef.current || scanning || !isCameraReady) return;
    try {
      const primaryDetection = liveDetections[0] ?? null;
      setLivePaused(true);
      setCapturedDetection(primaryDetection);
      setLiveDetections([]);
      const snapshot = await cameraRef.current.takeSnapshot({
        quality: 100,
      });
      const snapshotUri = snapshot.path.startsWith("file://")
        ? snapshot.path
        : `file://${snapshot.path}`;
      setCapturedPhoto({
        uri: snapshotUri,
        width: snapshot.width,
        height: snapshot.height,
      });
      const scanResult = await scan(
        snapshotUri,
        snapshot.width,
        snapshot.height,
      );
      if (!scanResult) {
        setLivePaused(false);
        setCapturedPhoto(null);
        setCapturedDetection(null);
      }
    } catch (e) {
      setLivePaused(false);
      setCapturedPhoto(null);
      setCapturedDetection(null);
      console.log("[Scanner] Capture error:", e);
    }
  };

  if (!device) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.helperText}>Loading camera…</Text>
      </View>
    );
  }

  if (!hasPermission) {
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

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, viewSize.height * 0.6],
  });

  return (
    <View style={styles.container}>
      {/* ── Camera feed ── */}
      {capturedPhoto ? (
        <Image
          source={{ uri: capturedPhoto.uri }}
          style={styles.camera}
          resizeMode="cover"
          onLayout={(e: LayoutChangeEvent) =>
            setViewSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        />
      ) : (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={true}
          photo={true}
          video={true}
          outputOrientation="preview"
          torch={torch ? "on" : "off"}
          frameProcessor={
            livePaused || scanning || Boolean(result)
              ? undefined
              : frameProcessor
          }
          pixelFormat="yuv"
          onInitialized={() => setIsCameraReady(true)}
          onLayout={(e: LayoutChangeEvent) =>
            setViewSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        />
      )}

      {/* ── Bounding boxes ── */}
      {result && resultOverlayBounds ? (
        <View
          pointerEvents="none"
          style={[
            styles.boundingBox,
            {
              left: resultOverlayBounds.x,
              top: resultOverlayBounds.y,
              width: resultOverlayBounds.width,
              height: resultOverlayBounds.height,
            },
          ]}
        >
          <View style={styles.boundingTag}>
            <Text style={styles.boundingTagText} numberOfLines={1}>
              {result.item.toUpperCase()} {Math.round(result.confidence * 100)}%
            </Text>
          </View>
        </View>
      ) : (
        liveDetections.map((detection) => (
          <View
            key={detection.id}
            pointerEvents="none"
            style={[
              styles.boundingBox,
              {
                left: detection.bounds.x * viewSize.width,
                top: detection.bounds.y * viewSize.height,
                width: detection.bounds.width * viewSize.width,
                height: detection.bounds.height * viewSize.height,
              },
            ]}
          >
            <View style={styles.boundingTag}>
              <Text style={styles.boundingTagText} numberOfLines={1}>
                {detection.label.toUpperCase()}{" "}
                {Math.round(detection.confidence * 100)}%
              </Text>
            </View>
          </View>
        ))
      )}

      {/* ── Scan line animation ── */}
      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]}
        />
      )}

      {/* ── Top bar ── */}
      <SafeAreaView style={styles.topBar} edges={["top"]}>
        <Pressable
          style={styles.topBtn}
          onPress={handleReset}
          accessibilityLabel="Reset scan"
        >
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE DETECTION</Text>
        </View>

        <Pressable
          style={styles.topBtn}
          onPress={() => setTorch((t) => !t)}
          accessibilityLabel="Toggle torch"
        >
          <Ionicons
            name={torch ? "flash" : "flash-outline"}
            size={20}
            color="#fff"
          />
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
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
          {...resultSheetPanResponder.panHandlers}
        >
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.scanCompleteLabel}>Scanning Complete</Text>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {result.item}
              </Text>
            </View>
            <View style={styles.matchBadge}>
              <Text style={styles.matchLabel}>Match</Text>
              <Text style={styles.matchValue}>
                {Math.round(result.confidence * 100)}%
              </Text>
            </View>
          </View>

          <View style={styles.binCard}>
            <View
              style={[styles.binIconBox, { backgroundColor: binCfg.color }]}
            >
              <Ionicons name={binCfg.icon as any} size={34} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.binCardLabel}>Recycle Target</Text>
              <Text style={styles.binCardName}>
                {binCfg.label.toUpperCase()}
              </Text>
              <Text style={styles.binCardDesc}>{result.explanation}</Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryBtn} onPress={handleReset}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
            </Pressable>
            <View style={styles.sourcePill}>
              <Text style={styles.sourcePillText}>{result.source}</Text>
            </View>
          </View>
        </Animated.View>
      ) : scanning ? (
        /* ── Scanning mini-sheet ── */
        <View style={styles.scanningSheet}>
          <View style={styles.handle} />
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.scanningText}>
              {stage === "detecting"
                ? "Detecting with ML Kit…"
                : "Analyzing with Gemini Vision…"}
            </Text>
          </View>
        </View>
      ) : (
        /* ── Idle shutter button ── */
        <View style={styles.shutterArea}>
          <Text style={styles.liveHelperText}>
            ML Kit is scanning live inside the guide. Tap to classify the
            current item.
          </Text>
          <Pressable
            style={[
              styles.shutterBtn,
              !isCameraReady && styles.shutterDisabled,
            ]}
            onPress={handleCapture}
            disabled={!isCameraReady}
            accessibilityRole="button"
            accessibilityLabel="Capture and classify item"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: Radii.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  liveText: {
    color: "#fff",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },

  // ── Viewfinder corners ────────────────────────────────────────────────────
  viewfinder: {
    position: "absolute",
    top: "18%",
    left: "8%",
    right: "8%",
    bottom: "26%",
  },
  corner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: "#fff",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },

  // ── Error text ─────────────────────────────────────────────────────────────
  errorText: {
    color: "#ba1a1a",
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: "rgba(186,26,26,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // ── Bounding box ──────────────────────────────────────────────────────────
  boundingBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#c3cc8c",
    borderRadius: 8,
  },
  boundingTag: {
    position: "absolute",
    top: -1,
    left: -1,
    backgroundColor: "rgba(195, 204, 140, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  boundingTagText: {
    color: "#343c0a",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Scan line ─────────────────────────────────────────────────────────────
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(195, 204, 140, 0.5)",
  },

  // ── Result bottom sheet ───────────────────────────────────────────────────
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(249, 249, 254, 0.97)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 44,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  scanCompleteLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.primary,
    opacity: 0.55,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  itemTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: 34,
    color: "#1a1c1f",
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  matchBadge: {
    backgroundColor: "#dde5ad",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 72,
  },
  matchLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#5b6236",
    textTransform: "uppercase",
  },
  matchValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    color: "#5b6236",
  },
  binCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#1a1c1f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  binIconBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  binCardLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: "#77786b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  binCardName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: "#1a1c1f",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  binCardDesc: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: "#47483c",
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  primaryBtn: {
    flex: 1,
    height: 62,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.bodyMd,
  },
  sourcePill: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#dde5ad",
    alignItems: "center",
    justifyContent: "center",
  },
  sourcePillText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 9,
    color: "#5b6236",
    textTransform: "capitalize",
    letterSpacing: 0.5,
  },

  // ── Scanning mini-sheet ───────────────────────────────────────────────────
  scanningSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(249, 249, 254, 0.97)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 44,
    gap: 12,
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    paddingVertical: 10,
  },
  scanningText: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: "#1a1c1f",
  },

  // ── Shutter ───────────────────────────────────────────────────────────────
  shutterArea: {
    position: "absolute",
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 14,
  },
  liveHelperText: {
    maxWidth: 260,
    color: "#fff",
    textAlign: "center",
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: "rgba(0,0,0,0.32)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },

  // ── Permission / loading ──────────────────────────────────────────────────
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
