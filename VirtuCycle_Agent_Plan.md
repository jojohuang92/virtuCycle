# VirtuCycle — Coding Agent Plan
> Paste this entire document into your coding agent (Cursor, Claude Code, Copilot Workspace, etc.)
> Design files will be added later. Placeholders are marked with 🖼️

---

## 0. AGENT INSTRUCTIONS

You are building **VirtuCycle**, a React Native + Expo mobile app that:
- Scans items via camera and tells users which bin to dispose of them in
- Adapts recycling rules to the user's city via GPS + Gemini AI
- Uses on-device ML Kit for fast detection, Claude Haiku Vision as a fallback
- Is fully accessible (TTS, haptics, screen reader support)

Work through each phase in order. Do not skip ahead.
After each phase, confirm it runs without errors before proceeding.
All placeholder values (API keys, etc.) use environment variables — never hardcode secrets.

---

## 1. PROJECT INITIALIZATION

### 1.1 Create the Expo app
```bash
npx create-expo-app VirtuCycle --template tabs
cd VirtuCycle
```

### 1.2 Install all dependencies upfront
```bash
# Core UI & Navigation
npx expo install expo-router
npx expo install expo-linear-gradient
npx expo install react-native-safe-area-context
npx expo install react-native-screens

# Camera & Scanning
npx expo install expo-camera
npx expo install expo-image-manipulator

# Location
npx expo install expo-location

# Accessibility
npx expo install expo-speech
npx expo install expo-haptics

# Storage & Auth
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store

# Auth (Firebase)
npm install firebase

# Networking
npm install axios

# ML Kit (on-device detection)
npm install react-native-mlkit-object-detection

# Icons
npm install @expo/vector-icons
```

### 1.3 Environment variables
Create `.env` at project root:
```
EXPO_PUBLIC_CLAUDE_API_KEY=your_claude_key_here
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key_here
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

Add `.env` to `.gitignore` immediately.

---

## 2. PROJECT STRUCTURE

Create this exact folder structure:
```
VirtuCycle/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── dashboard.tsx
│   │   ├── scanner.tsx
│   │   ├── stats.tsx
│   │   └── settings.tsx
│   └── _layout.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   ├── ImpactCard.tsx
│   ├── ScanResult.tsx
│   ├── CollectionItem.tsx
│   ├── VoiceCommandBar.tsx
│   └── AccessibilityToggle.tsx
├── services/
│   ├── mlkit.ts
│   ├── claude.ts
│   ├── gemini.ts
│   ├── location.ts
│   ├── cache.ts
│   └── firebase.ts
├── hooks/
│   ├── useRecyclingRules.ts
│   ├── useScanner.ts
│   └── useAccessibility.ts
├── constants/
│   ├── colors.ts
│   ├── typography.ts
│   └── bins.ts
├── types/
│   └── index.ts
└── assets/
    ├── images/        🖼️ Add design assets here later
    └── fonts/
```

---

## 3. CONSTANTS & TYPES

### 3.1 `/constants/colors.ts`
```typescript
export const Colors = {
  // Primary palette (from VirtuCycle design)
  primary: '#2D5A27',
  primaryLight: '#4A7C3F',
  primaryMuted: '#8DB87A',
  
  // Backgrounds
  background: '#F5F2EC',
  backgroundDark: '#1A1A1A',
  card: '#FFFFFF',
  cardMuted: '#F0EDE6',
  
  // Text
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  textLight: '#FFFFFF',
  
  // Bin colors
  binYellow: '#F5C842',
  binBlue: '#4A90D9',
  binGreen: '#2D5A27',
  binBrown: '#8B6914',
  binRed: '#E85555',
  binGray: '#9E9E9E',
  
  // Status
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#E85555',
  
  // Accessibility high contrast overrides
  highContrastText: '#000000',
  highContrastBg: '#FFFFFF',
};
```

### 3.2 `/constants/bins.ts`
```typescript
export type BinType = 'recycling' | 'trash' | 'compost' | 'hazardous' | 'unknown';

