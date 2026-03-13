import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, TextInput, StyleSheet, Dimensions, Alert, AppState, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useWallpaperStore } from '../../engines/wallpaper/store';
import { useTodoStore } from '../../engines/todo/store';
import { DayData, WallpaperPreset, DotColorTheme } from '../../engines/wallpaper/types';
import { getLogicalDate } from '../../lib/date-utils';
import ErrorBoundary from '../../components/ErrorBoundary';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (19.5 / 9);
const MAX_DOTS = 1000;

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

// ─── Color Themes ───────────────────────────────────────────────────────────────

const DOT_THEMES: Record<DotColorTheme, { label: string; completed: (rate: number) => string; today: string; todayGlow: string }> = {
  classic: {
    label: 'Classic',
    completed: (rate) => {
      const v = Math.round(100 + 155 * rate);
      return `rgb(${v}, ${v}, ${v})`;
    },
    today: '#FFFFFF',
    todayGlow: 'rgba(255, 255, 255, 0.4)',
  },
  green: {
    label: 'Terminal',
    completed: (rate) => {
      const v = Math.round(60 + 195 * rate);
      return `rgb(0, ${v}, ${Math.round(v * 0.4)})`;
    },
    today: '#00FF66',
    todayGlow: 'rgba(0, 255, 102, 0.4)',
  },
  blue: {
    label: 'Ocean',
    completed: (rate) => {
      const b = Math.round(100 + 155 * rate);
      return `rgb(${Math.round(b * 0.4)}, ${Math.round(b * 0.7)}, ${b})`;
    },
    today: '#4488FF',
    todayGlow: 'rgba(68, 136, 255, 0.4)',
  },
  warm: {
    label: 'Amber',
    completed: (rate) => {
      const v = Math.round(100 + 155 * rate);
      return `rgb(${v}, ${Math.round(v * 0.7)}, ${Math.round(v * 0.2)})`;
    },
    today: '#FFB020',
    todayGlow: 'rgba(255, 176, 32, 0.4)',
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
      const completionRate = total > 0 ? completed / total : 0;

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

  // Check today first — if no completed tasks today, start from yesterday
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

function getDotColor(day: DayData, theme: DotColorTheme): string {
  const t = DOT_THEMES[theme];
  if (day.isToday) return t.today;
  if (day.isFuture) return 'rgba(255, 255, 255, 0.04)';
  if (day.completionRate === 0) return 'rgba(255, 255, 255, 0.08)';
  return t.completed(day.completionRate);
}

function DotGrid({ config, days }: { config: import('../../engines/wallpaper/types').WallpaperConfig; days: DayData[] }) {
  const { dotSize, spacing, cols, colorTheme } = config;
  const totalWidth = cols * (dotSize * 2 + spacing) - spacing;
  const availableWidth = PREVIEW_WIDTH - Spacing.md * 2 - 8; // account for frame border
  const scale = Math.min(1, availableWidth / totalWidth);
  const finalDot = dotSize * scale;
  const finalSpacing = spacing * scale;
  const finalWidth = cols * (finalDot * 2 + finalSpacing) - finalSpacing;
  const theme: DotColorTheme = colorTheme || 'classic';

  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
      <View style={{ width: finalWidth, flexDirection: 'row', flexWrap: 'wrap', gap: finalSpacing }}>
        {days.map((day, i) => {
          const isToday = day.isToday;
          const color = getDotColor(day, theme);
          return (
            <View
              key={i}
              style={{
                width: finalDot * 2,
                height: finalDot * 2,
                borderRadius: finalDot,
                backgroundColor: color,
                ...(isToday ? {
                  shadowColor: DOT_THEMES[theme].todayGlow,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: finalDot * 2,
                  elevation: 8,
                } : {}),
              }}
            />
          );
        })}
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

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

// ─── Date Input ─────────────────────────────────────────────────────────────────

function DateInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  const [year, setYear] = useState(() => value.split('-')[0] || '2028');
  const [month, setMonth] = useState(() => value.split('-')[1] || '01');
  const [day, setDay] = useState(() => value.split('-')[2] || '12');

  useEffect(() => {
    if (value && isValidDateStr(value)) {
      const parts = value.split('-');
      setYear(parts[0]);
      setMonth(parts[1]);
      setDay(parts[2]);
    }
  }, [value]);

  const commit = (y: string, m: string, d: string) => {
    const padM = m.padStart(2, '0');
    const padD = d.padStart(2, '0');
    onChange(`${y}-${padM}-${padD}`);
  };

  return (
    <View>
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

// ─── Main Screen ────────────────────────────────────────────────────────────────

function WallpaperScreenContent() {
  const { config, updateConfig } = useWallpaperStore();
  const todos = useTodoStore(s => s.todos);
  const viewShotRef = useRef<ViewShot>(null);
  const [savedToast, setSavedToast] = useState(false);

  const startDate = new Date(2026, 2, 10); // March 10, 2026
  const goalDate = config.goalDate || '2028-01-12';
  const goalDateValid = isValidDateStr(goalDate);

  const goalInPast = goalDateValid && getDaysLeft(goalDate) === 0;
  const endDate = goalDateValid && !goalInPast ? new Date(goalDate + 'T00:00:00') : new Date(startDate);

  const days = useMemo(() => {
    try {
      return computeDayData(startDate, endDate, todos);
    } catch {
      return [];
    }
  }, [todos, goalDate]);

  const daysLeft = goalDateValid ? getDaysLeft(goalDate) : 0;
  const dayNumber = getDayNumber(startDate);
  const streak = useMemo(() => computeStreak(todos), [todos]);
  const weekRate = useMemo(() => computeWeekCompletionRate(todos), [todos]);

  const dateError = goalDate.length >= 10 && !goalDateValid
    ? 'Invalid date (use YYYY-MM-DD)'
    : goalInPast
    ? 'Goal date has passed'
    : null;

  const displayNumber = config.showDaysLeft ? daysLeft : dayNumber;
  const displayLabel = config.showDaysLeft
    ? `days until ${config.goalTitle || '20'}`
    : `day ${dayNumber}`;

  const quote = useMemo(() => getDailyQuote(config.customQuote), [config.customQuote]);

  // Auto-refresh wallpaper on app open if logical date changed
  useEffect(() => {
    const checkAndRefresh = () => {
      if (!config.wallpaperEnabled) return;
      const logicalDate = getLogicalDate();
      if (config.lastWallpaperDate !== logicalDate) {
        handleSaveWallpaper(true);
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndRefresh();
    });

    checkAndRefresh();

    return () => sub.remove();
  }, [config.wallpaperEnabled, config.lastWallpaperDate]);

  const handleSaveWallpaper = useCallback(async (silent = false) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) Alert.alert('Permission needed', 'Allow gallery access to save wallpapers.');
        return;
      }

      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        updateConfig({ lastWallpaperDate: getLogicalDate() });
        if (!silent) {
          setSavedToast(true);
          setTimeout(() => setSavedToast(false), 3000);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (e) {
      if (!silent) Alert.alert('Error', 'Failed to save wallpaper.');
    }
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
    updateConfig(applyPreset(preset));
  };

  const isStats = config.preset === 'stats';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.heading}>Wallpaper</Text>

        {/* Live Preview — phone-shaped frame */}
        <View style={styles.phoneFrame}>
          <View style={styles.phoneNotch} />
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
            <View style={styles.preview}>
              {/* Subtle vignette gradient overlay */}
              <View style={styles.vignetteTop} />
              <View style={styles.vignetteBottom} />

              {/* Content */}
              <View style={styles.previewContent}>
                {config.showDayCount && (
                  <Text style={[
                    styles.previewDayCount,
                    { color: DOT_THEMES[config.colorTheme || 'classic'].today },
                  ]}>
                    {displayNumber}
                  </Text>
                )}
                {config.showDayCount && (
                  <Text style={styles.previewDayLabel}>{displayLabel}</Text>
                )}

                {/* Stats line (only in stats preset) */}
                {isStats && (
                  <View style={styles.statsRow}>
                    <Text style={styles.statItem}>{weekRate}% this week</Text>
                    <Text style={styles.statDivider}>·</Text>
                    <Text style={styles.statItem}>{streak}d streak</Text>
                  </View>
                )}

                <DotGrid config={config} days={days} />

                {config.showQuote && (
                  <Text style={styles.previewQuote}>{quote}</Text>
                )}
                {config.showStreak && !isStats && (
                  <Text style={styles.previewStreak}>
                    {streak} day streak · day {dayNumber}
                  </Text>
                )}
              </View>
            </View>
          </ViewShot>
        </View>

        {/* Toast */}
        {savedToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>✓ Wallpaper saved! Set it from your gallery.</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleSaveWallpaper(false);
            }}
          >
            <Text style={styles.saveBtnText}>Save to Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleShare();
            }}
          >
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Goal date passed notice */}
        {goalInPast && (
          <View style={styles.noGoalPrompt}>
            <Text style={styles.noGoalTitle}>Goal date has passed</Text>
            <Text style={styles.noGoalSubtext}>Update your goal date below to continue the countdown.</Text>
          </View>
        )}

        {/* ── STYLE section ── */}
        <CollapsibleSection title="Style">
          <View style={styles.presetRow}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.presetChip, config.preset === p.key && styles.presetChipActive]}
                onPress={() => handlePreset(p.key)}
              >
                <Text style={[styles.presetLabel, config.preset === p.key && styles.presetLabelActive]}>{p.label}</Text>
                <Text style={[styles.presetDesc, config.preset === p.key && styles.presetDescActive]}>{p.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color themes */}
          <Text style={[styles.inputLabel, { marginTop: Spacing.lg }]}>Dot Color</Text>
          <View style={styles.themeRow}>
            {(Object.keys(DOT_THEMES) as DotColorTheme[]).map(key => {
              const active = (config.colorTheme || 'classic') === key;
              const theme = DOT_THEMES[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateConfig({ colorTheme: key });
                  }}
                >
                  <View style={[styles.themeDot, { backgroundColor: theme.completed(1) }]} />
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{theme.label}</Text>
                </TouchableOpacity>
              );
            })}
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
              onChange={v => updateConfig({ showQuote: v })}
            />
            <ToggleControl
              label="Show Day Count"
              value={config.showDayCount}
              onChange={v => updateConfig({ showDayCount: v })}
            />
            <ToggleControl
              label="Show Days Left"
              value={config.showDaysLeft}
              onChange={v => updateConfig({ showDaysLeft: v })}
            />
            <ToggleControl
              label="Show Streak"
              value={config.showStreak}
              onChange={v => updateConfig({ showStreak: v })}
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

        {/* ── GOAL section ── */}
        <CollapsibleSection title="Goal" defaultOpen={false}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={config.goalTitle}
              onChangeText={v => updateConfig({ goalTitle: v })}
              placeholder="e.g. 20"
              placeholderTextColor={Colors.dark.textTertiary}
            />
          </View>
          <Text style={styles.inputLabel}>Date</Text>
          <DateInput
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
                text: 'Reset', style: 'destructive', onPress: () => updateConfig({
                  dotSize: 6, spacing: 14, opacity: 1, showQuote: true,
                  showDayCount: true, showStreak: true, cols: 25,
                  goalTitle: '20', goalDate: '2028-01-12', showDaysLeft: true,
                  preset: 'full', colorTheme: 'classic', customQuote: '',
                }),
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

  // Phone frame
  phoneFrame: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#333333',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 16,
    backgroundColor: '#1A1A1A',
  },
  phoneNotch: {
    width: 100,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: -8,
    zIndex: 10,
  },
  preview: {
    width: PREVIEW_WIDTH - 6, // account for border
    height: PREVIEW_HEIGHT,
    backgroundColor: '#080808',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    // Subtle gradient effect via layered opacity
    borderBottomWidth: 0,
    opacity: 0.3,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'transparent',
    opacity: 0.3,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  previewDayCount: {
    fontFamily: Fonts.accent,
    fontSize: 96,
    marginBottom: -8,
  },
  previewDayLabel: {
    color: '#666666',
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.lg,
  },
  previewQuote: {
    color: '#444444',
    fontFamily: Fonts.accentItalic,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    lineHeight: 18,
  },
  previewStreak: {
    color: '#3A3A3A',
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: Spacing.sm,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statItem: {
    color: '#555555',
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  statDivider: {
    color: '#333333',
    fontSize: 12,
  },

  // Toast
  toast: {
    backgroundColor: Colors.dark.success,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  toastText: {
    color: '#000000',
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  shareBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 18,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  shareBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionChevron: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
  },

  // Presets
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetChip: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
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

  // Color themes
  themeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 10,
  },
  themeChipActive: {
    borderColor: Colors.dark.textSecondary,
  },
  themeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  themeLabelActive: {
    color: Colors.dark.text,
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
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
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
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  quoteInput: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
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
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
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
    borderRadius: 14,
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

  // Reset
  resetBtn: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  resetBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
});
