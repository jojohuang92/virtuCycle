import type { QuickTipRecord, RecyclingRules } from "@/types";
import { cache } from "./cache";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_RULES_API_KEY;
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

const RULES_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    city: { type: "STRING" },
    state: { type: "STRING" },
    recycling: { type: "ARRAY", items: { type: "STRING" } },
    trash: { type: "ARRAY", items: { type: "STRING" } },
    compost: { type: "ARRAY", items: { type: "STRING" } },
    hazardous: { type: "ARRAY", items: { type: "STRING" } },
    notes: { type: "STRING" },
  },
  required: [
    "city",
    "state",
    "recycling",
    "trash",
    "compost",
    "hazardous",
    "notes",
  ],
} as const;

const QUICK_TIP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tip: { type: "STRING" },
  },
  required: ["tip"],
} as const;

const FALLBACK_RULES: RecyclingRules = {
  city: "General",
  state: "",
  fetchedAt: Date.now(),
  recycling: [
    "plastic bottles",
    "glass jars",
    "aluminum cans",
    "cardboard",
    "paper",
    "metal cans",
  ],
  trash: [
    "styrofoam",
    "plastic bags",
    "greasy pizza boxes",
    "broken glass",
    "food-soiled paper",
  ],
  compost: [
    "food scraps",
    "fruit peels",
    "coffee grounds",
    "paper towels",
    "yard waste",
  ],
  hazardous: [
    "batteries",
    "paint",
    "electronics",
    "fluorescent bulbs",
    "motor oil",
    "chemicals",
  ],
  notes:
    "General recycling guidelines. Check your local city website for specific rules.",
  source: "fallback",
};

const FALLBACK_QUICK_TIPS = [
  "Rinse containers quickly to keep recyclable loads cleaner.",
  "Flatten cardboard before binning it to save sorting space.",
  "Keep batteries out of household bins and recycle them separately.",
  "Dry paper and cardboard recycle better than damp materials.",
  "Check local rules before recycling mixed-material packaging.",
];

function buildFallback(city: string, state: string): RecyclingRules {
  return {
    ...FALLBACK_RULES,
    city: city || FALLBACK_RULES.city,
    state: state || FALLBACK_RULES.state,
    fetchedAt: Date.now(),
  };
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

function isRecyclingRules(value: unknown): value is RecyclingRules {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RecyclingRules>;
  return (
    typeof candidate.city === "string" &&
    typeof candidate.state === "string" &&
    Array.isArray(candidate.recycling) &&
    Array.isArray(candidate.trash) &&
    Array.isArray(candidate.compost) &&
    Array.isArray(candidate.hazardous) &&
    typeof candidate.notes === "string"
  );
}

function parseJsonResponse(text: string): RecyclingRules | null {
  try {
    const json = extractBalancedJson(text);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as unknown;
    return isRecyclingRules(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeQuickTip(text: string): string {
  const cleaned = text
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 15);
  return words.join(" ");
}

function parseQuickTipResponse(text: string): string | null {
  try {
    const json = extractBalancedJson(text);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as { tip?: unknown };
    return typeof parsed.tip === "string" ? sanitizeQuickTip(parsed.tip) : null;
  } catch {
    return null;
  }
}

export async function generateQuickTip(
  city: string,
  state: string,
  rules: RecyclingRules,
  recentItems: string[],
): Promise<Pick<QuickTipRecord, "text" | "city" | "state" | "source">> {
  const fallbackTip = sanitizeQuickTip(
    FALLBACK_QUICK_TIPS[Math.floor(Math.random() * FALLBACK_QUICK_TIPS.length)],
  );

  if (!GEMINI_URL) {
    return {
      text: fallbackTip,
      city,
      state,
      source: "fallback",
    };
  }

  const recentItemsText = recentItems.length
    ? `Recent recycled items: ${recentItems.join(", ")}.`
    : "No recent recycled items available yet.";

  const prompt = `You are a recycling coach for ${city || "General"}, ${state || ""}.
Local rules summary:
- Recycling: ${rules.recycling.slice(0, 6).join(", ")}
- Trash: ${rules.trash.slice(0, 6).join(", ")}
- Compost: ${rules.compost.slice(0, 6).join(", ")}
- Hazardous: ${rules.hazardous.slice(0, 6).join(", ")}
- Notes: ${rules.notes}
${recentItemsText}
Return only compact JSON with one field: tip.
The tip must be practical, plain English, and 15 words or fewer.
Do not use quotes, bullet points, or emojis.`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 80,
          responseMimeType: "application/json",
          responseSchema: QUICK_TIP_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini quick tip request failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((part: any) => part.text && !part.thought)
      .map((part: any) => part.text)
      .join("");

    const parsedTip = parseQuickTipResponse(text);

    return {
      text: parsedTip || fallbackTip,
      city,
      state,
      source: parsedTip ? "gemini" : "fallback",
    };
  } catch (error) {
    console.error("Gemini quick tip fallback:", error);
    return {
      text: fallbackTip,
      city,
      state,
      source: "fallback",
    };
  }
}

export async function getRecyclingRules(
  city: string,
  state: string,
): Promise<RecyclingRules> {
  const cacheKey = `recycling_rules_${city}_${state}`
    .toLowerCase()
    .replace(/\s/g, "_");
  const cached = await cache.get<RecyclingRules>(cacheKey);
  if (cached) {
    return cached;
  }

  if (!GEMINI_URL) {
    const fallback = buildFallback(city, state);
    await cache.set(cacheKey, fallback);
    return fallback;
  }

  const prompt = `What are the current local recycling and disposal rules for ${city}, ${state}? Return only concise disposal guidance suitable for a mobile recycling app. Include common examples for each bin category and keep notes short.`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          responseSchema: RULES_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Gemini 2.5 models include "thought" parts — skip them
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p: any) => p.text && !p.thought)
      .map((p: any) => p.text)
      .join("");

    const parsed = parseJsonResponse(text);
    const rules = parsed
      ? {
          ...parsed,
          fetchedAt: Date.now(),
          city,
          state,
          source: "gemini" as const,
        }
      : buildFallback(city, state);

    await cache.set(cacheKey, rules);
    return rules;
  } catch (error) {
    console.error("Gemini rules fallback:", error);
    const fallback = buildFallback(city, state);
    await cache.set(cacheKey, fallback);
    return fallback;
  }
}
