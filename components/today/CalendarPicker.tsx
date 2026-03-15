import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { getLogicalDate } from '../../lib/date-utils';
import { Todo } from '../../engines/todo/types';

export function CalendarPicker({
  selectedDate,
  allTodos,
  onSelectDate,
  onClose,
}: {
  selectedDate: string;
  allTodos: Todo[];
  onSelectDate: (date: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const selected = new Date(selectedDate + 'T12:00:00');
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [viewYear, setViewYear] = useState(selected.getFullYear());

  // Dates that have tasks
  const taskDates = useMemo(() => {
    const dates = new Set<string>();
    allTodos.forEach(t => dates.add(t.logicalDate));
    return dates;
  }, [allTodos]);

  // Dates that have incomplete tasks
  const incompleteDates = useMemo(() => {
    const dates = new Set<string>();
    allTodos.forEach(t => { if (!t.completed) dates.add(t.logicalDate); });
    return dates;
  }, [allTodos]);

  const today = getLogicalDate();

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    // Pad to complete weeks
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewMonth, viewYear]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[calStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]} onStartShouldSetResponder={() => true}>
          {/* Month navigation */}
          <View style={calStyles.monthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[calStyles.monthArrow, { color: colors.textSecondary }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[calStyles.monthTitle, { color: colors.text }]}>{monthNames[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[calStyles.monthArrow, { color: colors.textSecondary }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={calStyles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={[calStyles.weekDay, { color: colors.textTertiary }]}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={calStyles.grid}>
            {calendarDays.map((day, i) => {
              if (day === null) return <View key={i} style={calStyles.dayCell} />;
              const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
              const isSelected = dateStr === selectedDate;
              const isCurrentDay = dateStr === today;
              const hasTasks = taskDates.has(dateStr);
              const hasIncomplete = incompleteDates.has(dateStr);

              return (
                <TouchableOpacity
                  key={i}
                  style={[calStyles.dayCell, isSelected && { backgroundColor: colors.accent, borderRadius: 100 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDate(dateStr);
                    onClose();
                  }}
                >
                  <Text style={[
                    calStyles.dayText,
                    { color: colors.textSecondary },
                    isCurrentDay && !isSelected && { color: colors.accent, fontFamily: Fonts.bodyMedium },
                    isSelected && { color: colors.background, fontFamily: Fonts.bodyMedium },
                  ]}>
                    {day}
                  </Text>
                  {hasTasks && !isSelected && (
                    <View style={[calStyles.taskDot, { backgroundColor: hasIncomplete ? colors.timer : colors.success }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick jump to today */}
          <TouchableOpacity
            style={[calStyles.todayBtn, { borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(today);
              onClose();
            }}
          >
            <Text style={[calStyles.todayBtnText, { color: colors.textSecondary }]}>Today</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  container: {
    borderRadius: 20,
    padding: Spacing.lg,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  monthArrow: {
    fontSize: 28,
    paddingHorizontal: 8,
  },
  monthTitle: {
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  todayBtn: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  todayBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