export const BIN_CONFIG: Record<BinType, {
  label: string;
  color: string;
  icon: string;
  hapticPattern: 'light' | 'medium' | 'heavy';
  ttsPrefix: string;
}> = {
  recycling: {
    label: 'Recycling',
    color: '#4A90D9',
    icon: 'refresh-circle',
    hapticPattern: 'light',
    ttsPrefix: 'Recyclable.',
  },
  trash: {
    label: 'Trash',
    color: '#9E9E9E',
    icon: 'trash',
    hapticPattern: 'heavy',
    ttsPrefix: 'Goes in the trash.',
  },
  compost: {
    label: 'Compost',
    color: '#8B6914',
    icon: 'leaf',
    hapticPattern: 'medium',
    ttsPrefix: 'Compostable.',
  },
  hazardous: {
    label: 'Hazardous',
    color: '#E85555',
    icon: 'warning',
    hapticPattern: 'heavy',
    ttsPrefix: 'Hazardous waste.',
  },
  unknown: {
    label: 'Unknown',
    color: '#9E9E9E',
    icon: 'help-circle',
    hapticPattern: 'light',
    ttsPrefix: 'Not sure about this one.',
  },
};
```

### 3.3 `/types/index.ts`
```typescript
export interface RecyclingRules {
  city: string;
  state: string;
  fetchedAt: number;
  recycling: string[];
  trash: string[];
  compost: string[];
  hazardous: string[];
  notes: string;
  source: 'gemini' | 'fallback';
}

