import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, TextInput, StyleSheet, Dimensions, Alert, AppState, Platform, Share, ActivityIndicator, LayoutAnimation, UIManager, PixelRatio } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { setWallpaper, FLAG_BOTH } from '../../modules/wallpaper-setter';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useWallpaperStore } from '../../engines/wallpaper/store';
import { useTodoStore } from '../../engines/todo/store';
import { DayData, WallpaperPreset, WallpaperStyle, GridPosition } from '../../engines/wallpaper/types';
import { getLogicalDate } from '../../lib/date-utils';
import ErrorBoundary from '../../components/ErrorBoundary';
import { registerWallpaperTask, unregisterWallpaperTask, cacheWallpaperForBackground } from '../../engines/wallpaper/background-task';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Dimensions ──────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');
const SCREEN_WIDTH = Dimensions.get('window').width;
const WALLPAPER_W = SCREEN_W;
const WALLPAPER_H = SCREEN_H;
const PHONE_BORDER = 3;
const PREVIEW_WIDTH = SCREEN_WIDTH * 0.7;
const PREVIEW_SCALE = PREVIEW_WIDTH / SCREEN_W;
const PREVIEW_HEIGHT = SCREEN_H * PREVIEW_SCALE;
const MAX_DOTS = 1000;

// Content renders at device logical resolution (SCREEN_W x SCREEN_H).
// ViewShot captures at physical pixel resolution via PixelRatio.
const PIXEL_RATIO = PixelRatio.get();
const WP_SCALE = 1;
const wp = (v: number) => Math.round(v * 100) / 100;

// ─── Quote Pool ─────────────────────────────────────────────────────────────────

const QUOTE_POOL = [
  'Memento mori.',
  'Do the work.',
  'Discipline equals freedom.',
  'The obstacle is the way.',
  'Amor fati.',
  'Be water.',
  'Ship it.',
  'Less but better.',
  'Start before you\'re ready.',
  'Make it happen.',
  'No shortcuts.',
  'Trust the process.',
  'Stay hungry.',
  'Own your day.',
  'Execute.',
  'One thing at a time.',
  'Progress, not perfection.',
  'Show up daily.',
  'Outwork everyone.',
  'Build in silence.',
];

function getDailyQuote(customQuote: string): string {
  if (customQuote.trim()) return customQuote;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return QUOTE_POOL[dayOfYear % QUOTE_POOL.length];
}

// ─── Layout Constants (defaults, overridable via config) ─────────────────────────

const DEFAULT_TOP_PADDING = 60;
const DEFAULT_BOTTOM_PADDING = 210;
const DEFAULT_SIDE_PADDING = 16;

// ─── Wallpaper Styles ───────────────────────────────────────────────────────────

interface StyleTheme {
  label: string;
  desc: string;
  bg: string;
  dotCompleted: (rate: number) => string;
  dotToday: string;
  dotTodayGlow: string;
  dotFuture: string;
  dotEmpty: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  fontOverride?: string;
  gridLines?: boolean;
  cosmicGlow?: boolean;
  glowCompleted?: boolean;
  todayGlowSize?: number;      // multiplier for today's glow ring (default 2.8)
  headingWeight?: string;       // font weight override for heading number
}

const WALLPAPER_STYLES: Record<WallpaperStyle, StyleTheme> = {
  minimal: {
    label: 'Minimal',
    desc: 'Ultra clean',
    bg: '#080808',
    dotCompleted: (rate) => {
      const v = Math.round(60 + 195 * rate);
      return `rgb(${v}, ${v}, ${v})`;
    },
    dotToday: '#FFFFFF',
    dotTodayGlow: 'rgba(255, 255, 255, 0.4)',
    dotFuture: '#0E0E0E',
    dotEmpty: '#383838',
    textPrimary: '#FFFFFF',
    textSecondary: '#666666',
    textTertiary: '#444444',
    todayGlowSize: 3,
  },
  terminal: {
    label: 'Terminal',
    desc: 'Hacker mode',
    bg: '#0A0A0A',
    dotCompleted: (rate) => {
      const v = Math.round(60 + 195 * rate);
      return `rgb(0, ${v}, ${Math.round(v * 0.25)})`;
    },
    dotToday: '#00FF41',
    dotTodayGlow: 'rgba(0, 255, 65, 0.65)',
    dotFuture: '#0C100D',
    dotEmpty: '#003314',
    textPrimary: '#00FF41',
    textSecondary: '#00CC33',
    textTertiary: '#006620',
    fontOverride: 'monospace',
    glowCompleted: true,
    todayGlowSize: 3.2,
  },
  gradient: {
    label: 'Gradient',
    desc: 'Deep twilight',
    bg: '#0C0C1E',
    dotCompleted: (rate) => {
      const r = Math.round(50 + 130 * rate);
      const g = Math.round(50 + 150 * rate);
      const b = Math.round(70 + 185 * rate);
      return `rgb(${r}, ${g}, ${b})`;
    },
    dotToday: '#9BABFF',
    dotTodayGlow: 'rgba(155, 171, 255, 0.55)',
    dotFuture: '#0E0E1A',
    dotEmpty: '#282840',
    textPrimary: '#D0D8FF',
    textSecondary: '#6B73AA',
    textTertiary: '#3E4466',
    todayGlowSize: 3,
  },
  neon: {
    label: 'Neon',
    desc: 'Electric glow',
    bg: '#040410',
    dotCompleted: (rate) => {
      const v = Math.round(60 + 195 * rate);
      return `rgb(${Math.round(v * 0.95)}, ${Math.round(v * 0.15)}, ${v})`;
    },
    dotToday: '#FF33FF',
    dotTodayGlow: 'rgba(255, 51, 255, 0.7)',
    dotFuture: '#080612',
    dotEmpty: '#2A1838',
    textPrimary: '#FF55FF',
    textSecondary: '#AA33AA',
    textTertiary: '#552266',
    glowCompleted: true,
    todayGlowSize: 3.5,
  },
  paper: {
    label: 'Paper',
    desc: 'Warm & light',
    bg: '#F2EDE4',
    dotCompleted: (rate) => {
      const v = Math.round(190 - 160 * rate);
      return `rgb(${v}, ${Math.max(0, v - 8)}, ${Math.max(0, v - 18)})`;
    },
    dotToday: '#1A1A1A',
    dotTodayGlow: 'rgba(26, 26, 26, 0.2)',
    dotFuture: '#EBE7DF',
    dotEmpty: '#C8C0B2',
    textPrimary: '#1A1A1A',
    textSecondary: '#7A7870',
    textTertiary: '#A8A498',
    todayGlowSize: 2.8,
  },
  blueprint: {
    label: 'Blueprint',
    desc: 'Technical feel',
    bg: '#081828',
    dotCompleted: (rate) => {
      const v = Math.round(60 + 195 * rate);
      return `rgb(${Math.round(v * 0.35)}, ${Math.round(v * 0.65)}, ${v})`;
    },
    dotToday: '#5CACEE',
    dotTodayGlow: 'rgba(92, 172, 238, 0.55)',
    dotFuture: '#0A1A28',
    dotEmpty: '#1A3548',
    textPrimary: '#5CACEE',
    textSecondary: '#3A7AB0',
    textTertiary: '#1E4A6A',
    gridLines: true,
    glowCompleted: true,
    todayGlowSize: 3,
  },
  minimal_dark: {
    label: 'Void',
    desc: 'Pure darkness',
    bg: '#000000',
    dotCompleted: (rate) => {
      const v = Math.round(50 + 205 * rate);
      return `rgb(${v}, ${v}, ${v})`;
    },
    dotToday: '#FFFFFF',
    dotTodayGlow: 'rgba(255, 255, 255, 0.6)',
    dotFuture: '#080808',
    dotEmpty: '#303030',
    textPrimary: '#FFFFFF',
    textSecondary: '#4A4A4A',
    textTertiary: '#2A2A2A',
    todayGlowSize: 3.2,
  },
  cosmic: {
    label: 'Cosmic',
    desc: 'Purple shimmer',
    bg: '#06041A',
    dotCompleted: (rate) => {
      const r = Math.round(55 + 165 * rate);
      const g = Math.round(45 + 175 * rate);
      const b = Math.round(70 + 185 * rate);
      return `rgb(${r}, ${g}, ${b})`;
    },
    dotToday: '#E8DEFF',
    dotTodayGlow: 'rgba(180, 140, 255, 0.8)',
    dotFuture: '#08061C',
    dotEmpty: '#1E1838',
    textPrimary: '#E8DEFF',
    textSecondary: '#8B6EBB',
    textTertiary: '#4E3370',
    cosmicGlow: true,
    glowCompleted: true,
    todayGlowSize: 3.5,
  },
};

