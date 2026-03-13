import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { useTodoStore } from '../../todo/store';
import { useProgressStore } from '../store';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function MiniRing({ progress, size = 36 }: { progress: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={Colors.dark.border} strokeWidth={strokeWidth} fill="transparent"
      />
      <Circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={progress >= 1 ? Colors.dark.success : progress > 0 ? Colors.dark.accent : 'transparent'}
        strokeWidth={strokeWidth} fill="transparent"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function WeeklyReview() {
  const todos = useTodoStore(s => s.todos);
  const reviews = useProgressStore(s => s.weeklyReviews);

  const weekData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const dayStats = days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayTodos = todos.filter(t => t.logicalDate === dateStr);
      const total = dayTodos.length;
      const completed = dayTodos.filter(t => t.completed).length;
      const rate = total > 0 ? completed / total : 0;
      const focusMins = dayTodos.reduce((s, t) => {
        let mins = t.pomodoroMinutesLogged || 0;
        if (t.timeTracking?.totalSeconds) mins += Math.floor(t.timeTracking.totalSeconds / 60);
        return s + mins;
      }, 0);
      const isPast = d < now;
      const isToday = dateStr === format(now, 'yyyy-MM-dd');
      return { date: dateStr, dayLabel: format(d, 'EEE'), dayNum: format(d, 'd'), total, completed, rate, focusMins, isPast, isToday };
    });

    const totalTasks = dayStats.reduce((s, d) => s + d.total, 0);
    const totalCompleted = dayStats.reduce((s, d) => s + d.completed, 0);
    const totalFocus = dayStats.reduce((s, d) => s + d.focusMins, 0);
    const completionRate = totalTasks > 0 ? totalCompleted / totalTasks : 0;
    const daysWithTasks = dayStats.filter(d => d.total > 0).length;
    const perfectDays = dayStats.filter(d => d.total > 0 && d.rate === 1).length;

    // Best category this week
    const catCounts: Record<string, number> = {};
    todos.filter(t => {
      const d = new Date(t.logicalDate + 'T12:00:00');
      return d >= weekStart && d <= weekEnd && t.completed && t.category;
    }).forEach(t => {
      catCounts[t.category!] = (catCounts[t.category!] || 0) + 1;
    });
    const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Compare with last week
    const lastWeekStart = subWeeks(weekStart, 1);
    const lastWeekEnd = subWeeks(weekEnd, 1);
    const lastWeekTodos = todos.filter(t => {
      const d = new Date(t.logicalDate + 'T12:00:00');
      return d >= lastWeekStart && d <= lastWeekEnd;
    });
    const lastWeekCompleted = lastWeekTodos.filter(t => t.completed).length;
    const lastWeekTotal = lastWeekTodos.length;
    const lastWeekRate = lastWeekTotal > 0 ? lastWeekCompleted / lastWeekTotal : 0;
    const rateChange = completionRate - lastWeekRate;

    // Silicon review
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const siliconReview = reviews.find(r => r.weekStart === weekStartStr);

    return {
      dayStats,
      totalTasks,
      totalCompleted,
      totalFocus,
      completionRate,
      daysWithTasks,
      perfectDays,
      topCategory,
      rateChange,
      siliconReview,
    };
  }, [todos, reviews]);

  if (weekData.totalTasks === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>This Week</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No tasks this week yet</Text>
          <Text style={styles.emptySubtext}>Add tasks to see your weekly review</Text>
        </View>
      </View>
    );
  }

  const pct = Math.round(weekData.completionRate * 100);
  const changeSign = weekData.rateChange > 0 ? '+' : '';
  const changeText = weekData.rateChange !== 0
    ? `${changeSign}${Math.round(weekData.rateChange * 100)}% vs last week`
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week</Text>

      {/* Day-by-day row */}
      <View style={styles.daysRow}>
        {weekData.dayStats.map(day => (
          <View key={day.date} style={styles.dayCol}>
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>
              {day.dayLabel.charAt(0)}
            </Text>
            <View style={styles.dayRingWrap}>
              <MiniRing progress={day.rate} />
              <Text style={[
                styles.dayNum,
                day.isToday && styles.dayNumToday,
                day.total > 0 && day.rate === 1 && styles.dayNumPerfect,
              ]}>
                {day.dayNum}
              </Text>
            </View>
            {day.total > 0 && (
              <Text style={styles.dayMeta}>{day.completed}/{day.total}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pct}%</Text>
          <Text style={styles.statLabel}>completion</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{weekData.totalCompleted}</Text>
          <Text style={styles.statLabel}>tasks done</Text>
        </View>
        {weekData.totalFocus > 0 && (
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.dark.timer }]}>{weekData.totalFocus}m</Text>
            <Text style={styles.statLabel}>focus time</Text>
          </View>
        )}
        {weekData.perfectDays > 0 && (
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.dark.success }]}>{weekData.perfectDays}</Text>
            <Text style={styles.statLabel}>perfect day{weekData.perfectDays !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Comparison */}
      {changeText && (
        <View style={styles.changeRow}>
          <Text style={[
            styles.changeText,
            { color: weekData.rateChange > 0 ? Colors.dark.success : Colors.dark.error },
          ]}>
            {changeText}
          </Text>
        </View>
      )}

      {/* Silicon review */}
      {weekData.siliconReview && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewLabel}>SILICON'S REVIEW</Text>
          <Text style={styles.reviewText}>{weekData.siliconReview.review}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },
  // Day-by-day row
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dayLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  dayLabelToday: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
  },
  dayRingWrap: {
    position: 'relative',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNum: {
    position: 'absolute',
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  dayNumToday: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
  },
  dayNumPerfect: {
    color: Colors.dark.success,
  },
  dayMeta: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    alignItems: 'center',
    flex: 1,
    minWidth: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 3) / 4,
  },
  statValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 22,
    lineHeight: 26,
  },
  statLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  // Change indicator
  changeRow: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  changeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
  },
  // Empty
  emptyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  // Silicon review
  reviewCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  reviewLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  reviewText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 15,
    lineHeight: 22,
  },
});
