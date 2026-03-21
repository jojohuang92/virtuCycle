export const Colors = {
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

export const Shadows = {
  floating: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  soft: {
    shadowColor: Colors.primary,
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
