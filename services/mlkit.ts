import {
  loadDefaultModel,
  detectObjects,
} from '@infinitered/react-native-mlkit-object-detection';

export interface MLKitResult {
  label: string;
  confidence: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

// Maps ML Kit's coarse category labels to recycling-relevant terms
const LABEL_MAP: Record<string, string> = {
  'Fashion good': 'clothing',
  'Food':         'food scraps',
  'Home good':    'household item',
  'Place':        'unknown',
  'Plant':        'organic waste',
  'Animal':       'unknown',
  'Vehicle':      'unknown',
};

let modelLoaded = false;

async function ensureModelLoaded() {
  if (modelLoaded) return;
  console.log('[MLKit] Loading default model...');
  await loadDefaultModel({
    shouldEnableClassification: true,
    shouldEnableMultipleObjects: false,
    detectorMode: 'singleImage',
  });
  modelLoaded = true;
  console.log('[MLKit] Model loaded.');
}

export async function detectWithMLKit(
  imageUri: string,
): Promise<MLKitResult | null> {
  try {
    await ensureModelLoaded();

    console.log('[MLKit] Running detection on:', imageUri);
    const results = await detectObjects('default', imageUri);
    console.log('[MLKit] Raw results:', JSON.stringify(results));

    if (!results?.length) {
      console.log('[MLKit] No objects detected.');
      return null;
    }

    const top = results[0];
    const frame = top.frame;
    const bounds = frame
      ? {
          x: frame.origin.x,
          y: frame.origin.y,
          width: frame.size.x,
          height: frame.size.y,
        }
      : undefined;

    const topLabel = top.labels?.[0];
    if (!topLabel) {
      // Object located but not classified — return bounds with zero confidence
      // so useScanner escalates to Gemini Vision but keeps the bounding box
      console.log('[MLKit] Object found but no label — passing bounds to Gemini Vision.');
      return { label: '', confidence: 0, bounds };
    }

    const rawLabel: string = topLabel.text ?? '';
    const confidence: number = topLabel.confidence ?? 0;
    console.log('[MLKit] Label:', rawLabel, 'Confidence:', confidence);

    return {
      label: LABEL_MAP[rawLabel] ?? rawLabel.toLowerCase(),
      confidence,
      bounds,
    };
  } catch (error) {
    console.warn('ML Kit detection failed, escalating to Gemini Vision:', error);
    return null;
  }
}
