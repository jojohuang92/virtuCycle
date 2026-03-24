# VirtuCycle

A mobile app that uses AI-powered image recognition to help users sort waste correctly. Point your camera at an item, and VirtuCycle tells you exactly which bin it belongs in and customized to your city's recycling rules.

## DEV POST:
https://devpost.com/software/virtucycle
## Features

- **AI-Powered Scanner** — Multi-stage detection pipeline: on-device ML Kit → Gemini Vision → Claude Vision, ensuring accurate classification into recycling, trash, compost, or hazardous bins
- **Location-Aware Rules** — Fetches your city's specific recycling guidelines via Gemini API so sorting advice is always locally relevant
- **Impact Tracking** — Tracks eco-points, CO2 saved, and items recycled over time with detailed impact reports
- **Leaderboard & Friends** — Add friends, compare stats, and compete on monthly recycling leaderboards
- **Voice Commands** — Hands-free operation with continuous speech recognition and text-to-speech feedback
- **Quick Tips** — AI-generated recycling tips based on your local rules
- **Accessibility** — Four color modes (default, protanopia, deuteranopia, tritanopia), haptic feedback, and a demo mode for quick access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native, Expo (v55), Expo Router |
| AI / Vision | Google Gemini 2.5 Flash, Anthropic Claude, ML Kit Object Detection |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Speech | Expo Speech Recognition, Expo Speech (TTS) |
| Camera | React Native Vision Camera + frame processor plugins |
| Auth | Supabase Auth (email/password, Google OAuth) |

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Xcode (iOS) or Android Studio (Android)

### Environment Variables

Create a `.env.local` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=<your_supabase_url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
EXPO_PUBLIC_GEMINI_VISION_API_KEY=<your_gemini_key>
EXPO_PUBLIC_GEMINI_RULES_API_KEY=<your_gemini_key>
EXPO_PUBLIC_CLAUDE_API_KEY=<your_claude_key>
```

### Install & Run

```bash
npm install
npm start          # Start Expo dev server
npm run ios        # Run on iOS
npm run android    # Run on Android
```

## Project Structure

```
app/
├── (auth)/                # Login & signup screens
├── (tabs)/                # Main tab screens
│   ├── dashboard.tsx      # Home — stats, leaderboard, voice commands
│   ├── scanner.tsx        # Camera scanner
│   ├── profile.tsx        # User profile & friends
│   ├── recycled-history.tsx
│   ├── quick-tips.tsx
│   └── impact-report.tsx
├── settings.tsx
└── _layout.tsx            # Root layout with auth guard

services/
├── supabase.ts            # Database, auth, and all Supabase queries
├── gemini.ts              # Gemini API — recycling rules & tips
├── geminiVision.ts        # Gemini Vision — image classification
├── claude.ts              # Claude API — image classification
├── mlkit.ts               # On-device ML Kit detection
├── location.ts            # Geolocation & reverse geocoding
├── history.ts             # Local storage history
└── cache.ts               # TTL cache (7-day expiry)

hooks/
├── useSession.ts          # Auth context & profile management
├── useScanner.ts          # Scanning pipeline orchestration
├── useVoiceCommands.ts    # Speech recognition & command matching
├── useRecyclingRules.ts   # Location-based rules fetching
├── useAccessibility.ts    # Color-blind mode settings
└── useAppTheme.ts         # Theme provider by accessibility mode
```

## How Scanning Works

1. **ML Kit** runs on-device object detection (confidence threshold: 0.8)
2. If confidence is low, **Gemini Vision** analyzes the image as a fallback
3. **Claude Vision** serves as an additional fallback layer
4. The result maps the item to a bin type with confidence score, explanation, and impact metrics
5. Results are saved to Supabase and local history

## Built With

Built at a hackathon using **Gemini API**, **Claude API (Anthropic)**, **Supabase**, **Expo**, and **React Native**.