// ─── Presets ─────────────────────────────────────────────────────────────────────

const PRESETS: { key: WallpaperPreset; label: string; desc: string }[] = [
  { key: 'minimal', label: 'Minimal', desc: 'Dots only' },
  { key: 'countdown', label: 'Countdown', desc: 'Number + dots' },
  { key: 'full', label: 'Full', desc: 'Everything' },
  { key: 'stats', label: 'Stats', desc: 'Data focused' },
];

function applyPreset(preset: WallpaperPreset): Partial<import('../../engines/wallpaper/types').WallpaperConfig> {
  switch (preset) {
    case 'minimal':
      return { showQuote: false, showDayCount: false, showStreak: false, showDaysLeft: false, preset };
    case 'countdown':
      return { showQuote: false, showDayCount: true, showStreak: false, showDaysLeft: true, preset };
    case 'full':
      return { showQuote: true, showDayCount: true, showStreak: true, showDaysLeft: true, preset };
    case 'stats':
      return { showQuote: false, showDayCount: true, showStreak: true, showDaysLeft: true, preset };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00').getTime());
}

function computeDayData(startDate: Date, endDate: Date, todos: any[]): DayData[] {
  const days: DayData[] = [];
  try {
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return days;
    if (endDate < startDate) return days;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = new Date(startDate);

    while (current <= endDate && days.length < MAX_DOTS) {
      const dateStr = current.toISOString().split('T')[0];
      const dayTodos = todos.filter((t: any) => t.logicalDate === dateStr);
      const total = dayTodos.length;
      const completed = dayTodos.filter((t: any) => t.completed).length;
      // -1 means past day with no data (distinct from 0 which means had tasks but none completed)
      const completionRate = total > 0 ? completed / total : -1;

      const dayTime = new Date(current);
      dayTime.setHours(0, 0, 0, 0);

      days.push({
        date: dateStr,
        completionRate,
        isFuture: dayTime > today,
        isToday: dayTime.getTime() === today.getTime(),
      });
      current.setDate(current.getDate() + 1);
    }
  } catch {
    // Return whatever we have so far
  }
  return days;
}

function getDayNumber(startDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = today.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

function getDaysLeft(goalDate: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const goal = new Date(goalDate + 'T00:00:00');
    if (isNaN(goal.getTime())) return 0;
    const diff = goal.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function computeStreak(todos: any[]): number {
  const today = getLogicalDate();
  const dateSet = new Map<string, { total: number; completed: number }>();
  for (const t of todos) {
    const d = t.logicalDate;
    if (!d) continue;
    const entry = dateSet.get(d) || { total: 0, completed: 0 };
    entry.total++;
    if (t.completed) entry.completed++;
    dateSet.set(d, entry);
  }

  let streak = 0;
  const current = new Date(today + 'T12:00:00');

  const todayEntry = dateSet.get(today);
  if (!todayEntry || todayEntry.completed === 0) {
    current.setDate(current.getDate() - 1);
  }

  while (true) {
    const dateStr = current.toISOString().split('T')[0];
    const entry = dateSet.get(dateStr);
    if (!entry || entry.completed === 0) break;
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function computeWeekCompletionRate(todos: any[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let total = 0;
  let completed = 0;
  for (const t of todos) {
    if (!t.logicalDate) continue;
    const d = new Date(t.logicalDate + 'T00:00:00');
    if (d >= weekAgo && d <= today) {
      total++;
      if (t.completed) completed++;
    }
  }
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

// ─── Dot Grid ───────────────────────────────────────────────────────────────────

function getDotColor(day: DayData, style: StyleTheme): string {
  if (day.isToday) return style.dotToday;
  if (day.isFuture) return style.dotFuture;
  // Past day with no task data: neutral medium tone (distinct from completion levels)
  if (day.completionRate < 0) return style.dotEmpty;
  // Past day: GitHub-style intensity based on completion rate
  return style.dotCompleted(day.completionRate);
}

function DotGrid({ config, days, style, scaleFactor = 1 }: { config: import('../../engines/wallpaper/types').WallpaperConfig; days: DayData[]; style: StyleTheme; scaleFactor?: number }) {
  const { dotSize, spacing, cols } = config;
  const sDotSize = dotSize * scaleFactor;
  const sSpacing = spacing * scaleFactor;
  const dotDiameter = sDotSize * 2;
  const totalWidth = cols * dotDiameter + (cols - 1) * sSpacing;
  const sidePad = config.sidePadding ?? DEFAULT_SIDE_PADDING;
  const availableWidth = (SCREEN_W - sidePad * 2) * scaleFactor;
  const scale = Math.min(1, availableWidth / totalWidth);
  const finalDot = Math.round(dotDiameter * scale * 100) / 100;
  const finalSpacing = Math.round(sSpacing * scale * 100) / 100;
  const finalWidth = cols * finalDot + (cols - 1) * finalSpacing;
  const hasGlowEffect = style.glowCompleted || false;
  const glowSize = style.todayGlowSize || 2.8;

  const rows: DayData[][] = [];
  for (let i = 0; i < days.length; i += cols) {
    rows.push(days.slice(i, i + cols));
  }

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Blueprint grid overlay */}
      {style.gridLines && (
        <View style={{
          position: 'absolute',
          width: finalWidth + 16 * scaleFactor,
          height: '100%',
          borderWidth: 0.5 * scaleFactor,
          borderColor: 'rgba(92, 172, 238, 0.06)',
          borderRadius: 2 * scaleFactor,
        }} />
      )}
      <View style={{ width: finalWidth }}>
        {rows.map((row, rowIdx) => (
          <View
            key={rowIdx}
            style={{
              flexDirection: 'row',
              height: finalDot,
              marginBottom: rowIdx < rows.length - 1 ? finalSpacing : 0,
              alignItems: 'center',
            }}
          >
            {row.map((day, colIdx) => {
              const isToday = day.isToday;
              const color = getDotColor(day, style);
              const isCompletedPast = !day.isFuture && !day.isToday && day.completionRate > 0;
              const shouldGlow = hasGlowEffect && isCompletedPast;
              const dotScale = isCompletedPast ? 1.1 : 1;

              if (isToday) {
                return (
                  <View
                    key={colIdx}
                    style={{
                      width: finalDot,
                      height: finalDot,
                      marginRight: colIdx < cols - 1 ? finalSpacing : 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'visible',
                    }}
                  >
                    {/* Outer glow */}
                    <View style={{
                      position: 'absolute',
                      width: finalDot * glowSize,
                      height: finalDot * glowSize,
                      borderRadius: finalDot * glowSize,
                      backgroundColor: style.dotTodayGlow,
                    }} />
                    {/* Today dot */}
                    <View style={{
                      width: finalDot * 1.2,
                      height: finalDot * 1.2,
                      borderRadius: finalDot * 1.2,
                      backgroundColor: color,
                    }} />
                  </View>
                );
              }

              return (
                <View
                  key={colIdx}
                  style={{
                    width: finalDot,
                    height: finalDot,
                    borderRadius: finalDot,
                    backgroundColor: color,
                    marginRight: colIdx < cols - 1 ? finalSpacing : 0,
                    ...(dotScale !== 1 ? { transform: [{ scale: dotScale }] } : {}),
                    ...(shouldGlow ? {
                      shadowColor: color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5 + day.completionRate * 0.3,
                      shadowRadius: finalDot * 0.6,
                      elevation: 3 * scaleFactor,
                    } : {}),
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Controls ───────────────────────────────────────────────────────────────────

function NumericControl({ label, value, min, max, step = 1, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.controlButtons}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(Math.max(min, +(value - step).toFixed(2)));
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.controlValue}>{format ? format(value) : value}</Text>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(Math.min(max, +(value + step).toFixed(2)));
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.controlBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ToggleControl({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        trackColor={{ false: Colors.dark.surface, true: Colors.dark.textSecondary }}
        thumbColor={value ? Colors.dark.accent : Colors.dark.textTertiary}
      />
    </View>
  );
}

const ANIM_CONFIG = LayoutAnimation.create(
  250,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => {
          LayoutAnimation.configureNext(ANIM_CONFIG);
          setOpen(!open);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

// ─── Date Input ─────────────────────────────────────────────────────────────────

function DateInput({ value, onChange, error, label }: { value: string; onChange: (v: string) => void; error: string | null; label?: string }) {
  const [year, setYear] = useState(() => value.split('-')[0] || '2028');
  const [month, setMonth] = useState(() => value.split('-')[1] || '01');
  const [day, setDay] = useState(() => value.split('-')[2] || '12');

  useEffect(() => {
    if (value && isValidDateStr(value)) {
      const parts = value.split('-');
      setYear(parts[0] || '2028');
      setMonth(parts[1] || '01');
      setDay(parts[2] || '12');
    }
  }, [value]);

  const commit = (y: string, m: string, d: string) => {
    const padM = m.padStart(2, '0');
    const padD = d.padStart(2, '0');
    onChange(`${y}-${padM}-${padD}`);
  };

  return (
    <View>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={styles.dateInputRow}>
        <View style={styles.dateField}>
          <Text style={styles.dateFieldLabel}>Year</Text>
          <TextInput
            style={[styles.dateFieldInput, error ? { borderColor: Colors.dark.error } : null]}
            value={year}
            onChangeText={(v) => { setYear(v.replace(/\D/g, '').slice(0, 4)); }}
            onBlur={() => commit(year, month, day)}
            keyboardType="number-pad"
            maxLength={4}
            placeholderTextColor={Colors.dark.textTertiary}
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.dateFieldLabel}>Month</Text>
          <TextInput
            style={[styles.dateFieldInput, error ? { borderColor: Colors.dark.error } : null]}
            value={month}
            onChangeText={(v) => { setMonth(v.replace(/\D/g, '').slice(0, 2)); }}
            onBlur={() => commit(year, month, day)}
            keyboardType="number-pad"
            maxLength={2}
            placeholderTextColor={Colors.dark.textTertiary}
          />
        </View>
        <View style={styles.dateField}>
          <Text style={styles.dateFieldLabel}>Day</Text>
          <TextInput
            style={[styles.dateFieldInput, error ? { borderColor: Colors.dark.error } : null]}
            value={day}
            onChangeText={(v) => { setDay(v.replace(/\D/g, '').slice(0, 2)); }}
            onBlur={() => commit(year, month, day)}
            keyboardType="number-pad"
            maxLength={2}
            placeholderTextColor={Colors.dark.textTertiary}
          />
        </View>
      </View>
      {error && <Text style={styles.dateError}>{error}</Text>}
    </View>
  );
}

// ─── Vibe-Specific Overlays ─────────────────────────────────────────────────────

function VibeOverlay({ style: vibeStyle }: { style: WallpaperStyle }) {
  switch (vibeStyle) {
    case 'minimal':
      return (
        <>
          {/* Subtle radial gradient feel - slightly lighter center */}
          <View style={{
            position: 'absolute', top: '20%', left: '15%',
            width: '70%', height: '40%',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.008)',
          }} />
        </>
      );

    case 'gradient':
      return (
        <>
          {/* Top: warm purple tint */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
            backgroundColor: 'rgba(30, 20, 70, 0.4)',
          }} />
          {/* Bottom: deeper fade */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
            backgroundColor: 'rgba(6, 6, 20, 0.5)',
          }} />
          {/* Center ambient glow */}
          <View style={{
            position: 'absolute', top: '30%', left: '5%', width: '90%', height: '25%',
            borderRadius: 999, backgroundColor: 'rgba(100, 110, 200, 0.06)',
          }} />
        </>
      );

    case 'cosmic':
      return (
        <>
          {/* Large nebula glow */}
          <View style={{
            position: 'absolute', top: '10%', left: '5%',
            width: '90%', height: '60%',
            borderRadius: 999,
            backgroundColor: 'rgba(60, 30, 120, 0.12)',
          }} />
          {/* Inner bright core */}
          <View style={{
            position: 'absolute', top: '25%', left: '15%',
            width: '70%', height: '30%',
            borderRadius: 999,
            backgroundColor: 'rgba(100, 60, 200, 0.08)',
          }} />
          {/* Top right accent */}
          <View style={{
            position: 'absolute', top: '3%', right: '10%',
            width: '30%', height: '18%',
            borderRadius: 999,
            backgroundColor: 'rgba(140, 100, 255, 0.05)',
          }} />
          {/* Bottom left accent */}
          <View style={{
            position: 'absolute', bottom: '15%', left: '5%',
            width: '35%', height: '15%',
            borderRadius: 999,
            backgroundColor: 'rgba(120, 80, 220, 0.04)',
          }} />
        </>
      );

    case 'terminal':
      return (
        <>
          {/* CRT scanline effect */}
          {Array.from({ length: 50 }).map((_, i) => (
            <View key={`scan${i}`} style={{
              position: 'absolute',
              top: `${i * 2}%`,
              left: 0, right: 0,
              height: 1,
              backgroundColor: 'rgba(0, 255, 65, 0.02)',
            }} />
          ))}
          {/* Green ambient top */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '10%',
            backgroundColor: 'rgba(0, 255, 65, 0.025)',
          }} />
          {/* Green ambient bottom */}
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '10%',
            backgroundColor: 'rgba(0, 255, 65, 0.025)',
          }} />
          {/* Left edge glow (CRT curvature) */}
          <View style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '5%',
            backgroundColor: 'rgba(0, 255, 65, 0.015)',
          }} />
          {/* Right edge glow */}
          <View style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '5%',
            backgroundColor: 'rgba(0, 255, 65, 0.015)',
          }} />
        </>
      );

    case 'neon':
      return (
        <>
          {/* Bottom glow - strong */}
          <View style={{
            position: 'absolute', bottom: '5%', left: '5%',
            width: '90%', height: '35%',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 51, 255, 0.05)',
          }} />
          {/* Top glow */}
          <View style={{
            position: 'absolute', top: '5%', left: '15%',
            width: '70%', height: '25%',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 51, 255, 0.035)',
          }} />
          {/* Center cross-beam */}
          <View style={{
            position: 'absolute', top: '40%', left: '20%',
            width: '60%', height: '10%',
            borderRadius: 999,
            backgroundColor: 'rgba(200, 0, 255, 0.03)',
          }} />
        </>
      );

    case 'paper':
      return (
        <>
          {/* Warm vignette edges */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '18%',
            backgroundColor: 'rgba(190, 170, 140, 0.08)',
          }} />
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '18%',
            backgroundColor: 'rgba(190, 170, 140, 0.08)',
          }} />
          {/* Subtle warm center */}
          <View style={{
            position: 'absolute', top: '30%', left: '10%',
            width: '80%', height: '30%',
            borderRadius: 999,
            backgroundColor: 'rgba(220, 200, 160, 0.03)',
          }} />
        </>
      );

    case 'blueprint':
      return (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
        }}>
          {/* Horizontal grid lines */}
          {Array.from({ length: 24 }).map((_, i) => (
            <View key={`h${i}`} style={{
              position: 'absolute',
              top: `${(i + 1) * 4}%`,
              left: 0, right: 0,
              height: 0.5,
              backgroundColor: 'rgba(92, 172, 238, 0.05)',
            }} />
          ))}
          {/* Vertical grid lines */}
          {Array.from({ length: 14 }).map((_, i) => (
            <View key={`v${i}`} style={{
              position: 'absolute',
              left: `${(i + 1) * 7}%`,
              top: 0, bottom: 0,
              width: 0.5,
              backgroundColor: 'rgba(92, 172, 238, 0.05)',
            }} />
          ))}
          {/* Corner markers */}
          <View style={{
            position: 'absolute', top: 12, left: 12,
            width: 20, height: 20,
            borderTopWidth: 1.5, borderLeftWidth: 1.5,
            borderColor: 'rgba(92, 172, 238, 0.15)',
          }} />
          <View style={{
            position: 'absolute', top: 12, right: 12,
            width: 20, height: 20,
            borderTopWidth: 1.5, borderRightWidth: 1.5,
            borderColor: 'rgba(92, 172, 238, 0.15)',
          }} />
          <View style={{
            position: 'absolute', bottom: 12, left: 12,
            width: 20, height: 20,
            borderBottomWidth: 1.5, borderLeftWidth: 1.5,
            borderColor: 'rgba(92, 172, 238, 0.15)',
          }} />
          <View style={{
            position: 'absolute', bottom: 12, right: 12,
            width: 20, height: 20,
            borderBottomWidth: 1.5, borderRightWidth: 1.5,
            borderColor: 'rgba(92, 172, 238, 0.15)',
          }} />
          {/* Center crosshair */}
          <View style={{
            position: 'absolute', top: '49.5%', left: '30%',
            width: '40%', height: 0.5,
            backgroundColor: 'rgba(92, 172, 238, 0.06)',
          }} />
          <View style={{
            position: 'absolute', top: '40%', left: '49.5%',
            width: 0.5, height: '20%',
            backgroundColor: 'rgba(92, 172, 238, 0.06)',
          }} />
        </View>
      );

    case 'minimal_dark':
      return (
        <>
          {/* Subtle vignette edges */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '25%',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
          }} />
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
          }} />
          {/* Side vignettes */}
          <View style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '8%',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
          }} />
          <View style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: '8%',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
          }} />
        </>
      );

    default:
      return null;
  }
}

