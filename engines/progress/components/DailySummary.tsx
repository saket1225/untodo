import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { useTodoStore } from '../../todo/store';
import { getLogicalDate } from '../../../lib/date-utils';

export default function DailySummary() {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const stats = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const total = todayTodos.length;
    const completed = todayTodos.filter(t => t.completed).length;
    const focusMins = todayTodos.reduce((s, t) => {
      let mins = t.pomodoroMinutesLogged || 0;
      if (t.timeTracking?.totalSeconds) mins += Math.floor(t.timeTracking.totalSeconds / 60);
      return s + mins;
    }, 0);
    return { total, completed, focusMins };
  }, [todos, logicalDate]);

  if (stats.total === 0) return null;

  const pct = Math.round((stats.completed / stats.total) * 100);
  const allDone = stats.completed === stats.total;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.pct, allDone && { color: Colors.dark.success }]}>{pct}%</Text>
        <View style={styles.details}>
          <Text style={styles.label}>
            {stats.completed}/{stats.total} tasks {allDone ? 'done' : 'completed'}
          </Text>
          {stats.focusMins > 0 && (
            <Text style={styles.focus}>{stats.focusMins}m focused</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pct: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 28,
  },
  details: {
    flex: 1,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  focus: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});
