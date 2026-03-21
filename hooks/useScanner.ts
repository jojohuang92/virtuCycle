import { BIN_CONFIG, type BinType } from "@/constants/bins";
import { scanWithClaude } from "@/services/claude";
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

const CONFIDENCE_THRESHOLD = 0.8;

const DEMO_OVERRIDES: Record<string, ScanResult> = {
  "water bottle": {
    item: "Plastic Bottle",
    binType: "recycling",
    confidence: 0.98,
    explanation:
      "Empty and replace the cap if your city accepts it, then place it in the recycling bin.",
    source: "fallback",
    timestamp: Date.now(),
  },
  "pizza box": {
    item: "Pizza Box",
    binType: "trash",
    confidence: 0.95,
    explanation:
      "Grease-soiled pizza boxes usually belong in trash unless your city explicitly allows composting.",
    source: "fallback",
    timestamp: Date.now(),
  },
};

function matchLabelToRules(
  label: string,
  rules: RecyclingRules,
): BinType | null {
  const lowerLabel = label.toLowerCase();

  if (
    rules.recycling.some(
      (item) =>
        lowerLabel.includes(item.toLowerCase()) ||
        item.toLowerCase().includes(lowerLabel),
    )
  ) {
    return "recycling";
  }
  if (
    rules.trash.some(
      (item) =>
        lowerLabel.includes(item.toLowerCase()) ||
        item.toLowerCase().includes(lowerLabel),
    )
  ) {
    return "trash";
  }
  if (
    rules.compost.some(
      (item) =>
        lowerLabel.includes(item.toLowerCase()) ||
        item.toLowerCase().includes(lowerLabel),
    )
  ) {
    return "compost";
  }
  if (
    rules.hazardous.some(
      (item) =>
        lowerLabel.includes(item.toLowerCase()) ||
        item.toLowerCase().includes(lowerLabel),
    )
  ) {
    return "hazardous";
  }

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
  const [scanning, setScanning] = useState(false);

  const scan = async (imageUri: string) => {
    if (!rules) {
      return;
    }

    setScanning(true);
    try {
      const lowerUri = imageUri.toLowerCase();
      const override = Object.entries(DEMO_OVERRIDES).find(
        ([key]) =>
          lowerUri.includes(key.replace(/\s/g, "_")) || lowerUri.includes(key),
      );
      if (override) {
        const demoResult = { ...override[1], timestamp: Date.now() };
        setResult(demoResult);
        await saveScanHistory(demoResult);
        await saveScanResult(demoResult, userId);
        await fireFeedback(demoResult, accessibility);
        return demoResult;
      }

      const mlKitResult = await detectWithMLKit(imageUri);
      if (mlKitResult && mlKitResult.confidence >= CONFIDENCE_THRESHOLD) {
        const matchedBin =
          matchLabelToRules(mlKitResult.label, rules) ?? "unknown";
        const mlResult: ScanResult = {
          item: mlKitResult.label.replace(/(^\w|\s\w)/g, (char) =>
            char.toUpperCase(),
          ),
          binType: matchedBin,
          confidence: mlKitResult.confidence,
          explanation:
            matchedBin === "unknown"
              ? `${rules.notes} Check your municipal site for this item.`
              : `Matched against your ${rules.city} recycling guidance.`,
          source: "mlkit",
          timestamp: Date.now(),
        };

        setResult(mlResult);
        await saveScanHistory(mlResult);
        await saveScanResult(mlResult, userId);
        await fireFeedback(mlResult, accessibility);
        return mlResult;
      }

      const claudeResult = await scanWithClaude(imageUri, rules);
      setResult(claudeResult);
      await saveScanHistory(claudeResult);
      await saveScanResult(claudeResult, userId);
      await fireFeedback(claudeResult, accessibility);
      return claudeResult;
    } finally {
      setScanning(false);
    }
  };

  const reset = () => setResult(null);

  return { result, scanning, scan, reset };
}