// ─── Wallpaper Content (renders at any size) ────────────────────────────────────

interface WallpaperContentProps {
  containerWidth: number;
  containerHeight: number;
  config: import('../../engines/wallpaper/types').WallpaperConfig;
  activeStyle: StyleTheme;
  fontFamily?: string;
  isTerminal: boolean;
  isStats: boolean;
  displayNumber: number;
  displayLabel: string;
  displaySubLabel: string | null;
  weekRate: number;
  streak: number;
  days: DayData[];
  quote: string;
  dayNumber: number;
}

function WallpaperContent({
  containerWidth, containerHeight, config, activeStyle, fontFamily,
  isTerminal, isStats, displayNumber, displayLabel, displaySubLabel,
  weekRate, streak, days, quote, dayNumber,
}: WallpaperContentProps) {
  // Scale factor relative to the reference device width (SCREEN_W)
  const s = containerWidth / SCREEN_W;

  return (
    <View style={{ width: containerWidth, height: containerHeight, backgroundColor: activeStyle.bg }}>
      <VibeOverlay style={config.wallpaperStyle || 'minimal'} />
      <View style={{
        flex: 1,
        paddingTop: (config.topPadding ?? DEFAULT_TOP_PADDING) * s,
        paddingBottom: (config.bottomPadding ?? DEFAULT_BOTTOM_PADDING) * s,
        paddingHorizontal: (config.sidePadding ?? DEFAULT_SIDE_PADDING) * s,
      }}>
        {/* ── Top: Heading ── */}
        <View style={{ alignItems: 'center', paddingTop: 16 * s }}>
          {config.showDayCount && (
            <Text style={[
              { fontFamily: Fonts.accent, fontSize: 110 * s, marginBottom: -8 * s, letterSpacing: -1 * s, color: activeStyle.textPrimary },
              fontFamily ? { fontFamily } : {},
              isTerminal ? { letterSpacing: -2 * s, fontSize: 92 * s } : {},
            ]}>
              {displayNumber}
            </Text>
          )}
          {config.showDayCount && (
            <Text style={[
              { fontFamily: Fonts.headingMedium, fontSize: 11 * s, letterSpacing: 3 * s, textTransform: 'uppercase', marginBottom: 6 * s, color: activeStyle.textSecondary },
              fontFamily ? { fontFamily, fontSize: 10 * s, letterSpacing: 4 * s } : {},
            ]}>{displayLabel}</Text>
          )}
          {config.showDayCount && displaySubLabel && (
            <Text style={[
              { fontFamily: Fonts.body, fontSize: 10 * s, letterSpacing: 0.5 * s, color: activeStyle.textTertiary, opacity: 0.7 },
              fontFamily ? { fontFamily, fontSize: 10 * s } : {},
            ]}>{displaySubLabel}</Text>
          )}
          {isStats && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 * s, gap: Spacing.sm * s }}>
              <Text style={[{ fontFamily: Fonts.bodyMedium, fontSize: 11 * s, letterSpacing: 0.5 * s, color: activeStyle.textSecondary }, fontFamily ? { fontFamily } : {}]}>
                {weekRate}% this week
              </Text>
              <Text style={{ fontSize: 11 * s, color: activeStyle.textTertiary }}>·</Text>
              <Text style={[{ fontFamily: Fonts.bodyMedium, fontSize: 11 * s, letterSpacing: 0.5 * s, color: activeStyle.textSecondary }, fontFamily ? { fontFamily } : {}]}>
                {streak}d streak
              </Text>
            </View>
          )}
        </View>

        {/* ── Middle: Dot Grid ── */}
        <View style={{ flex: 1, justifyContent: (config.gridPosition ?? 'center') === 'center' ? 'center' : 'flex-start', paddingVertical: 12 * s }}>
          <DotGrid config={config} days={days} style={activeStyle} scaleFactor={s} />
        </View>

        {/* ── Bottom: Quote + Streak (above dock) ── */}
        <View style={{ alignItems: 'center', paddingBottom: 8 * s }}>
          {config.showQuote && (
            <Text style={[
              { fontFamily: Fonts.accentItalic, fontSize: 13 * s, textAlign: 'center', paddingHorizontal: Spacing.xl * s, lineHeight: 20 * s, color: activeStyle.textTertiary },
              fontFamily ? { fontFamily, fontStyle: 'normal', fontSize: 12 * s } : {},
            ]}>"{quote}"</Text>
          )}
          {config.showStreak && !isStats && (
            <Text style={[
              { fontFamily: Fonts.body, fontSize: 10 * s, marginTop: 8 * s, letterSpacing: 1 * s, color: activeStyle.textTertiary, opacity: 0.7 },
              fontFamily ? { fontFamily } : {},
            ]}>
              {streak > 0 ? `${streak} day streak` : 'Start your streak'} · day {dayNumber}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────

function WallpaperScreenContent() {
  const { config, updateConfig } = useWallpaperStore();
  const todos = useTodoStore(s => s.todos);
  const viewShotRef = useRef<ViewShot>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [generating, setGenerating] = useState(false);

  const activeStyle = WALLPAPER_STYLES[config.wallpaperStyle || 'minimal'];
  const startDate = new Date((config.startDate || '2026-03-10') + 'T00:00:00');
  const goalDate = config.goalDate || '2028-01-12';
  const goalDateValid = isValidDateStr(goalDate);

  const goalInPast = goalDateValid && getDaysLeft(goalDate) === 0;
  const nowDate = new Date();
  nowDate.setHours(0, 0, 0, 0);
  const endDate = goalDateValid && !goalInPast
    ? new Date(goalDate + 'T00:00:00')
    : (startDate.getTime() <= nowDate.getTime() ? nowDate : new Date(startDate));

  const days = useMemo(() => {
    try {
      return computeDayData(startDate, endDate, todos);
    } catch {
      return [];
    }
  }, [todos, goalDate, config.startDate]);

  const daysLeft = goalDateValid ? getDaysLeft(goalDate) : 0;
  const dayNumber = getDayNumber(startDate);
  const streak = useMemo(() => computeStreak(todos), [todos]);
  const weekRate = useMemo(() => computeWeekCompletionRate(todos), [todos]);

  const dateError = goalDate.length >= 10 && !goalDateValid
    ? 'Invalid date (use YYYY-MM-DD)'
    : goalInPast
    ? 'Goal date has passed'
    : null;

  const startDateError = config.startDate && config.startDate.length >= 10 && !isValidDateStr(config.startDate)
    ? 'Invalid date'
    : null;

  const headingMode = config.headingMode || 'remaining_first';
  const goalLabel = config.goalTitle || '20';

  let displayNumber: number;
  let displayLabel: string;
  let displaySubLabel: string | null = null;

  if (headingMode === 'day_first') {
    displayNumber = dayNumber;
    displayLabel = `Day ${dayNumber}`;
    displaySubLabel = `${daysLeft} days remaining`;
    if (goalLabel) displaySubLabel += ` · ${goalLabel}`;
  } else {
    displayNumber = daysLeft;
    displayLabel = `days until ${goalLabel}`;
    displaySubLabel = `Day ${dayNumber}`;
    if (goalLabel) displaySubLabel += ` · ${goalLabel}`;
  }

  const quote = useMemo(() => getDailyQuote(config.customQuote), [config.customQuote]);

  // Auto-refresh wallpaper on app open if logical date changed
  useEffect(() => {
    const checkAndRefresh = async () => {
      if (!config.wallpaperEnabled && !config.wallpaperAutoUpdate) return;
      const logicalDate = getLogicalDate();
      if (config.lastWallpaperDate !== logicalDate) {
        handleSaveWallpaper(true);
      } else if (config.wallpaperAutoUpdate) {
        try {
          if (viewShotRef.current?.capture) {
            const uri = await viewShotRef.current.capture();
            const cachedPath = await cacheWallpaperForBackground(uri);
            if (cachedPath) updateConfig({ cachedWallpaperPath: cachedPath });
          }
        } catch (e) {
          console.error('Pre-generation cache failed:', e);
        }
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndRefresh();
    });

    checkAndRefresh();

    return () => sub.remove();
  }, [config.wallpaperEnabled, config.wallpaperAutoUpdate, config.lastWallpaperDate]);

  const handleSaveWallpaper = useCallback(async (silent = false) => {
    try {
      if (!silent) setGenerating(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) {
          setGenerating(false);
          Alert.alert('Permission needed', 'Allow gallery access to save wallpapers.');
        }
        return;
      }

      await new Promise(r => setTimeout(r, 150));

      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        updateConfig({ lastWallpaperDate: getLogicalDate() });

        if (Platform.OS === 'android') {
          try {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            await setWallpaper(fileUri, FLAG_BOTH);
          } catch (err) {
            console.error('Auto-set wallpaper failed:', err);
          }
        }

        if (config.wallpaperAutoUpdate) {
          const cachedPath = await cacheWallpaperForBackground(uri);
          if (cachedPath) updateConfig({ cachedWallpaperPath: cachedPath });
        }

        if (!silent) {
          setGenerating(false);
          setSavedToast(true);
          setTimeout(() => setSavedToast(false), 3000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        if (!silent) setGenerating(false);
      }
    } catch (e) {
      if (!silent) {
        setGenerating(false);
        Alert.alert('Error', 'Failed to save wallpaper.');
      }
    }
  }, [updateConfig, config.wallpaperAutoUpdate]);

  const handleSetWallpaper = useCallback(async () => {
    try {
      setGenerating(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setGenerating(false);
        Alert.alert('Permission needed', 'Allow gallery access to save and set wallpapers.');
        return;
      }

      await new Promise(r => setTimeout(r, 150));

      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await MediaLibrary.createAssetAsync(uri);
        updateConfig({ lastWallpaperDate: getLogicalDate() });

        if (Platform.OS === 'android') {
          try {
            const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
            await setWallpaper(fileUri, FLAG_BOTH);

            const cachedPath = await cacheWallpaperForBackground(uri);
            if (cachedPath) updateConfig({ cachedWallpaperPath: cachedPath });

            const registered = await registerWallpaperTask();
            updateConfig({ wallpaperAutoUpdate: true, wallpaperEnabled: true });

            setGenerating(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (err: any) {
            console.error('setWallpaper failed:', err);
            setGenerating(false);
            Alert.alert('Wallpaper Saved', 'Image saved to gallery but could not set wallpaper automatically. Set it manually from your gallery.');
          }
        } else {
          setGenerating(false);
          Alert.alert('Wallpaper Saved', 'Image saved to gallery. Set it as wallpaper from your Photos app.');
        }
      } else {
        setGenerating(false);
      }
    } catch (e) {
      setGenerating(false);
      Alert.alert('Error', 'Failed to set wallpaper.');
    }
  }, [updateConfig]);

  const handleDisableAutoUpdate = useCallback(async () => {
    await unregisterWallpaperTask();
    updateConfig({ wallpaperAutoUpdate: false, wallpaperEnabled: false });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [updateConfig]);

  const handleShare = useCallback(async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await Share.share({ url: uri });
      }
    } catch {
      // User cancelled or share failed
    }
  }, []);

  const handlePreset = (preset: WallpaperPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(ANIM_CONFIG);
    updateConfig(applyPreset(preset));
  };

  const isStats = config.preset === 'stats';
  const isTerminal = config.wallpaperStyle === 'terminal';
  const fontFamily = isTerminal ? 'monospace' : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.heading}>Wallpaper</Text>

        {/* ── Hidden full-res ViewShot for capture ── */}
        <View style={{ position: 'absolute', left: -9999, top: -9999 }} pointerEvents="none">
          <ViewShot
            ref={viewShotRef}
            options={{
              format: 'png',
              quality: 1,
              result: 'tmpfile',
            }}
          >
            <WallpaperContent
              containerWidth={WALLPAPER_W}
              containerHeight={WALLPAPER_H}
              config={config}
              activeStyle={activeStyle}
              fontFamily={fontFamily}
              isTerminal={isTerminal}
              isStats={isStats}
              displayNumber={displayNumber}
              displayLabel={displayLabel}
              displaySubLabel={displaySubLabel}
              weekRate={weekRate}
              streak={streak}
              days={days}
              quote={quote}
              dayNumber={dayNumber}
            />
          </ViewShot>
        </View>

        {/* ── Live Preview — phone frame ── */}
        <View style={[styles.phoneFrame, { width: PREVIEW_WIDTH + PHONE_BORDER * 2, alignSelf: 'center' }]}>
          <View style={styles.phoneNotch} />
          <View style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, overflow: 'hidden' }}>
            <WallpaperContent
              containerWidth={PREVIEW_WIDTH}
              containerHeight={PREVIEW_HEIGHT}
              config={config}
              activeStyle={activeStyle}
              fontFamily={fontFamily}
              isTerminal={isTerminal}
              isStats={isStats}
              displayNumber={displayNumber}
              displayLabel={displayLabel}
              displaySubLabel={displaySubLabel}
              weekRate={weekRate}
              streak={streak}
              days={days}
              quote={quote}
              dayNumber={dayNumber}
            />
          </View>
        </View>

        {/* Toast */}
        {savedToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Wallpaper set successfully</Text>
          </View>
        )}

        {/* Loading overlay */}
        {generating && (
          <View style={styles.generatingOverlay}>
            <ActivityIndicator size="small" color={Colors.dark.accent} />
            <Text style={styles.generatingText}>Setting wallpaper...</Text>
          </View>
        )}

        {/* ── Action Buttons ── */}
        {config.wallpaperAutoUpdate ? (
          <>
            <View style={styles.activeWallpaperCard}>
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <Text style={styles.activeLabel}>Wallpaper Active</Text>
              </View>
              <Text style={styles.activeSubtext}>Updates daily at 5:00 AM</Text>
            </View>
            <View style={styles.secondaryActionRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, generating && { opacity: 0.5 }]}
                disabled={generating}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSetWallpaper();
                }}
              >
                <Text style={styles.secondaryBtnText}>{generating ? 'Updating...' : 'Update Now'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleDisableAutoUpdate();
                }}
              >
                <Text style={[styles.secondaryBtnText, { color: Colors.dark.error }]}>Disable</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.setWallpaperBtn, generating && { opacity: 0.5 }]}
              disabled={generating}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSetWallpaper();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.setWallpaperBtnText}>
                {generating ? 'Setting Wallpaper...' : 'Set as Wallpaper'}
              </Text>
              <Text style={styles.setWallpaperSubtext}>Home & Lock screen</Text>
            </TouchableOpacity>
            <View style={styles.secondaryActionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleSaveWallpaper(false);
                }}
              >
                <Text style={styles.secondaryBtnText}>Save to Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleShare();
                }}
              >
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Goal passed notice */}
        {goalInPast && (
          <View style={styles.noGoalPrompt}>
            <Text style={styles.noGoalTitle}>Goal date has passed</Text>
            <Text style={styles.noGoalSubtext}>Update your goal date below to continue the countdown.</Text>
          </View>
        )}

        {/* ── STYLE section ── */}
        <CollapsibleSection title="Vibe & Layout">
          {/* Vibe selector with visual previews */}
          <Text style={styles.inputLabel}>Vibe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.sm }}>
              {(Object.keys(WALLPAPER_STYLES) as WallpaperStyle[]).map(key => {
                const s = WALLPAPER_STYLES[key];
                const active = (config.wallpaperStyle || 'minimal') === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.vibeChip, active && styles.vibeChipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      LayoutAnimation.configureNext(ANIM_CONFIG);
                      updateConfig({ wallpaperStyle: key });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.vibePreview, { backgroundColor: s.bg }]}>
                      <View style={[styles.vibeDotLg, {
                        backgroundColor: s.dotToday,
                        shadowColor: s.dotTodayGlow,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 4,
                        elevation: 4,
                      }]} />
                      <View style={[styles.vibeDotMd, { backgroundColor: s.dotCompleted(0.8) }]} />
                      <View style={[styles.vibeDotSm, { backgroundColor: s.dotCompleted(0.4) }]} />
                      <View style={[styles.vibeDotSm, { backgroundColor: s.dotEmpty, opacity: 0.6 }]} />
                    </View>
                    <Text style={[styles.vibeLabel, active && styles.vibeLabelActive]}>{s.label}</Text>
                    <Text style={[styles.vibeDesc, active && styles.vibeDescActive]}>{s.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Layout presets */}
          <Text style={styles.inputLabel}>Layout</Text>
          <View style={styles.presetRow}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.presetChip, config.preset === p.key && styles.presetChipActive]}
                onPress={() => handlePreset(p.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetLabel, config.preset === p.key && styles.presetLabelActive]}>{p.label}</Text>
                <Text style={[styles.presetDesc, config.preset === p.key && styles.presetDescActive]}>{p.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </CollapsibleSection>

        {/* ── LAYOUT section ── */}
        <CollapsibleSection title="Layout" defaultOpen={false}>
          <View style={styles.controls}>
            <NumericControl
              label="Top Padding"
              value={config.topPadding ?? DEFAULT_TOP_PADDING}
              min={40} max={120} step={5}
              onChange={v => updateConfig({ topPadding: v })}
              format={v => `${v}dp`}
            />
            <NumericControl
              label="Bottom Padding"
              value={config.bottomPadding ?? DEFAULT_BOTTOM_PADDING}
              min={100} max={300} step={10}
              onChange={v => updateConfig({ bottomPadding: v })}
              format={v => `${v}dp`}
            />
            <NumericControl
              label="Side Padding"
              value={config.sidePadding ?? DEFAULT_SIDE_PADDING}
              min={8} max={40} step={2}
              onChange={v => updateConfig({ sidePadding: v })}
              format={v => `${v}dp`}
            />
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Grid Position</Text>
              <TouchableOpacity
                style={styles.headingToggleBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  LayoutAnimation.configureNext(ANIM_CONFIG);
                  updateConfig({
                    gridPosition: (config.gridPosition ?? 'center') === 'center' ? 'top' : 'center',
                  });
                }}
              >
                <Text style={styles.headingToggleBtnText}>
                  {(config.gridPosition ?? 'center') === 'center' ? 'Center' : 'Top'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </CollapsibleSection>

        {/* ── GRID section ── */}
        <CollapsibleSection title="Grid" defaultOpen={false}>
          <View style={styles.controls}>
            <NumericControl
              label="Dot Size"
              value={config.dotSize}
              min={3} max={12}
              onChange={v => updateConfig({ dotSize: v })}
            />
            <NumericControl
              label="Spacing"
              value={config.spacing}
              min={8} max={24}
              onChange={v => updateConfig({ spacing: v })}
            />
            <NumericControl
              label="Columns"
              value={config.cols}
              min={15} max={35}
              onChange={v => updateConfig({ cols: v })}
            />
          </View>
          <Text style={styles.dotCountText}>
            {days.length} dots{days.length >= MAX_DOTS ? ` (capped at ${MAX_DOTS})` : ''}
          </Text>
        </CollapsibleSection>

        {/* ── DISPLAY section ── */}
        <CollapsibleSection title="Display" defaultOpen={false}>
          <View style={styles.controls}>
            <ToggleControl
              label="Show Quote"
              value={config.showQuote}
              onChange={v => {
                LayoutAnimation.configureNext(ANIM_CONFIG);
                updateConfig({ showQuote: v });
              }}
            />
            <ToggleControl
              label="Show Day Count"
              value={config.showDayCount}
              onChange={v => {
                LayoutAnimation.configureNext(ANIM_CONFIG);
                updateConfig({ showDayCount: v });
              }}
            />
            {/* Heading mode toggle */}
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Heading</Text>
              <TouchableOpacity
                style={styles.headingToggleBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  LayoutAnimation.configureNext(ANIM_CONFIG);
                  updateConfig({
                    headingMode: (config.headingMode || 'remaining_first') === 'remaining_first' ? 'day_first' : 'remaining_first',
                  });
                }}
              >
                <Text style={styles.headingToggleBtnText}>
                  {(config.headingMode || 'remaining_first') === 'day_first' ? `Day ${dayNumber}` : `${daysLeft} days left`}
                </Text>
              </TouchableOpacity>
            </View>
            <ToggleControl
              label="Show Streak"
              value={config.showStreak}
              onChange={v => {
                LayoutAnimation.configureNext(ANIM_CONFIG);
                updateConfig({ showStreak: v });
              }}
            />
            <ToggleControl
              label="Show Days Left"
              value={config.showDaysLeft}
              onChange={v => {
                LayoutAnimation.configureNext(ANIM_CONFIG);
                updateConfig({ showDaysLeft: v });
              }}
            />
            <ToggleControl
              label="Auto-refresh Daily"
              value={config.wallpaperEnabled}
              onChange={v => updateConfig({ wallpaperEnabled: v })}
            />

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>Custom Quote</Text>
            <TextInput
              style={styles.quoteInput}
              value={config.customQuote}
              onChangeText={v => updateConfig({ customQuote: v })}
              placeholder="Leave empty for daily rotation"
              placeholderTextColor={Colors.dark.textTertiary}
              multiline
            />
          </View>
        </CollapsibleSection>

        {/* ── DATES section ── */}
        <CollapsibleSection title="Dates" defaultOpen={false}>
          <DateInput
            label="Start Date"
            value={config.startDate || '2026-03-10'}
            onChange={v => updateConfig({ startDate: v })}
            error={startDateError}
          />

          <View style={{ height: Spacing.lg }} />

          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Goal Title</Text>
            <TextInput
              style={styles.input}
              value={config.goalTitle}
              onChangeText={v => updateConfig({ goalTitle: v })}
              placeholder="e.g. 20"
              placeholderTextColor={Colors.dark.textTertiary}
            />
          </View>
          <DateInput
            label="Goal Date"
            value={config.goalDate}
            onChange={v => updateConfig({ goalDate: v })}
            error={dateError}
          />
        </CollapsibleSection>

        {/* Reset */}
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            Alert.alert('Reset to Defaults', 'Reset all wallpaper settings?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset', style: 'destructive', onPress: () => {
                  LayoutAnimation.configureNext(ANIM_CONFIG);
                  updateConfig({
                    dotSize: 6, spacing: 14, opacity: 1, showQuote: true,
                    showDayCount: true, showStreak: true, cols: 25,
                    goalTitle: '20', goalDate: '2028-01-12', showDaysLeft: true,
                    preset: 'full', colorTheme: 'classic', customQuote: '',
                    wallpaperStyle: 'minimal', startDate: '2026-03-10',
                    headingMode: 'remaining_first',
                    topPadding: 60, bottomPadding: 210, sidePadding: 16,
                    gridPosition: 'center',
                  });
                },
              },
            ]);
          }}
        >
          <Text style={styles.resetBtnText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function WallpaperScreen() {
  return (
    <ErrorBoundary fallbackMessage="Failed to load wallpaper preview. Try resetting your goal date.">
      <WallpaperScreenContent />
    </ErrorBoundary>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
  },
  heading: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 36,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },

  // Phone frame — pixel-perfect preview
  phoneFrame: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: PHONE_BORDER,
    borderColor: '#2A2A2A',
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
    backgroundColor: '#111111',
  },
  phoneNotch: {
    width: 80,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2A2A2A',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    zIndex: 10,
  },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: '#080808',
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },

  // Preview typography
  previewDayCount: {
    fontFamily: Fonts.accent,
    fontSize: 100,
    marginBottom: -6,
    letterSpacing: -1,
  },
  previewDayLabel: {
    fontFamily: Fonts.headingMedium,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: Spacing.lg,
  },
  previewSubLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    opacity: 0.8,
  },
  previewQuote: {
    fontFamily: Fonts.accentItalic,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    lineHeight: 18,
    opacity: 0.9,
  },
  previewStreak: {
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statItem: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statDivider: {
    fontSize: 11,
  },

  // Toast
  toast: {
    backgroundColor: Colors.dark.success,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  toastText: {
    color: '#000000',
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },

  // Action buttons
  setWallpaperBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  setWallpaperBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  setWallpaperSubtext: {
    color: Colors.dark.background,
    fontFamily: Fonts.body,
    fontSize: 12,
    opacity: 0.5,
    marginTop: 4,
  },

  // Active wallpaper card
  activeWallpaperCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    paddingVertical: 20,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  activeLabel: {
    color: Colors.dark.success,
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
  },
  activeSubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  secondaryActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  sectionChevron: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
  },
  sectionContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },

  // Vibe/Style chips
  vibeChip: {
    width: 92,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  vibeChipActive: {
    borderColor: Colors.dark.accent,
    backgroundColor: '#1A1A1A',
  },
  vibePreview: {
    width: 60,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  vibeDotLg: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vibeDotMd: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vibeDotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  vibeLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
  },
  vibeLabelActive: {
    color: Colors.dark.accent,
  },
  vibeDesc: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
    marginTop: 2,
  },
  vibeDescActive: {
    color: Colors.dark.textSecondary,
  },

  // Presets
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetChip: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  presetLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  presetLabelActive: {
    color: Colors.dark.background,
  },
  presetDesc: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  presetDescActive: {
    color: Colors.dark.background,
    opacity: 0.7,
  },

  // Controls
  controls: {
    gap: Spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
  },
  controlLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  controlBtnText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontFamily: Fonts.body,
  },
  controlValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 20,
    minWidth: 40,
    textAlign: 'center',
  },
  headingToggleBtn: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headingToggleBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: Spacing.sm,
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  inputLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  quoteInput: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    minHeight: 48,
    textAlignVertical: 'top',
  },

  // Date input
  dateInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  dateFieldLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  dateFieldInput: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 18,
    textAlign: 'center',
  },
  dateError: {
    color: Colors.dark.error,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: Spacing.sm,
  },

  // Dot count
  dotCountText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // No goal / goal passed
  noGoalPrompt: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  noGoalTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  noGoalSubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Generating overlay
  generatingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  generatingText: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },

  // Reset
  resetBtn: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  resetBtnText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
});
