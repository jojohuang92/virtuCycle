import type { AccessibilityMode } from "@/types";

export const BaseColors = {
  // Primary (dark olive — brand, buttons, headlines)
  primary: '#343c0a',
  primaryContainer: '#4b5320',
  primaryLight: '#5a632e',
  primaryFixed: '#dfe8a6',
  onPrimary: '#ffffff',

  // Tertiary (forest green — eco highlights, impact card)
  tertiary: '#00420c',
  tertiaryContainer: '#005c15',
  onTertiary: '#ffffff',

  // Accent
  accent: '#c3cc8c',

  // Backgrounds & surfaces
  background: '#f9faf5',
  surface: '#f9faf5',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f4ef',
  surfaceContainer: '#edeee9',
  surfaceContainerHigh: '#e7e9e4',
  surfaceContainerHighest: '#e2e3de',

  // Text
  text: '#1a1c19',
  textMuted: '#47483c',
  textInverse: '#f0f1ec',

  // Secondary
  secondary: '#5b6236',
  secondaryContainer: '#dde5ad',
  onSecondaryContainer: '#5f663a',

  // Outline
  outline: '#77786b',
  outlineVariant: '#c8c7b8',

  // Bin colors
  binYellow: '#f5c842',
  binBlue: '#4a90d9',
  binGreen: '#2d5a27',
  binBrown: '#8b6914',
  binRed: '#e85555',
  binGray: '#9e9e9e',

  // Status
  danger: '#e85555',
  dangerContainer: '#ffdad6',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#ba1a1a',

  // Misc
  highContrastText: '#000000',
  highContrastBg: '#ffffff',
  glass: 'rgba(249, 250, 245, 0.82)',
  overlay: 'rgba(17, 22, 12, 0.52)',
} as const;

export type AppColors = {
  [K in keyof typeof BaseColors]: string;
};

export const AccessibilityColors: Record<
  AccessibilityMode,
  AppColors
> = {
  default: BaseColors,
  protanopia: {
    ...BaseColors,
    primary: "#2F6FED",
    primaryContainer: "#2A4D80",
    primaryLight: "#588AF4",
    primaryFixed: "#DCE8FF",
    tertiary: "#6C8F76",
    tertiaryContainer: "#7EA488",
    accent: "#B9CBDB",
    surfaceContainerHigh: "#DFE8F2",
    surfaceContainerHighest: "#EAF0F7",
    outline: "#9AA8B8",
    outlineVariant: "#C8D2DE",
    text: "#1C2430",
    textMuted: "#627080",
    secondary: "#47659B",
    secondaryContainer: "#D6E2FA",
    onSecondaryContainer: "#2A436B",
    glass: "rgba(234, 240, 247, 0.82)",
    overlay: "rgba(17, 28, 44, 0.52)",
  },
  deuteranopia: {
    ...BaseColors,
    primary: "#3A66CC",
    primaryContainer: "#304E8C",
    primaryLight: "#5D82DC",
    primaryFixed: "#DCE5FF",
    tertiary: "#B38457",
    tertiaryContainer: "#C79869",
    accent: "#D1C2A5",
    surfaceContainerHigh: "#E2E4EE",
    surfaceContainerHighest: "#ECECF4",
    outline: "#A5ADC0",
    outlineVariant: "#CDD2E0",
    text: "#202532",
    textMuted: "#687081",
    secondary: "#6B78A3",
    secondaryContainer: "#E2E7F7",
    onSecondaryContainer: "#445075",
    glass: "rgba(236, 236, 244, 0.82)",
    overlay: "rgba(26, 31, 43, 0.52)",
  },
  tritanopia: {
    ...BaseColors,
    primary: "#C96D35",
    primaryContainer: "#8A4D27",
    primaryLight: "#DA8A56",
    primaryFixed: "#F7DEC8",
    tertiary: "#5D8F66",
    tertiaryContainer: "#71A47A",
    accent: "#E0C39F",
    surfaceContainerHigh: "#F1E5DD",
    surfaceContainerHighest: "#F7EEE8",
    outline: "#BFA89A",
    outlineVariant: "#E2D0C4",
    text: "#2B221D",
    textMuted: "#78685E",
    secondary: "#9E6A4F",
    secondaryContainer: "#F4DECF",
    onSecondaryContainer: "#6E4632",
    glass: "rgba(247, 238, 232, 0.82)",
    overlay: "rgba(43, 28, 18, 0.52)",
  },
} as const;

export const Colors = BaseColors;

export function getColors(mode: AccessibilityMode = "default") {
  return AccessibilityColors[mode] ?? BaseColors;
}

export const Shadows = {
  floating: {
    shadowColor: BaseColors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  soft: {
    shadowColor: BaseColors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
} as const;

export const Radii = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  full: 999,
} as const;

export const Spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;