export interface ScanResult {
  item: string;
  binType: BinType;
  confidence: number;
  explanation: string;
  source: 'mlkit' | 'claude' | 'fallback';
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
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
```

---

## 4. SERVICES

### 4.1 `/services/cache.ts`
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return data as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, data: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  },

  async clear(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
```

### 4.2 `/services/location.ts`
```typescript
import * as Location from 'expo-location';

export interface UserLocation {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
}

export async function getUserLocation(): Promise<UserLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const [place] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    return {
      city: place.city || place.subregion || 'Unknown City',
      state: place.region || '',
      country: place.country || 'US',
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    };
  } catch (error) {
    console.error('Location error:', error);
    return null;
  }
}
```

### 4.3 `/services/gemini.ts`
```typescript
import { RecyclingRules } from '../types';
import { cache } from './cache';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const FALLBACK_RULES: RecyclingRules = {
  city: 'General',
  state: '',
  fetchedAt: Date.now(),
  recycling: ['plastic bottles', 'glass jars', 'aluminum cans', 'cardboard', 'paper', 'metal cans'],
  trash: ['styrofoam', 'plastic bags', 'greasy pizza boxes', 'broken glass', 'food-soiled paper'],
  compost: ['food scraps', 'fruit peels', 'coffee grounds', 'paper towels', 'yard waste'],
  hazardous: ['batteries', 'paint', 'electronics', 'fluorescent bulbs', 'motor oil', 'chemicals'],
  notes: 'General recycling guidelines. Check your local city website for specific rules.',
  source: 'fallback',
};

export async function getRecyclingRules(city: string, state: string): Promise<RecyclingRules> {
  const cacheKey = `recycling_rules_${city}_${state}`.toLowerCase().replace(/\s/g, '_');

  // Check cache first
  const cached = await cache.get<RecyclingRules>(cacheKey);
  if (cached) return cached;

  try {
    const prompt = `You are a recycling expert. Return ONLY valid JSON with no explanation, no markdown, no backticks.

What are the official recycling disposal rules for ${city}, ${state}?

Return exactly this JSON structure:
{
  "city": "${city}",
  "state": "${state}",
  "fetchedAt": ${Date.now()},
  "recycling": ["item1", "item2"],
  "trash": ["item1", "item2"],
  "compost": ["item1", "item2"],
  "hazardous": ["item1", "item2"],
  "notes": "any special local rules or caveats",
  "source": "gemini"
}`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
      }),
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const rules: RecyclingRules = JSON.parse(clean);

    await cache.set(cacheKey, rules);
    return rules;

  } catch (error) {
    console.error('Gemini fetch failed, using fallback:', error);
    return { ...FALLBACK_RULES, city, state };
  }
}
```

### 4.4 `/services/mlkit.ts`
```typescript
// NOTE TO AGENT: react-native-mlkit-object-detection may need
// expo prebuild to link native modules.
// Run: npx expo prebuild --clean if you hit native linking errors.

export interface MLKitResult {
  label: string;
  confidence: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export async function detectWithMLKit(imageUri: string): Promise<MLKitResult | null> {
  try {
    // Dynamic import to handle cases where native module isn't linked
    const MLKit = await import('react-native-mlkit-object-detection');
    const results = await MLKit.detectObjects(imageUri, {
      shouldEnableMultipleObjects: false,
      shouldEnableClassification: true,
    });

    if (!results || results.length === 0) return null;

    const top = results[0];
    return {
      label: top.labels?.[0]?.text || 'unknown',
      confidence: top.labels?.[0]?.confidence || 0,
      bounds: top.frame,
    };
  } catch (error) {
    console.warn('ML Kit not available, skipping:', error);
    return null;
  }
}
```

### 4.5 `/services/claude.ts`
```typescript
import * as ImageManipulator from 'expo-image-manipulator';
import { RecyclingRules, ScanResult } from '../types';
import { BIN_CONFIG, BinType } from '../constants/bins';

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

// Compress image before sending to API
async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result.base64 || '';
}

export async function scanWithClaude(
  imageUri: string,
  rules: RecyclingRules
): Promise<ScanResult> {
  try {
    const base64 = await compressImage(imageUri);

    const prompt = `You are a recycling assistant for ${rules.city}, ${rules.state}.

Local recycling rules:
- Recycling bin: ${rules.recycling.join(', ')}
- Trash bin: ${rules.trash.join(', ')}
- Compost bin: ${rules.compost.join(', ')}
- Hazardous waste: ${rules.hazardous.join(', ')}
- Local notes: ${rules.notes}

Look at the image and identify the item. Return ONLY valid JSON:
{
  "item": "name of the item",
  "binType": "recycling|trash|compost|hazardous|unknown",
  "confidence": 0.0 to 1.0,
  "explanation": "one sentence explanation why, mentioning the specific bin color if known",
  "source": "claude"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return { ...result, timestamp: Date.now() };

  } catch (error) {
    console.error('Claude scan failed:', error);
    return {
      item: 'Unknown item',
      binType: 'unknown' as BinType,
      confidence: 0,
      explanation: 'Could not identify this item. Please check your local recycling guidelines.',
      source: 'fallback',
      timestamp: Date.now(),
    };
  }
}
```

### 4.6 `/services/firebase.ts`
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function logScan(userId: string, scanResult: ScanResult): Promise<void> {
  try {
    // Log scan to history
    const scanRef = doc(db, 'users', userId, 'scans', `${Date.now()}`);
    await setDoc(scanRef, scanResult);

    // Update user stats
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ecoPoints: increment(10),
      scansThisMonth: increment(1),
      co2SavedKg: increment(0.5), // approximate
    });
  } catch (error) {
    console.error('Failed to log scan:', error);
  }
}
```

---

## 5. HOOKS

### 5.1 `/hooks/useRecyclingRules.ts`
```typescript
import { useState, useEffect } from 'react';
import { getUserLocation } from '../services/location';
import { getRecyclingRules } from '../services/gemini';
import { RecyclingRules } from '../types';

export function useRecyclingRules() {
  const [rules, setRules] = useState<RecyclingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRules() {
      try {
        setLoading(true);
        const location = await getUserLocation();
        if (!location) {
          setError('Location permission denied. Using general guidelines.');
          const fallbackRules = await getRecyclingRules('General', 'US');
          setRules(fallbackRules);
          return;
        }

        setCity(location.city);
        const fetchedRules = await getRecyclingRules(location.city, location.state);
        setRules(fetchedRules);
      } catch (err) {
        setError('Failed to load recycling rules.');
      } finally {
        setLoading(false);
      }
    }

    fetchRules();
  }, []);

  return { rules, loading, city, error };
}
```

