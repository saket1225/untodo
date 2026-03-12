export interface WallpaperConfig {
  enabled: boolean;
  dotSize: number;
  spacing: number;
  opacity: number;
  showQuote: boolean;
  showDayCount: boolean;
  showStreak: boolean;
  cols: number;
}

export interface DayData {
  date: string;
  completionRate: number; // 0-1, how much was completed
  isFuture: boolean;
  isToday: boolean;
}
