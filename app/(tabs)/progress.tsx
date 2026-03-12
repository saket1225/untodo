import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useTodoStore } from '../../engines/todo/store';
import { useProgressStore, getWeekStats, getRecentDays } from '../../engines/progress/store';
import { DaySummary } from '../../engines/progress/types';
import { format } from 'date-fns';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_MAX_HEIGHT = 120;

function WeeklyOverview() {
  const todos = useTodoStore(s => s.todos);
  const stats = useMemo(() => getWeekStats(), [todos]);
  const pct = Math.round(stats.completionRate * 100);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>This Week</Text>

      <Text style={styles.bigPct}>{pct}%</Text>
      <Text style={styles.bigPctLabel}>completion rate</Text>

      <View style={styles.barChart}>
        {stats.weekDays.map((day, i) => {
          const height = day.totalTasks > 0
            ? Math.max(4, (day.completionRate * BAR_MAX_HEIGHT))
            : 4;
          const isToday = day.date === new Date().toISOString().split('T')[0];
          return (
            <View key={day.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height,
                      backgroundColor: isToday
                        ? Colors.dark.accent
                        : day.totalTasks > 0
                          ? Colors.dark.textSecondary
                          : Colors.dark.border,
                    },
                  ]}
                />
              </View>
              <Text style={[
                styles.barLabel,
                isToday && { color: Colors.dark.accent },
              ]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalCompleted}</Text>
          <Text style={styles.statLabel}>completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalTasks}</Text>
          <Text style={styles.statLabel}>total</Text>
        </View>
      </View>
    </View>
  );
}

function Streaks() {
  const habits = useProgressStore(s => s.habits);
  const active = habits.filter(h => h.streak > 0);

  if (active.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Streaks</Text>
      {active.map(h => (
        <View key={h.id} style={styles.streakRow}>
          <Text style={styles.streakFlame}>*</Text>
          <Text style={styles.streakName}>{h.name}</Text>
          <Text style={styles.streakCount}>{h.streak}d</Text>
        </View>
      ))}
    </View>
  );
}

function DailyHistory() {
  const todos = useTodoStore(s => s.todos);
  const days = useMemo(() => getRecentDays(14), [todos]);
  const nonEmpty = days.filter(d => d.totalTasks > 0);

  if (nonEmpty.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        <Text style={styles.emptyText}>No task history yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>History</Text>
      {nonEmpty.map(day => (
        <DayRow key={day.date} day={day} />
      ))}
    </View>
  );
}

function DayRow({ day }: { day: DaySummary }) {
  const date = new Date(day.date + 'T12:00:00');
  const label = format(date, 'EEE, MMM d');
  const pct = Math.round(day.completionRate * 100);

  return (
    <View style={styles.dayRow}>
      <View style={styles.dayInfo}>
        <Text style={styles.dayDate}>{label}</Text>
        <Text style={styles.dayMeta}>
          {day.completedTasks}/{day.totalTasks} tasks
        </Text>
      </View>
      <View style={styles.dayBarContainer}>
        <View style={styles.dayBarTrack}>
          <View style={[styles.dayBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.dayPct}>{pct}%</Text>
      </View>
    </View>
  );
}

function WeeklyReviewSection() {
  const reviews = useProgressStore(s => s.weeklyReviews);
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const currentReview = reviews.find(r => r.weekStart === weekStartStr);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Weekly Review</Text>
      {currentReview ? (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewText}>{currentReview.review}</Text>
          <View style={styles.reviewStats}>
            <Text style={styles.reviewStatText}>
              {Math.round(currentReview.completionRate * 100)}% completion
            </Text>
            <Text style={styles.reviewStatText}>
              {currentReview.totalCompleted}/{currentReview.totalTasks} tasks
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.reviewPlaceholder}>
          <Text style={styles.reviewPlaceholderText}>
            Silicon will write your weekly review on Sunday
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProgressScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Progress</Text>
        <WeeklyOverview />
        <Streaks />
        <DailyHistory />
        <WeeklyReviewSection />
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

  // Weekly overview
  bigPct: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 72,
    lineHeight: 80,
  },
  bigPctLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 24,
    marginBottom: Spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barTrack: {
    width: 20,
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  statValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 28,
  },
  statLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  // Streaks
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  streakFlame: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  streakName: {
    flex: 1,
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  streakCount: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accent,
    fontSize: 18,
  },

  // Daily history
  dayRow: {
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.xs + 2,
  },
  dayDate: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  dayMeta: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  dayBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dayBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  dayBarFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 2,
  },
  dayPct: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accent,
    fontSize: 14,
    minWidth: 36,
    textAlign: 'right',
  },

  // Weekly review
  reviewCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  reviewText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  reviewStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: Spacing.sm,
  },
  reviewStatText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  reviewPlaceholder: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  reviewPlaceholderText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
});
