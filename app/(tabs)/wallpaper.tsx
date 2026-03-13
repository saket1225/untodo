import { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, TextInput, StyleSheet, Dimensions, Alert, AppState, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useWallpaperStore } from '../../engines/wallpaper/store';
import { useTodoStore } from '../../engines/todo/store';
import { DayData, WallpaperPreset } from '../../engines/wallpaper/types';
import { getLogicalDate } from '../../lib/date-utils';
import ErrorBoundary from '../../components/ErrorBoundary';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (19.5 / 9);
const MAX_DOTS = 1000;

const STOIC_QUOTES = [
  '"Memento mori — remember you must die."',
  '"We suffer more in imagination than in reality." — Seneca',
  '"The obstacle is the way." — Marcus Aurelius',
  '"No man is free who is not master of himself." — Epictetus',
  '"Waste no time arguing what a good man should be. Be one." — Marcus Aurelius',
  '"He who fears death will never do anything worthy of a living man." — Seneca',
  '"You have power over your mind, not outside events." — Marcus Aurelius',
  '"It is not that we have a short time to live, but that we waste much of it." — Seneca',
];

function getDailyQuote(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return STOIC_QUOTES[dayOfYear % STOIC_QUOTES.length];
}

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

function getDotColor(day: DayData, opacity: number): string {
  if (day.isToday) return '#FFFFFF';
  if (day.isFuture) return `rgba(28, 28, 28, ${opacity})`;
  if (day.completionRate === 0) return `rgba(68, 68, 68, ${opacity})`;
  const val = Math.round(68 + (255 - 68) * day.completionRate);
  return `rgba(${val}, ${val}, ${val}, ${opacity})`;
}

function DotGrid({ config, days }: { config: any; days: DayData[] }) {
  const { dotSize, spacing, cols, opacity } = config;
  const scaledDot = dotSize;
  const scaledSpacing = spacing;
  const totalWidth = cols * (scaledDot * 2 + scaledSpacing) - scaledSpacing;
  const availableWidth = PREVIEW_WIDTH - Spacing.md * 2;
  const scale = Math.min(1, availableWidth / totalWidth);
  const finalDot = scaledDot * scale;
  const finalSpacing = scaledSpacing * scale;
  const finalWidth = cols * (finalDot * 2 + finalSpacing) - finalSpacing;

  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
      <View style={{ width: finalWidth, flexDirection: 'row', flexWrap: 'wrap', gap: finalSpacing }}>
        {days.map((day, i) => (
          <View
            key={i}
            style={{
              width: finalDot * 2,
              height: finalDot * 2,
              borderRadius: finalDot,
              backgroundColor: getDotColor(day, opacity),
              ...(day.isToday ? {
                borderWidth: Math.max(1, finalDot * 0.3),
                borderColor: '#4488FF',
              } : {}),
            }}
          />
        ))}
      </View>
    </View>
  );
}

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
          <Text style={styles.controlBtnText}>-</Text>
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

const PRESETS: { key: WallpaperPreset; label: string; desc: string }[] = [
  { key: 'minimal', label: 'Minimal', desc: 'Dots only' },
  { key: 'countdown', label: 'Countdown', desc: 'Dots + days left' },
  { key: 'full', label: 'Full', desc: 'Everything' },
];

function applyPreset(preset: WallpaperPreset): Partial<import('../../engines/wallpaper/types').WallpaperConfig> {
  switch (preset) {
    case 'minimal':
      return { showQuote: false, showDayCount: false, showStreak: false, showDaysLeft: false, preset };
    case 'countdown':
      return { showQuote: false, showDayCount: true, showStreak: false, showDaysLeft: true, preset };
    case 'full':
      return { showQuote: true, showDayCount: true, showStreak: true, showDaysLeft: true, preset };
  }
}

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

