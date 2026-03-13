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
    text: '#0F0F0F',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#000000',
    success: '#22C55E',
    error: '#DC2626',
    timer: '#D97706',
  }
};

export const Fonts = {
  heading: 'ApfelGrotezk-Bold',
  headingMedium: 'ApfelGrotezk-Medium',
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodyBold: 'Inter-Bold',
  accent: 'InstrumentSerif-Regular',
  accentItalic: 'InstrumentSerif-Italic',
};

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Typography = {
  heading: { fontFamily: Fonts.accentItalic, fontSize: 32 },
  subheading: { fontFamily: Fonts.headingMedium, fontSize: 20 },
  sectionTitle: { fontFamily: Fonts.headingMedium, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontFamily: Fonts.body, fontSize: 15 },
  bodyMedium: { fontFamily: Fonts.bodyMedium, fontSize: 15 },
  caption: { fontFamily: Fonts.body, fontSize: 12 },
  tiny: { fontFamily: Fonts.body, fontSize: 10 },
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
};
