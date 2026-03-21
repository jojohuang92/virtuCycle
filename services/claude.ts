import { BIN_CONFIG, type BinType } from "@/constants/bins";
import type { RecyclingRules, ScanResult } from "@/types";
import * as ImageManipulator from "expo-image-manipulator";

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 900 } }],
    { compress: 0.65, base64: true, format: ImageManipulator.SaveFormat.JPEG },
  );

  return result.base64 || "";
}

function deriveFallbackScan(
  imageUri: string,
  rules: RecyclingRules,
): ScanResult {
  const normalized = imageUri.toLowerCase();
  const mappings: Array<[string, BinType, string]> = [
    [
      "battery",
      "hazardous",
      "Batteries should go to hazardous waste drop-off points in most cities.",
    ],
    [
      "banana",
      "compost",
      "Food scraps like banana peels usually belong in compost programs.",
    ],
    [
      "pizza",
      "trash",
      "Greasy pizza boxes are usually trash because the fibers are food-soiled.",
    ],
    [
      "paper",
      "recycling",
      "Clean paper is accepted in most curbside recycling programs.",
    ],
    [
      "cardboard",
      "recycling",
      "Flattened cardboard is recyclable in most municipal programs.",
    ],
    [
      "bottle",
      "recycling",
      "Plastic bottles are commonly accepted in recycling streams.",
    ],
    [
      "can",
      "recycling",
      "Metal cans are usually accepted in curbside recycling.",
    ],
  ];

  const match = mappings.find(([keyword]) => normalized.includes(keyword));
  const binType = match?.[1] ?? "unknown";
  const item =
    match?.[0] === "banana"
      ? "Banana Peel"
      : match?.[0] === "pizza"
        ? "Pizza Box"
        : "Plastic Bottle";
  const explanation =
    match?.[2] ?? `${rules.notes} Check local guidelines before disposal.`;

  return {
    item,
    binType,
    confidence: match ? 0.88 : 0.55,
    explanation,
    source: "fallback",
    timestamp: Date.now(),
  };
}

function extractJson(text: string): Omit<ScanResult, "timestamp"> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    return JSON.parse(match[0]) as Omit<ScanResult, "timestamp">;
  } catch {
    return null;
  }
}

export async function scanWithClaude(
  imageUri: string,
  rules: RecyclingRules,
): Promise<ScanResult> {
  if (!CLAUDE_API_KEY) {
    return deriveFallbackScan(imageUri, rules);
  }

  try {
    const base64 = await compressImage(imageUri);
    const prompt = `Local recycling rules:\n- Recycling bin: ${rules.recycling.join(", ")}\n- Trash bin: ${rules.trash.join(", ")}\n- Compost bin: ${rules.compost.join(", ")}\n- Hazardous waste: ${rules.hazardous.join(", ")}\n- Local notes: ${rules.notes}\n\nLook at the image and identify the item. Return ONLY valid JSON: {"item":"name of the item","binType":"recycling | trash | compost | hazardous | unknown","confidence":0.95,"explanation":"plain english guidance","source":"claude"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 350,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude request failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text ?? "";
    const parsed = extractJson(text);
    if (!parsed) {
      return deriveFallbackScan(imageUri, rules);
    }

    const binType = parsed.binType in BIN_CONFIG ? parsed.binType : "unknown";
    return {
      ...parsed,
      binType,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Claude scan fallback:", error);
    return deriveFallbackScan(imageUri, rules);
  }
}
