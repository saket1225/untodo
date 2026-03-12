import { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useTodoStore } from '../../engines/todo/store';
import { useProgressStore, getWeekStats, getRecentDays } from '../../engines/progress/store';
import { DaySummary } from '../../engines/progress/types';
import { getLogicalDate } from '../../lib/date-utils';
import { format } from 'date-fns';
import ErrorBoundary from '../../components/ErrorBoundary';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_MAX_HEIGHT = 120;

function TodaySummaryCard() {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const { completed, total, pomodoroMins, streak } = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const completed = todayTodos.filter(t => t.completed).length;
    const total = todayTodos.length;
    const pomodoroMins = todayTodos.reduce((s, t) => s + (t.pomodoroMinutesLogged || 0), 0);

    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = todos.filter(t => t.logicalDate === dateStr);
      const dayTotal = dayTodos.length;
      const dayCompleted = dayTodos.filter(t => t.completed).length;
      const rate = dayTotal > 0 ? dayCompleted / dayTotal : 0;
      if (i === 0 && dayTotal === 0) continue;
      if (dayTotal > 0 && rate >= 0.5) streak++;
      else if (dayTotal > 0) break;
    }
    return { completed, total, pomodoroMins, streak };
  }, [todos, logicalDate]);

  const progress = total > 0 ? completed / total : 0;
  const pct = Math.round(progress * 100);

  // Circular progress ring dimensions
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={styles.todayCard}>
      <View style={styles.todayCardInner}>
        {/* Circular Progress Ring */}
        <View style={styles.todayRingContainer}>
          <Svg width={size} height={size}>
            {/* Background ring */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={Colors.dark.border}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress ring */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={progress === 1 ? Colors.dark.success : Colors.dark.accent}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.todayRingCenter}>
            <Text style={styles.todayRingPct}>{pct}%</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.todayStats}>
          <Text style={styles.todayCardTitle}>Today</Text>
          <View style={styles.todayStatRow}>
            <Text style={styles.todayStatValue}>{completed}/{total}</Text>
            <Text style={styles.todayStatLabel}>tasks done</Text>
          </View>
          {pomodoroMins > 0 && (
            <View style={styles.todayStatRow}>
              <Text style={[styles.todayStatValue, { color: Colors.dark.timer }]}>{pomodoroMins}</Text>
              <Text style={styles.todayStatLabel}>focus mins</Text>
            </View>
          )}
          <View style={styles.todayStatRow}>
            <Text style={styles.todayStatValue}>{streak}</Text>
            <Text style={styles.todayStatLabel}>day streak</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TaskCompletionStreak() {
  const todos = useTodoStore(s => s.todos);

  const { streak, bestDay } = useMemo(() => {
    // Calculate consecutive days with >50% completion
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let bestDay: { date: string; rate: number; completed: number; total: number } | null = null;

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = todos.filter(t => t.logicalDate === dateStr);
      const total = dayTodos.length;
      const completed = dayTodos.filter(t => t.completed).length;
      const rate = total > 0 ? completed / total : 0;

      if (total > 0) {
        if (!bestDay || rate > bestDay.rate || (rate === bestDay.rate && completed > bestDay.completed)) {
          bestDay = { date: dateStr, rate, completed, total };
        }
      }

      if (i === 0 && total === 0) continue; // Skip today if no tasks yet
      if (total > 0 && rate >= 0.5) {
        streak++;
      } else if (total > 0) {
        break;
      }
    }

    return { streak, bestDay };
  }, [todos]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your Streak</Text>
      <View style={styles.streakCardRow}>
        <View style={styles.streakCard}>
          <Text style={styles.streakBigNum}>{streak}</Text>
          <Text style={styles.streakCardLabel}>day streak</Text>
          <Text style={styles.streakCardSub}>({'>'}50% completion)</Text>
        </View>
        {bestDay && (
          <View style={styles.streakCard}>
            <Text style={styles.streakBigNum}>{Math.round(bestDay.rate * 100)}%</Text>
            <Text style={styles.streakCardLabel}>best day</Text>
            <Text style={styles.streakCardSub}>
              {format(new Date(bestDay.date + 'T12:00:00'), 'MMM d')} ({bestDay.completed}/{bestDay.total})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function WeeklyOverview() {
  const todos = useTodoStore(s => s.todos);
  const stats = useMemo(() => getWeekStats(), [todos]);
  const pct = Math.round(stats.completionRate * 100);
  const hasData = stats.totalTasks > 0;

  // Total pomodoro minutes for the week
  const weekPomodoroMins = useMemo(() => {
    return stats.weekDays.reduce((sum, day) => {
      const dayTodos = todos.filter(t => t.logicalDate === day.date);
      return sum + dayTodos.reduce((s, t) => s + (t.pomodoroMinutesLogged || 0), 0);
    }, 0);
  }, [todos, stats]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>This Week</Text>

      {!hasData ? (
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle}>No tasks this week yet</Text>
          <Text style={styles.emptySubtext}>Start adding tasks to see your weekly progress</Text>
        </View>
      ) : (
        <>
          <View style={styles.weekHeaderRow}>
            <View>
              <Text style={styles.bigPct}>{pct}%</Text>
              <Text style={styles.bigPctLabel}>completion rate</Text>
            </View>
            {weekPomodoroMins > 0 && (
              <View style={styles.weekPomodoroCard}>
                <Text style={styles.weekPomodoroNum}>{weekPomodoroMins}</Text>
                <Text style={styles.weekPomodoroLabel}>focus mins</Text>
              </View>
            )}
          </View>

          <View style={styles.barChart}>
            {stats.weekDays.map((day, i) => {
              const rate = day.totalTasks > 0 ? day.completionRate : 0;
              const height = day.totalTasks > 0
                ? Math.max(4, (rate * BAR_MAX_HEIGHT))
                : 4;
              const isToday = day.date === new Date().toISOString().split('T')[0];
              const pctLabel = day.totalTasks > 0 ? `${Math.round(rate * 100)}%` : '';
              return (
                <View key={day.date} style={styles.barCol}>
                  {pctLabel ? (
                    <Text style={styles.barPctLabel}>{pctLabel}</Text>
                  ) : (
                    <Text style={styles.barPctLabel}> </Text>
                  )}
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
                    {/* Glow effect for bars with data */}
                    {day.totalTasks > 0 && rate > 0 && (
                      <View
                        style={[
                          styles.barGlow,
                          {
                            height: Math.min(height + 8, BAR_MAX_HEIGHT),
                            backgroundColor: isToday
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(136,136,136,0.06)',
                          },
                        ]}
                      />
                    )}
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
        </>
      )}
    </View>
  );
}

function Streaks() {
  const habits = useProgressStore(s => s.habits);
  const active = habits.filter(h => h.streak > 0);

  if (active.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Habit Streaks</Text>
      {active.map(h => (
        <View key={h.id} style={styles.habitRow}>
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
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtext}>Complete some tasks and your history will appear here</Text>
        </View>
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

const DayRow = memo(function DayRow({ day }: { day: DaySummary }) {
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
});

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

function ProgressScreenContent() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.textSecondary}
          />
        }
      >
        <Text style={styles.heading}>Progress</Text>
        <TodaySummaryCard />
        <TaskCompletionStreak />
        <WeeklyOverview />
        <Streaks />
        <DailyHistory />
        <WeeklyReviewSection />
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProgressScreen() {
  return (
    <ErrorBoundary>
      <ProgressScreenContent />
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
  // Today Summary Card
  todayCard: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  todayCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  todayRingContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayRingCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayRingPct: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 28,
    lineHeight: 32,
  },
  todayStats: {
    flex: 1,
    gap: Spacing.sm,
  },
  todayCardTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  todayStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  todayStatValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 22,
    lineHeight: 26,
  },
  todayStatLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
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

  // Streak cards
  streakCardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  streakBigNum: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 42,
    lineHeight: 48,
  },
  streakCardLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    marginTop: 2,
  },
  streakCardSub: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },

  // Empty state
  emptySection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
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

  // Weekly overview
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
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
  },
  weekPomodoroCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  weekPomodoroNum: {
    color: Colors.dark.timer,
    fontFamily: Fonts.accent,
    fontSize: 28,
  },
  weekPomodoroLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 44,
    marginBottom: Spacing.md,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  barPctLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
    height: 14,
  },
  barTrack: {
    width: 24,
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    zIndex: 2,
  },
  barGlow: {
    position: 'absolute',
    bottom: 0,
    left: -4,
    right: -4,
    borderRadius: 8,
    zIndex: 1,
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

  // Habit Streaks
  habitRow: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
});