function WallpaperScreenContent() {
  const { config, updateConfig } = useWallpaperStore();
  const todos = useTodoStore(s => s.todos);
  const viewShotRef = useRef<ViewShot>(null);

  const startDate = new Date(2026, 2, 10); // March 10, 2026
  const goalDate = config.goalDate || '2028-01-12';
  const goalDateValid = isValidDateStr(goalDate);

  // Validate: goal date must be in the future or at least today
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
  const dateError = goalDate.length >= 10 && !goalDateValid
    ? 'Invalid date (use YYYY-MM-DD)'
    : goalInPast
    ? 'Goal date is in the past'
    : null;
  const displayNumber = config.showDaysLeft ? daysLeft : dayNumber;
  const displayLabel = config.showDaysLeft
    ? `days until ${config.goalTitle || '20'}`
    : `day ${dayNumber}`;

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
          Alert.alert(
            'Saved to Gallery',
            'Open your gallery, find the image, and long-press it to set as wallpaper.\n\nOn most Android phones: Gallery → Image → Set as → Wallpaper',
          );
        }
      }
    } catch (e) {
      if (!silent) Alert.alert('Error', 'Failed to save wallpaper.');
    }
  }, [updateConfig]);

  const handlePreset = (preset: WallpaperPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateConfig(applyPreset(preset));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.heading}>Wallpaper</Text>

        {/* Live Preview — phone-shaped */}
        <View style={styles.previewFrame}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
            <View style={styles.preview}>
              {config.showDayCount && (
                <Text style={styles.previewDayCount}>{displayNumber}</Text>
              )}
              {config.showDayCount && (
                <Text style={styles.previewDayLabel}>{displayLabel}</Text>
              )}
              <DotGrid config={config} days={days} />
              {config.showQuote && (
                <Text style={styles.previewQuote}>{getDailyQuote()}</Text>
              )}
              {config.showStreak && (
                <Text style={styles.previewStreak}>0 day streak · day {dayNumber}</Text>
              )}
            </View>
          </ViewShot>
        </View>

        {/* Save Button — prominent */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleSaveWallpaper(false);
          }}
        >
          <Text style={styles.saveBtnText}>Save to Gallery</Text>
          <Text style={styles.saveBtnHint}>Then set as wallpaper from your gallery</Text>
        </TouchableOpacity>

        {/* No goal date prompt */}
        {(!goalDateValid || goalInPast) && !dateError && (
          <View style={styles.noGoalPrompt}>
            <Text style={styles.noGoalIcon}>◎</Text>
            <Text style={styles.noGoalTitle}>Set a goal to get started</Text>
            <Text style={styles.noGoalSubtext}>
              Pick a future date you're counting down to and watch the dots fill in as each day passes.
            </Text>
          </View>
        )}

        {/* Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Style</Text>
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
        </View>

        {/* Goal Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal</Text>
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
        </View>

        {/* Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customize</Text>
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
              label="Opacity"
              value={config.opacity}
              min={0.2} max={1} step={0.1}
              onChange={v => updateConfig({ opacity: v })}
              format={v => v.toFixed(1)}
            />
            <NumericControl
              label="Columns"
              value={config.cols}
              min={15} max={35}
              onChange={v => updateConfig({ cols: v })}
            />

            <View style={styles.divider} />

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
              label="Auto-refresh Wallpaper"
              value={config.wallpaperEnabled}
              onChange={v => updateConfig({ wallpaperEnabled: v })}
            />
          </View>
        </View>

        {/* Dot count info */}
        <Text style={styles.dotCountText}>
          {days.length} dots{days.length >= MAX_DOTS ? ` (capped at ${MAX_DOTS})` : ''}
        </Text>

        {/* Reset to defaults */}
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
                  preset: 'full',
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
  // Preview frame — phone-shaped
  previewFrame: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  preview: {
    width: PREVIEW_WIDTH - 4,
    height: PREVIEW_HEIGHT,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  previewDayCount: {
    color: '#F5F5F5',
    fontFamily: Fonts.accent,
    fontSize: 72,
    marginBottom: -6,
  },
  previewDayLabel: {
    color: '#888888',
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  previewQuote: {
    color: '#555555',
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    lineHeight: 16,
  },
  previewStreak: {
    color: '#444444',
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: Spacing.sm,
  },
  // Save button
  saveBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
  saveBtnHint: {
    color: Colors.dark.background,
    fontFamily: Fonts.body,
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
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
    fontSize: 14,
  },
  presetLabelActive: {
    color: Colors.dark.background,
  },
  presetDesc: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  presetDescActive: {
    color: Colors.dark.background,
    opacity: 0.7,
  },
  // Sections
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
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
  // Date picker
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
  dotCountText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  noGoalPrompt: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  noGoalIcon: {
    fontSize: 48,
    color: Colors.dark.textTertiary,
    marginBottom: Spacing.md,
    opacity: 0.4,
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