### 5.2 `/hooks/useScanner.ts`
```typescript
import { useState, useCallback } from 'react';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { detectWithMLKit } from '../services/mlkit';
import { scanWithClaude } from '../services/claude';
import { ScanResult, RecyclingRules } from '../types';
import { BIN_CONFIG } from '../constants/bins';

const CONFIDENCE_THRESHOLD = 0.80;

// Maps ML Kit generic labels to bin types using local rules
function matchLabelToRules(label: string, rules: RecyclingRules): string | null {
  const lowerLabel = label.toLowerCase();
  for (const item of rules.recycling) {
    if (item.toLowerCase().includes(lowerLabel) || lowerLabel.includes(item.toLowerCase())) {
      return 'recycling';
    }
  }
  for (const item of rules.trash) {
    if (item.toLowerCase().includes(lowerLabel) || lowerLabel.includes(item.toLowerCase())) {
      return 'trash';
    }
  }
  for (const item of rules.compost) {
    if (item.toLowerCase().includes(lowerLabel) || lowerLabel.includes(item.toLowerCase())) {
      return 'compost';
    }
  }
  return null;
}

export function useScanner(rules: RecyclingRules | null, accessibilityEnabled: boolean) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async (imageUri: string) => {
    if (!rules || scanning) return;
    setScanning(true);
    setResult(null);

    try {
      // Step 1: Try ML Kit on-device
      const mlResult = await detectWithMLKit(imageUri);

      let finalResult: ScanResult;

      if (mlResult && mlResult.confidence >= CONFIDENCE_THRESHOLD) {
        const binType = matchLabelToRules(mlResult.label, rules) || 'unknown';
        finalResult = {
          item: mlResult.label,
          binType: binType as any,
          confidence: mlResult.confidence,
          explanation: `Identified locally as ${mlResult.label}.`,
          source: 'mlkit',
          timestamp: Date.now(),
        };
      } else {
        // Step 2: Escalate to Claude Haiku
        finalResult = await scanWithClaude(imageUri, rules);
      }

      setResult(finalResult);

      // Accessibility output
      if (accessibilityEnabled) {
        const binConfig = BIN_CONFIG[finalResult.binType];
        const speech = `${binConfig.ttsPrefix} ${finalResult.item}. ${finalResult.explanation}`;
        Speech.speak(speech, { rate: 0.9, pitch: 1.0 });

        // Haptic feedback
        if (binConfig.hapticPattern === 'light') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (binConfig.hapticPattern === 'medium') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }

    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setScanning(false);
    }
  }, [rules, scanning, accessibilityEnabled]);

  return { result, scanning, scan };
}
```

### 5.3 `/hooks/useAccessibility.ts`
```typescript
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AccessibilitySettings {
  enabled: boolean;
  highContrast: boolean;
  largeFonts: boolean;
  autoSpeak: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  enabled: false,
  highContrast: false,
  largeFonts: false,
  autoSpeak: true,
};

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem('accessibility_settings').then(raw => {
      if (raw) setSettings(JSON.parse(raw));
    });
  }, []);

  const updateSettings = async (updates: Partial<AccessibilitySettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await AsyncStorage.setItem('accessibility_settings', JSON.stringify(newSettings));
  };

  return { settings, updateSettings };
}
```

---

## 6. SCREENS

### 6.1 `/app/(auth)/login.tsx`
Build the login screen matching the VirtuCycle design:
- VirtuCycle logo + "Welcome Back" heading
- Email + password inputs with the warm off-white background
- "Sign In to Archive" button in primary green
- Google SSO button
- Apple SSO button
- "Join VirtuCycle" signup link
- Terms / Privacy / Help footer links

Use Firebase `signInWithEmailAndPassword` for email login.
Use `expo-auth-session` for Google/Apple OAuth.
On success, navigate to `/(tabs)/dashboard`.

🖼️ Reference: login.png (design file to be added)

### 6.2 `/app/(tabs)/dashboard.tsx`
Build the dashboard screen matching the VirtuCycle design:
- "Good morning, [Name]." greeting with dynamic time-based message
- Impact Score card (dark green, CO2 saved this month, lightning bolt icon)
- "Scan Material" card → navigates to `/scanner`
- "My Stats" card → navigates to `/stats`
- "Upcoming Collection" section with date + material cards
  - Use hardcoded sample data for hackathon: Paper & Cardboard (Oct 24), Mixed Plastics (Oct 27)
- Voice command bar at bottom ("Hey VirtuCycle...")
- Bottom navigation: Dash, Scan, Stats, Settings

