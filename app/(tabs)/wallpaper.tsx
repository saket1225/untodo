import { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useWallpaperStore } from '../../engines/wallpaper/store';
import { useTodoStore } from '../../engines/todo/store';
import { DayData } from '../../engines/wallpaper/types';

const START_DATE = new Date(2026, 2, 10); // March 10, 2026
const END_DATE = new Date(2028, 0, 12);   // January 12, 2028
const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PREVIEW_HEIGHT = PREVIEW_WIDTH * (16 / 9);

function computeDayData(todos: any[]): DayData[] {
  const days: DayData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = new Date(START_DATE);

  while (current <= END_DATE) {
    const dateStr = current.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const total = dayTodos.length;
    const completed = dayTodos.filter(t => t.completed).length;
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
  return days;
}

function getDotColor(day: DayData, opacity: number): string {
  if (day.isToday) return Colors.dark.accent;
  if (day.isFuture) return `rgba(26, 26, 26, ${opacity})`;
  // Past: interpolate between #222 (0%) and #FFF (100%)
  const base = 0x22;
  const max = 0xFF;
  const val = Math.round(base + (max - base) * day.completionRate);
  const hex = val.toString(16).padStart(2, '0');
  return `rgba(${val}, ${val}, ${val}, ${opacity})`;
}

function DotGrid({ config, days }: { config: any; days: DayData[] }) {
  const { dotSize, spacing, cols, opacity } = config;
  const gridWidth = cols * (dotSize * 2 + spacing) - spacing;
  const scale = PREVIEW_WIDTH / Math.max(gridWidth, 1);
  const effectiveScale = Math.min(scale, 1);
  const scaledDot = dotSize * effectiveScale;
  const scaledSpacing = spacing * effectiveScale;

  const rows = Math.ceil(days.length / cols);
  const totalWidth = cols * (scaledDot * 2 + scaledSpacing) - scaledSpacing;

  return (
    <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
      <View style={{ width: totalWidth, flexDirection: 'row', flexWrap: 'wrap', gap: scaledSpacing }}>
        {days.map((day, i) => (
          <View
            key={i}
            style={{
              width: scaledDot * 2,
              height: scaledDot * 2,
              borderRadius: scaledDot,
              backgroundColor: getDotColor(day, opacity),
              ...(day.isToday ? {
                borderWidth: 1,
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
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        >
          <Text style={styles.controlBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.controlValue}>{format ? format(value) : value}</Text>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
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
        onValueChange={onChange}
        trackColor={{ false: Colors.dark.surface, true: Colors.dark.textSecondary }}
        thumbColor={value ? Colors.dark.accent : Colors.dark.textTertiary}
      />
    </View>
  );
}

export default function WallpaperScreen() {
  const { config, updateConfig } = useWallpaperStore();
  const todos = useTodoStore(s => s.todos);

  const days = useMemo(() => computeDayData(todos), [todos]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Wallpaper</Text>

        {/* Live Preview */}
        <View style={styles.preview}>
          {config.showDayCount && (
            <Text style={styles.previewDayCount}>
              {days.filter(d => d.isFuture).length}
            </Text>
          )}
          {config.showDayCount && (
            <Text style={styles.previewDayLabel}>days until 20</Text>
          )}
          <DotGrid config={config} days={days} />
          {config.showQuote && (
            <Text style={styles.previewQuote}>
              "Memento mori — remember you must die."
            </Text>
          )}
          {config.showStreak && (
            <Text style={styles.previewStreak}>0 day streak</Text>
          )}
        </View>

        {/* Controls */}
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
            label="Show Streak"
            value={config.showStreak}
            onChange={v => updateConfig({ showStreak: v })}
          />
          <ToggleControl
            label="Enable Wallpaper"
            value={config.enabled}
            onChange={v => updateConfig({ enabled: v })}
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
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
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
  },
  previewDayCount: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 64,
    marginBottom: -4,
  },
  previewDayLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  previewQuote: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  previewStreak: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: Spacing.sm,
  },
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
});
