import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
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
        <View style={calStyles.container} onStartShouldSetResponder={() => true}>
          {/* Month navigation */}
          <View style={calStyles.monthRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={calStyles.monthArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={calStyles.monthTitle}>{monthNames[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={calStyles.monthArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={calStyles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={calStyles.weekDay}>{d}</Text>
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
                  style={[calStyles.dayCell, isSelected && calStyles.dayCellSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDate(dateStr);
                    onClose();
                  }}
                >
                  <Text style={[
                    calStyles.dayText,
                    isCurrentDay && !isSelected && calStyles.dayTextToday,
                    isSelected && calStyles.dayTextSelected,
                  ]}>
                    {day}
                  </Text>
                  {hasTasks && !isSelected && (
                    <View style={[calStyles.taskDot, hasIncomplete ? calStyles.taskDotIncomplete : calStyles.taskDotComplete]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick jump to today */}
          <TouchableOpacity
            style={calStyles.todayBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectDate(today);
              onClose();
            }}
          >
            <Text style={calStyles.todayBtnText}>Today</Text>
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.textSecondary,
    fontSize: 28,
    paddingHorizontal: 8,
  },
  monthTitle: {
    color: Colors.dark.text,
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
    color: Colors.dark.textTertiary,
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
  dayCellSelected: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 100,
  },
  dayText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  dayTextToday: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
  },
  dayTextSelected: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  taskDotIncomplete: {
    backgroundColor: Colors.dark.timer,
  },
  taskDotComplete: {
    backgroundColor: Colors.dark.success,
  },
  todayBtn: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  todayBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
