import {
  detectObjects,
  loadDefaultModel,
} from "@infinitered/react-native-mlkit-object-detection";

export interface MLKitResult {
  label: string;
  confidence: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

// Maps ML Kit's coarse category labels to recycling-relevant terms
const LABEL_MAP: Record<string, string> = {
  "Fashion good": "clothing",
  Food: "food scraps",
  "Home good": "household item",
  Place: "unknown",
  Plant: "organic waste",
  Animal: "unknown",
  Vehicle: "unknown",
};

let modelLoaded = false;

async function ensureModelLoaded() {
  if (modelLoaded) return;
  console.log("[MLKit] Loading default model...");
  await loadDefaultModel({
    shouldEnableClassification: true,
    shouldEnableMultipleObjects: true,
    detectorMode: "stream",
  });
  modelLoaded = true;
  console.log("[MLKit] Model loaded.");
}

function mapDetectionResult(detectedObject: any): MLKitResult {
  const frame = detectedObject.frame;
  const bounds = frame
    ? {
        x: frame.origin.x,
        y: frame.origin.y,
        width: frame.size.x,
        height: frame.size.y,
      }
    : undefined;

  const topLabel = detectedObject.labels?.[0];
  if (!topLabel) {
    return { label: "", confidence: 0, bounds };
  }

  const rawLabel: string = topLabel.text ?? "";
  const confidence: number = topLabel.confidence ?? 0;
  return {
    label: LABEL_MAP[rawLabel] ?? rawLabel.toLowerCase(),
    confidence,
    bounds,
  };
}

export async function detectAllWithMLKit(
  imageUri: string,
): Promise<MLKitResult[]> {
  try {
    await ensureModelLoaded();

    console.log("[MLKit] Running detection on:", imageUri);
    const results = await detectObjects("default", imageUri);
    console.log("[MLKit] Raw results:", JSON.stringify(results));

    if (!results?.length) {
      console.log("[MLKit] No objects detected.");
      return [];
    }

    return results.map(mapDetectionResult);
  } catch (error) {
    console.warn(
      "ML Kit detection failed, escalating to Gemini Vision:",
      error,
    );
    return [];
  }
}

export async function detectWithMLKit(
  imageUri: string,
): Promise<MLKitResult | null> {
  const results = await detectAllWithMLKit(imageUri);
  if (!results.length) {
    return null;
  }

  const sorted = [...results].sort(
    (left, right) => right.confidence - left.confidence,
  );
  const top = sorted[0];

  if (!top.label) {
    console.log(
      "[MLKit] Object found but no label — passing bounds to Gemini Vision.",
    );
    return top;
  }

  console.log("[MLKit] Label:", top.label, "Confidence:", top.confidence);
  return top;
}
