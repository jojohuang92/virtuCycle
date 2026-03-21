export interface MLKitResult {
  label: string;
  confidence: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

const DEMO_LABELS: Record<string, MLKitResult> = {
  bottle: { label: "plastic bottle", confidence: 0.98 },
  can: { label: "aluminum can", confidence: 0.94 },
  paper: { label: "paper", confidence: 0.92 },
  cardboard: { label: "cardboard", confidence: 0.92 },
  pizza: { label: "pizza box", confidence: 0.86 },
  banana: { label: "banana peel", confidence: 0.93 },
  battery: { label: "battery", confidence: 0.96 },
};

export async function detectWithMLKit(
  imageUri: string,
): Promise<MLKitResult | null> {
  const normalized = imageUri.toLowerCase();
  const entry = Object.entries(DEMO_LABELS).find(([key]) =>
    normalized.includes(key),
  );

  if (entry) {
    return entry[1];
  }

  return {
    label: "recyclable container",
    confidence: 0.42,
  };
}
