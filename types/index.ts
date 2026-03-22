import type { BinType } from "@/constants/bins";

export interface RecyclingRules {
  city: string;
  state: string;
  fetchedAt: number;
  recycling: string[];
  trash: string[];
  compost: string[];
  hazardous: string[];
  notes: string;
  source: "gemini" | "fallback";
}

export interface ScanResult {
  item: string;
  binType: BinType;
  confidence: number;
  explanation: string;
  source: "mlkit" | "gemini" | "claude" | "fallback";
  timestamp: number;
  /** Normalized bounding box (0–1 relative to image dimensions) */
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  ecoPoints: number;
  level: number;
  co2SavedKg: number;
  scansThisMonth: number;
  joinedAt: number;
}

export interface CollectionSchedule {
  material: string;
  date: string;
  time: string;
  icon: string;
}

export interface AccessibilitySettings {
  enabled: boolean;
  highContrast: boolean;
  largeFonts: boolean;
  autoSpeak: boolean;
  haptics: boolean;
}
