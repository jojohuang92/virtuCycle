import type { RecyclingRules } from "@/types";
import { cache } from "./cache";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = GEMINI_API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  : null;

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

function buildFallback(city: string, state: string): RecyclingRules {
  return {
    ...FALLBACK_RULES,
    city: city || FALLBACK_RULES.city,
    state: state || FALLBACK_RULES.state,
    fetchedAt: Date.now(),
  };
}

function parseJsonResponse(text: string): RecyclingRules | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    return JSON.parse(match[0]) as RecyclingRules;
  } catch {
    return null;
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

  const prompt = `What are the official recycling disposal rules for ${city}, ${state}? Return exactly this JSON structure: {"city":"${city}","state":"${state}","fetchedAt":${Date.now()},"recycling":["item"],"trash":["item"],"compost":["item"],"hazardous":["item"],"notes":"one short paragraph","source":"gemini"}`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
