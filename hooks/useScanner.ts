import { BIN_CONFIG, type BinType } from "@/constants/bins";
import { scanWithGeminiVision } from "@/services/geminiVision";
import { saveScanHistory } from "@/services/history";
import { detectWithMLKit } from "@/services/mlkit";
import { saveScanResult } from "@/services/supabase";
import type {
  AccessibilitySettings,
  RecyclingRules,
  ScanResult,
} from "@/types";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useState } from "react";

// ML Kit confidence threshold — below this, escalate to Gemini Vision
const CONFIDENCE_THRESHOLD = 0.8;

export type ScanStage = "idle" | "detecting" | "analyzing" | "done";

type Bounds = { x: number; y: number; width: number; height: number };

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularize(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function toKeywords(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map(singularize)
    .filter(
      (token) =>
        token.length > 2 &&
        !["item", "local", "waste", "scrap"].includes(token),
    );
}

function normalizeBounds(
  bounds: Bounds | undefined,
  photoWidth: number,
  photoHeight: number,
): Bounds | null {
  if (!bounds) {
    return null;
  }

  const scaleX = photoWidth > 0 ? photoWidth : 1;
  const scaleY = photoHeight > 0 ? photoHeight : 1;

  return {
    x: Math.max(0, Math.min(1, bounds.x / scaleX)),
    y: Math.max(0, Math.min(1, bounds.y / scaleY)),
    width: Math.max(0, Math.min(1, bounds.width / scaleX)),
    height: Math.max(0, Math.min(1, bounds.height / scaleY)),
  };
}

function matchLabelToRules(
  label: string,
  rules: RecyclingRules,
): BinType | null {
  const normalizedLabel = normalizeText(label);
  const labelKeywords = toKeywords(label);

  const matchesEntry = (entry: string) => {
    const normalizedEntry = normalizeText(entry);
    if (
      normalizedLabel.includes(normalizedEntry) ||
      normalizedEntry.includes(normalizedLabel)
    ) {
      return true;
    }

    const entryKeywords = toKeywords(entry);
    return labelKeywords.some((keyword) => entryKeywords.includes(keyword));
  };

  if (rules.recycling.some(matchesEntry)) return "recycling";
  if (rules.trash.some(matchesEntry)) return "trash";
  if (rules.compost.some(matchesEntry)) return "compost";
  if (rules.hazardous.some(matchesEntry)) return "hazardous";

  return null;
}

async function fireFeedback(
  result: ScanResult,
  accessibility: AccessibilitySettings,
) {
  if (accessibility.haptics) {
    const pattern = BIN_CONFIG[result.binType].hapticPattern;
    if (pattern === "light") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (pattern === "medium") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }

  if (accessibility.autoSpeak) {
    Speech.speak(
      `${BIN_CONFIG[result.binType].ttsPrefix} ${result.item}. ${result.explanation}`,
    );
  }
}

export function useScanner(
  rules: RecyclingRules | null,
  accessibility: AccessibilitySettings,
  userId?: string,
) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<ScanStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const scan = async (imageUri: string, photoWidth = 1, photoHeight = 1) => {
    if (!rules || scanning) return;

    setScanning(true);
    setResult(null);
    setError(null);

    try {
      // ── Pass 1: ML Kit on-device (~50–200ms, free, offline) ──────────
      setStage("detecting");
      const mlResult = await detectWithMLKit(imageUri);

      if (mlResult && mlResult.confidence >= CONFIDENCE_THRESHOLD) {
        // High confidence — use ML Kit result directly
        const binType = matchLabelToRules(mlResult.label, rules) ?? "unknown";
        const finalResult: ScanResult = {
          item: mlResult.label.replace(/(^\w|\s\w)/g, (c) => c.toUpperCase()),
          binType,
          confidence: mlResult.confidence,
          explanation:
            binType === "unknown"
              ? `Item detected but not matched to ${rules.city} rules. Check local guidelines.`
              : `Detected on-device. Put this in the ${BIN_CONFIG[binType].label.toLowerCase()}.`,
          source: "mlkit",
          timestamp: Date.now(),
        };

        setBounds(normalizeBounds(mlResult.bounds, photoWidth, photoHeight));
        setResult(finalResult);
        setStage("done");
        await saveScanHistory(finalResult);
        await saveScanResult(finalResult, userId);
        await fireFeedback(finalResult, accessibility);
        return finalResult;
      }

      // ── Pass 2: Gemini Vision (~1–2s, uses API key) ──────────────────
      // Triggered when ML Kit returns null OR confidence < 0.8
      // Keep ML Kit's bounding box even if it couldn't classify
      if (mlResult?.bounds) {
        setBounds(normalizeBounds(mlResult.bounds, photoWidth, photoHeight));
      }
      setStage("analyzing");
      const geminiResult = await scanWithGeminiVision(
        imageUri,
        rules,
        mlResult?.label || undefined, // pass hint only if label exists
      );

      // Prefer ML Kit bounds (pixel-accurate) over Gemini's estimated bounds
      setBounds(
        normalizeBounds(mlResult?.bounds, photoWidth, photoHeight) ??
          geminiResult.bounds ??
          null,
      );

      if (geminiResult.source === "fallback") {
        setError("Gemini Vision failed — returned fallback result");
      }

      setResult(geminiResult);
      setStage("done");
      await saveScanHistory(geminiResult);
      await saveScanResult(geminiResult, userId);
      await fireFeedback(geminiResult, accessibility);
      return geminiResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setBounds(null);
    setError(null);
    setStage("idle");
  };

  return { result, bounds, scanning, stage, error, scan, reset };
}
