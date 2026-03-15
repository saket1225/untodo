// ─── Color Palettes ───────────────────────────────────────────────

export const Colors = {
  dark: {
    background: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceHover: '#252525',
    border: '#2A2A2A',
    text: '#F5F5F5',
    textSecondary: '#888888',
    textTertiary: '#555555',
    accent: '#FFFFFF',
    success: '#4ADE80',
    error: '#EF4444',
    timer: '#F59E0B',
    priorityHigh: '#EF4444',
    priorityMedium: '#FBBF24',
    priorityLow: '#60A5FA',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceHover: '#EBEBEB',
    border: '#E0E0E0',
    text: '#0A0A0A',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#0A0A0A',
    success: '#22C55E',
    error: '#EF4444',
    timer: '#F59E0B',
    priorityHigh: '#EF4444',
    priorityMedium: '#FBBF24',
    priorityLow: '#60A5FA',
  },
} as const;

export type ColorPalette = typeof Colors.dark | typeof Colors.light;
export type ThemeMode = 'light' | 'dark' | 'system';

// ─── Typography ───────────────────────────────────────────────────

export const Fonts = {
  heading: 'ApfelGrotezk-Bold',
  headingMedium: 'ApfelGrotezk-Medium',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodyBold: 'Inter-Bold',
  accent: 'InstrumentSerif-Regular',
  accentItalic: 'InstrumentSerif-Italic',
} as const;

export const Typography = {
  heading: { fontFamily: Fonts.accentItalic, fontSize: 32 },
  subheading: { fontFamily: Fonts.headingMedium, fontSize: 20 },
  sectionTitle: { fontFamily: Fonts.headingMedium, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontFamily: Fonts.body, fontSize: 15 },
  bodyMedium: { fontFamily: Fonts.bodyMedium, fontSize: 15 },
  caption: { fontFamily: Fonts.body, fontSize: 12 },
  tiny: { fontFamily: Fonts.body, fontSize: 10 },
} as const;

// ─── Spacing & Layout ────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
} as const;

// ─── Shadows (per-theme) ─────────────────────────────────────────

export const Shadows = {
  dark: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  },
  light: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 8 },
  },
} as const;

export type ShadowSet = typeof Shadows.dark | typeof Shadows.light;