Display city name fetched from `useRecyclingRules` hook.

🖼️ Reference: dashboard.png (design file to be added)

### 6.3 `/app/(tabs)/scanner.tsx`

This is the most important screen. Build carefully.

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useScanner } from '../../hooks/useScanner';
import { useRecyclingRules } from '../../hooks/useRecyclingRules';
import { useAccessibility } from '../../hooks/useAccessibility';
import { ScanResult } from '../../components/ScanResult';
import { BIN_CONFIG } from '../../constants/bins';
```

UI requirements:
- Full-screen camera feed (dark background)
- Rounded rectangle bounding box overlay (green border, animated pulse when detecting)
- "Detecting..." pill badge at top center — shown while scanning
- On result: slide-up result card from bottom with:
  - Recycling icon (color matches bin type)
  - Item name (bold, large)
  - Bin type badge (e.g. "YELLOW BIN" with colored dot)
  - Match confidence % badge (top right, e.g. "MATCH 98%")
  - Plain English explanation text
- X button (top left) to close/reset
- History icon (top right) to view past scans
- Bottom nav overlay (semi-transparent)
- Capture button: large circular green button in bottom nav center

Camera capture flow:
1. User taps capture button
2. Take photo with `camera.takePictureAsync({ base64: false, quality: 0.7 })`
3. Pass URI to `useScanner.scan(uri)`
4. Show detecting state
5. Show result card with animation

🖼️ Reference: scanner.png (design file to be added)

### 6.4 `/app/(tabs)/settings.tsx`
Build the settings/profile screen matching the VirtuCycle design:
- Profile avatar + name + "Eco Enthusiast · Level 42"
- Email address display
- Eco Points Earned with leaf icon
- Notifications section:
  - Weekly Impact Report toggle (on by default)
  - Community Alerts toggle
- Accessibility section:
  - Accessibility Mode toggle
  - Font Size button
  - Contrast button
- "Sync Data with Cloud" button (primary green)
- "Sign Out of VirtuCycle" button (pink/danger)
- Version number footer

Wire accessibility toggles to `useAccessibility` hook.

🖼️ Reference: settings.png (design file to be added)

### 6.5 `/app/(tabs)/stats.tsx`
Build a stats screen (not in original designs — use your judgment):
- Weekly scan count
- CO2 saved this month (large number, green)
- Breakdown by bin type (bar chart or simple list)
- Scan history list (most recent 20 scans)
- Each history item: item name, bin type badge, timestamp

Use data from Firebase or AsyncStorage fallback.

---

## 7. COMPONENTS

### 7.1 `/components/ScanResult.tsx`
Animated bottom sheet result card.
Props: `result: ScanResult | null`, `onDismiss: () => void`
- Slides up from bottom with spring animation
- Shows bin color, item name, confidence, explanation
- Dismiss on swipe down or tap outside

### 7.2 `/components/ImpactCard.tsx`
The dark green impact score card from dashboard.
Props: `co2Kg: number`, `scansCount: number`
- Dark green background with gradient
- Large number display
- Animated counter on mount

### 7.3 `/components/CollectionItem.tsx`
Single upcoming collection row.
Props: `date: string`, `material: string`, `time: string`
- Date badge (month + day)
- Material name + pickup time
- Calendar icon

### 7.4 `/components/VoiceCommandBar.tsx`
The voice command input bar at bottom of dashboard.
Props: `onCommand: (text: string) => void`
- Microphone icon
- Quote text display
- "Voice commands are active. Speak now." subtitle
- Use `expo-av` or `expo-speech` for voice input if time permits
- For hackathon: tapping shows a text input as fallback

### 7.5 `/components/AccessibilityToggle.tsx`
Reusable toggle row component.
Props: `icon`, `label`, `description`, `value`, `onChange`
- Matches the settings screen toggle style

---

## 8. NAVIGATION

### 8.1 `/app/_layout.tsx`
```typescript
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { auth } from '../services/firebase';

