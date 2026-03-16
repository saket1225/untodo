export type WallpaperPreset = 'minimal' | 'countdown' | 'full' | 'stats';

export type DotColorTheme = 'classic' | 'green' | 'blue' | 'warm';

export type WallpaperStyle = 'minimal' | 'terminal' | 'gradient' | 'neon' | 'paper' | 'blueprint' | 'minimal_dark' | 'cosmic' | 'sunrise' | 'ocean' | 'blood' | 'snow';

export type HeadingMode = 'day_first' | 'remaining_first';

export type GridPosition = 'center' | 'top';

export type TodayMarkerStyle = 'glow' | 'ring' | 'pulse';

export type GridAlignment = 'left' | 'center' | 'right';

export interface WallpaperConfig {
  enabled: boolean;
  dotSize: number;
  spacing: number;
  opacity: number;
  showQuote: boolean;
  showDayCount: boolean;
  showStreak: boolean;
  cols: number;
  goalTitle: string;
  goalDate: string;
  showDaysLeft: boolean;
  wallpaperEnabled: boolean;
  lastWallpaperDate: string | null;
  preset: WallpaperPreset;
  colorTheme: DotColorTheme;
  customQuote: string;
  wallpaperStyle: WallpaperStyle;
  startDate: string; // YYYY-MM-DD
  headingMode: HeadingMode;
  wallpaperAutoUpdate: boolean;
  cachedWallpaperPath: string | null;
  topPadding: number;
  bottomPadding: number;
  sidePadding: number;
  gridPosition: GridPosition;
  glowIntensity: number;
  todayGlowSize: number;
  todayMarkerStyle: TodayMarkerStyle;
  todayGlowSoftness: number;
  bgGlowSoftness: number;
  bgGlowIntensity: number;
  gridAlignment: GridAlignment;
}

export interface DayData {
  date: string;
  completionRate: number; // 0-1, how much was completed
  isFuture: boolean;
  isToday: boolean;
}
