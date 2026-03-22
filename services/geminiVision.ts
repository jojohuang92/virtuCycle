// Gemini Vision API — fallback image classifier when ML Kit confidence is low.
// Uses gemini-2.0-flash multimodal endpoint (same key as recycling rules).

import { BIN_CONFIG, type BinType } from "@/constants/bins";
import type { RecyclingRules, ScanResult } from "@/types";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_VISION_API_KEY;
const GEMINI_VISION_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

const GEMINI_VISION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    item: { type: "STRING" },
    binType: {
      type: "STRING",
      enum: ["recycling", "trash", "compost", "hazardous", "unknown"],
    },
    confidence: { type: "NUMBER" },
    explanation: { type: "STRING" },
  },
  required: ["item", "binType", "confidence", "explanation"],
} as const;

async function compressImage(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 800 });
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({
    compress: 0.7,
    base64: true,
    format: SaveFormat.JPEG,
  });
  return result.base64 ?? "";
}

function extractBalancedJson(text: string): string | null {
  const normalized = text
    .replace(/```json|```/gi, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
  const start = normalized.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return normalized.slice(start, index + 1);
      }
    }
  }

  return null;
}

function isScanResultPayload(
  value: unknown,
): value is Omit<ScanResult, "timestamp"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScanResult>;
  return (
    typeof candidate.item === "string" &&
    typeof candidate.binType === "string" &&
    typeof candidate.confidence === "number" &&
    typeof candidate.explanation === "string"
  );
}

function extractJson(text: string): Omit<ScanResult, "timestamp"> | null {
  try {
    const json = extractBalancedJson(text);
    if (!json) return null;

    const parsed = JSON.parse(json) as unknown;
    return isScanResultPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fallbackResult(rules: RecyclingRules, mlKitHint?: string): ScanResult {
  return {
    item: mlKitHint ?? "Unknown item",
    binType: "unknown",
    confidence: 0,
    explanation: `Could not identify this item. Check ${rules.city || "local"} guidelines for disposal.`,
    source: "fallback",
    timestamp: Date.now(),
  };
}

export async function scanWithGeminiVision(
  imageUri: string,
  rules: RecyclingRules,
  mlKitHint?: string, // low-confidence ML Kit label passed as context
): Promise<ScanResult> {
  if (!GEMINI_VISION_URL) {
    const fb = fallbackResult(rules, mlKitHint);
    fb.explanation = "GEMINI_VISION_API_KEY not set. " + fb.explanation;
    return fb;
  }

  try {
    const base64 = await compressImage(imageUri);

    if (!base64) {
      const fb = fallbackResult(rules, mlKitHint);
      fb.explanation =
        "Image compression returned empty base64. " + fb.explanation;
      return fb;
    }

    const hintLine = mlKitHint
      ? `On-device detection identified this as "${mlKitHint}" but confidence was low. Use as a hint only.`
      : "";

    const prompt = `You are a recycling assistant for ${rules.city}, ${rules.state}.
${hintLine}

Local rules:
- Recycling: ${rules.recycling.join(", ")}
- Trash: ${rules.trash.join(", ")}
- Compost: ${rules.compost.join(", ")}
- Hazardous: ${rules.hazardous.join(", ")}
- Notes: ${rules.notes}

Identify the main item in the image and choose the correct disposal bin using the local rules. Return only compact JSON with these fields: item, binType, confidence, explanation. Keep the explanation to one short sentence.`;

    const response = await fetch(GEMINI_VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          responseSchema: GEMINI_VISION_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gemini Vision ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    // Check for safety-filter or empty response
    if (!candidate?.content) {
      const reason = candidate?.finishReason ?? "no candidates";
      const fb = fallbackResult(rules, mlKitHint);
      fb.explanation = `Gemini blocked (${reason}). ${fb.explanation}`;
      return fb;
    }

    // Gemini 2.5 models include "thought" parts — try each part individually
    // to avoid concatenating thinking text with JSON output
    const parts: any[] = candidate.content.parts ?? [];
    let parsed: Omit<ScanResult, "timestamp"> | null = null;

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p?.text && !p.thought) {
        parsed = extractJson(p.text);
        if (parsed?.item) break;
      }
    }

    if (!parsed) {
      // Last resort: concatenate all non-thought text and try once more
      const allText = parts
        .filter((p: any) => p.text && !p.thought)
        .map((p: any) => p.text)
        .join("");
      parsed = extractJson(allText);
    }

    if (!parsed) {
      const raw = parts.map((p: any) => p.text?.slice(0, 40) ?? "").join(" | ");
      const fb = fallbackResult(rules, mlKitHint);
      fb.explanation = `Could not parse: ${raw.slice(0, 120)}`;
      return fb;
    }

    const binType: BinType =
      parsed.binType in BIN_CONFIG ? (parsed.binType as BinType) : "unknown";

    return {
      ...parsed,
      binType,
      source: "gemini",
      timestamp: Date.now(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const fb = fallbackResult(rules, mlKitHint);
    fb.explanation = `Scan error: ${msg.slice(0, 150)}`;
    return fb;
  }
}
