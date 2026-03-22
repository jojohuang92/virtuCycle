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

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error_description?: unknown;
    };

    const parts = [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.error_description,
      candidate.code,
    ].filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return "Something went wrong while processing the scan.";
}

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

function scoreRuleMatch(label: string, entry: string): number {
  const normalizedLabel = normalizeText(label);
  const normalizedEntry = normalizeText(entry);
  const labelKeywords = toKeywords(label);
  const entryKeywords = toKeywords(entry);

  if (!normalizedLabel || !normalizedEntry) {
    return 0;
  }

  if (normalizedLabel === normalizedEntry) {
    return 1;
  }

  if (
    normalizedLabel.includes(normalizedEntry) ||
    normalizedEntry.includes(normalizedLabel)
  ) {
    return 0.92;
  }

  const overlapCount = labelKeywords.filter((keyword) =>
    entryKeywords.includes(keyword),
  ).length;

  if (!overlapCount) {
    return 0;
  }

  const keywordCoverage = overlapCount / Math.max(labelKeywords.length, 1);
  const entryCoverage = overlapCount / Math.max(entryKeywords.length, 1);
  return keywordCoverage * 0.65 + entryCoverage * 0.35;
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
  const categories: Array<[BinType, string[]]> = [
    ["recycling", rules.recycling],
    ["trash", rules.trash],
    ["compost", rules.compost],
    ["hazardous", rules.hazardous],
  ];

  let bestMatch: { binType: BinType; score: number } | null = null;

  for (const [binType, entries] of categories) {
    const score = entries.reduce(
      (highest, entry) => Math.max(highest, scoreRuleMatch(label, entry)),
      0,
    );

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { binType, score };
    }
  }

  return bestMatch && bestMatch.score >= 0.5 ? bestMatch.binType : null;
}

async function fireFeedback(
  result: ScanResult,
  accessibility: AccessibilitySettings,
  speechEnabled: boolean,
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

  if (accessibility.autoSpeak && speechEnabled) {
    Speech.speak(
      `${BIN_CONFIG[result.binType].ttsPrefix} ${result.item}. ${result.explanation}`,
    );
  }
}

export function useScanner(
  rules: RecyclingRules | null,
  accessibility: AccessibilitySettings,
  speechEnabled: boolean,
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
        await fireFeedback(finalResult, accessibility, speechEnabled);
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
      await fireFeedback(geminiResult, accessibility, speechEnabled);
      return geminiResult;
    } catch (e) {
      setError(formatUnknownError(e));
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