export default function RootLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth.onAuthStateChanged(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return null; // Show splash screen

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}
```

### 8.2 `/app/(tabs)/_layout.tsx`
Bottom tab navigator with 4 tabs: Dashboard, Scanner, Stats, Settings.
- Active tab: primary green icon
- Inactive tab: muted gray
- Scanner tab: larger circular green button (FAB style)
- Match the bottom nav from VirtuCycle designs exactly

---

## 9. ACCESSIBILITY IMPLEMENTATION

After all screens are built, make a dedicated pass for accessibility:

```typescript
// Every interactive element needs:
accessibilityLabel="descriptive label"
accessibilityRole="button" // or "text", "image", etc.
accessibilityHint="what happens when activated"

// Scanner result announcement
// Already handled in useScanner hook via expo-speech

// High contrast mode
// Apply Colors.highContrastText and Colors.highContrastBg
// when settings.highContrast === true

// Large fonts
// Apply fontSize * 1.3 when settings.largeFonts === true
```

---

## 10. TESTING CHECKLIST

Before demo day, verify each item:

### Core Flow
- [ ] App launches and requests location permission
- [ ] Recycling rules load for current city
- [ ] Camera opens on scanner tab
- [ ] Tapping capture takes a photo
- [ ] ML Kit runs (or gracefully falls back)
- [ ] Claude API returns a bin result
- [ ] Result card appears with correct bin type and color
- [ ] Confidence percentage displays correctly

### Accessibility
- [ ] TTS speaks the bin result after every scan
- [ ] Haptic fires on scan result
- [ ] Accessibility mode toggle works in settings
- [ ] All buttons have accessibilityLabel

### Auth
- [ ] Email login works
- [ ] Sign out works
- [ ] Auth state persists on app restart

### Edge Cases
- [ ] No internet → graceful fallback message
- [ ] Location denied → uses general rules
- [ ] Unknown item → "check local guidelines" message
- [ ] Low confidence → escalates to Claude correctly

---

## 11. DEMO PREP

### 11.1 Offline fallback
Hardcode these items as instant demo responses in case WiFi fails at the venue:

```typescript
const DEMO_OVERRIDES: Record<string, ScanResult> = {
  'water bottle': {
    item: 'Plastic Water Bottle',
    binType: 'recycling',
    confidence: 0.98,
    explanation: 'Empty PET plastic bottles are recyclable curbside in most cities.',
    source: 'mlkit',
    timestamp: Date.now(),
  },
  'pizza box': {
    item: 'Pizza Box',
    binType: 'trash',
    confidence: 0.94,
    explanation: 'Grease-soiled cardboard contaminates recycling. Goes in trash.',
    source: 'claude',
    timestamp: Date.now(),
  },
  'battery': {
    item: 'AA Battery',
    binType: 'hazardous',
    confidence: 0.99,
    explanation: 'Batteries are hazardous waste. Drop off at a designated collection site.',
    source: 'mlkit',
    timestamp: Date.now(),
  },
  'banana peel': {
    item: 'Banana Peel',
    binType: 'compost',
    confidence: 0.97,
    explanation: 'Fruit scraps are compostable. Great for the green bin!',
    source: 'mlkit',
    timestamp: Date.now(),
  },
};
```

### 11.2 Demo script
1. Open app → show dashboard with city name and CO2 impact score
2. Tap Scan → show camera
3. Scan water bottle → result card slides up, TTS speaks, haptic fires
4. Scan pizza box → different result, different haptic
5. Go to settings → toggle Accessibility Mode on/off
6. Show profile with eco points + level

---

## 12. DESIGN FILES

🖼️ **When design files are ready**, place them in `/assets/images/` and update each screen component to match pixel-perfect. Reference files expected:
- `dashboard.png` → Screen 1
- `settings.png` → Screen 2
- `login.png` → Screen 3
- `scanner.png` → Screen 4

Use the screenshots provided earlier as reference until design files arrive.

---

## AGENT NOTES

- Run `npx expo start` after each phase to verify no errors
- If ML Kit native linking fails, comment it out and use Claude-only mode
- Keep all API calls in `/services/` — never call APIs directly from screens
- The scanner screen is the MVP — prioritize it above all other screens
- Use the color constants from `/constants/colors.ts` everywhere — no hardcoded hex values in components
- All screens should handle loading and error states gracefully
- Test on a real device, not just simulator — camera and haptics don't work in simulator
