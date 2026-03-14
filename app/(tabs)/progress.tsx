import { useMemo, useState, useCallback, useRef, memo, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Share, Dimensions, Animated as RNAnimated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useTodoStore } from '../../engines/todo/store';
import { useProgressStore, getWeekStats, getRecentDays } from '../../engines/progress/store';
import { DaySummary } from '../../engines/progress/types';
import { getLogicalDate } from '../../lib/date-utils';
import { computeAnalytics, AnalyticsData } from '../../lib/insights';
import { format } from 'date-fns';
import ErrorBoundary from '../../components/ErrorBoundary';
import WeeklyReviewComponent from '../../engines/progress/components/WeeklyReview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_MAX_HEIGHT = 120;

// --- GitHub-style Contribution Graph ---
function ContributionGraph({ heatmap }: { heatmap: AnalyticsData['heatmap'] }) {
  const graphData = useMemo(() => {
    if (heatmap.length === 0) return { weeks: [], monthLabels: [], totalCompleted: 0, activeDays: 0 };
    // Organize into weeks (columns) with days (rows), GitHub-style
    const firstDate = new Date(heatmap[0].date + 'T12:00:00');
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7; // 0=Mon, 6=Sun

    // Build padded data
    const padded = [
      ...Array(firstDayOfWeek).fill({ date: '', count: 0, rate: 0 }),
      ...heatmap,
    ];

    // Split into weeks (columns)
    const weeks: typeof heatmap[] = [];
    for (let i = 0; i < padded.length; i += 7) {
      const week = padded.slice(i, i + 7);
      while (week.length < 7) week.push({ date: '', count: 0, rate: 0 });
      weeks.push(week);
    }

    // Month labels: find first occurrence of each month
    const monthLabels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    weeks.forEach((week, wi) => {
      for (const day of week) {
        if (!day.date) continue;
        const d = new Date(day.date + 'T12:00:00');
        const month = d.getMonth();
        if (month !== lastMonth) {
          lastMonth = month;
          monthLabels.push({ label: monthNames[month], weekIndex: wi });
          break;
        }
      }
    });

    const totalCompleted = heatmap.reduce((s, d) => s + d.count, 0);
    const activeDays = heatmap.filter(d => d.count > 0).length;

    return { weeks, monthLabels, totalCompleted, activeDays };
  }, [heatmap]);

  const getColor = (rate: number, count: number, date: string) => {
    if (!date) return 'transparent';
    if (count === 0) return Colors.dark.border;
    if (rate >= 0.9) return Colors.dark.success;
    if (rate >= 0.7) return '#4ADE80AA';
    if (rate >= 0.5) return '#4ADE8066';
    if (rate >= 0.2) return '#4ADE8033';
    return Colors.dark.surfaceHover;
  };

  if (graphData.weeks.length === 0) return null;

  const numWeeks = graphData.weeks.length;
  const cellSize = 14;
  const gap = 2;
  const gridWidth = numWeeks * (cellSize + gap);
  const availableWidth = SCREEN_WIDTH - Spacing.lg * 2 - 20;
  const needsScroll = gridWidth > availableWidth;
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to the end (most recent) on mount
  useEffect(() => {
    if (needsScroll && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [needsScroll]);

  return (
    <View style={styles.section}>
      <View style={styles.heatmapHeader}>
        <Text style={styles.sectionTitle}>Activity</Text>
        <Text style={styles.heatmapSummary}>
          {graphData.totalCompleted} done in {graphData.activeDays} day{graphData.activeDays !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal={needsScroll}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={needsScroll}
      >
        <View>
          {/* Month labels */}
          <View style={[styles.monthLabelsRow, { marginLeft: 20 }]}>
            {graphData.weeks.map((_, wi) => {
              const label = graphData.monthLabels.find(m => m.weekIndex === wi);
              return (
                <Text
                  key={wi}
                  style={[styles.monthLabel, { width: cellSize + gap }]}
                  numberOfLines={1}
                >
                  {label ? label.label : ''}
                </Text>
              );
            })}
          </View>

          <View style={styles.heatmapContainer}>
            {/* Day labels */}
            <View style={[styles.heatmapDayLabels, { gap }]}>
              {['M', '', 'W', '', 'F', '', ''].map((d, i) => (
                <Text key={i} style={[styles.heatmapDayLabel, { height: cellSize, lineHeight: cellSize }]}>{d}</Text>
              ))}
            </View>

            {/* Grid */}
            <View style={[styles.heatmapGrid, { gap }]}>
              {graphData.weeks.map((week, wi) => (
                <View key={wi} style={[styles.heatmapWeek, { gap }]}>
                  {week.map((day, di) => (
                    <View
                      key={di}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: getColor(day.rate, day.count, day.date),
                        borderRadius: 2,
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.heatmapLegend}>
        <Text style={styles.heatmapLegendText}>Less</Text>
        {[Colors.dark.border, '#4ADE8033', '#4ADE8066', '#4ADE80AA', Colors.dark.success].map((c, i) => (
          <View key={i} style={[styles.heatmapLegendDot, { backgroundColor: c }]} />
        ))}
        <Text style={styles.heatmapLegendText}>More</Text>
      </View>
    </View>
  );
}

// --- Category Breakdown ---
function CategoryBreakdown({ data }: { data: AnalyticsData['categoryBreakdown'] }) {
  if (data.length === 0) return null;
  const maxCount = data[0]?.count || 1;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Categories</Text>
      {data.map(item => (
        <View key={item.category} style={styles.catBarRow}>
          <Text style={[styles.catBarLabel, { color: item.color }]}>{item.label}</Text>
          <View style={styles.catBarTrack}>
            <View
              style={[
                styles.catBarFill,
                {
                  width: `${Math.max(4, (item.count / maxCount) * 100)}%`,
                  backgroundColor: item.color,
                },
              ]}
            />
          </View>
          <Text style={styles.catBarCount}>{item.count}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Analytics Summary Cards ---
function AnalyticsSummary({ analytics }: { analytics: AnalyticsData }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Insights</Text>
      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>{analytics.avgDailyCompletion}%</Text>
          <Text style={styles.analyticsLabel}>avg completion{'\n'}(30 days)</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsValue}>{analytics.mostProductiveDay.slice(0, 3)}</Text>
          <Text style={styles.analyticsLabel}>most productive{'\n'}day</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={[styles.analyticsValue, { color: Colors.dark.timer }]}>
            {analytics.avgPomodoroMinutes}m
          </Text>
          <Text style={styles.analyticsLabel}>avg focus{'\n'}per day</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={[styles.analyticsValue, { color: Colors.dark.success }]}>
            {analytics.longestStreak}
          </Text>
          <Text style={styles.analyticsLabel}>longest{'\n'}streak ever</Text>
        </View>
        {analytics.totalTimeTrackedMinutes > 0 && (
          <View style={styles.analyticsCard}>
            <Text style={[styles.analyticsValue, { color: Colors.dark.timer }]}>
              {analytics.totalTimeTrackedMinutes}m
            </Text>
            <Text style={styles.analyticsLabel}>total time{'\n'}tracked</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TodaySummaryCard() {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const { completed, total, pomodoroMins, streak, focusToday, weekRate } = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const completed = todayTodos.filter(t => t.completed).length;
    const total = todayTodos.length;
    const pomodoroMins = todayTodos.reduce((s, t) => s + (t.pomodoroMinutesLogged || 0), 0);

    // Calculate focus time (pomodoro + time tracking)
    const focusToday = todayTodos.reduce((s, t) => {
      let mins = t.pomodoroMinutesLogged || 0;
      if (t.timeTracking?.totalSeconds) mins += Math.floor(t.timeTracking.totalSeconds / 60);
      return s + mins;
    }, 0);

    // Weekly completion rate
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    let weekTotal = 0, weekCompleted = 0;
    for (const t of todos) {
      if (!t.logicalDate) continue;
      const d = new Date(t.logicalDate + 'T00:00:00');
      if (d >= weekAgo && d <= today) {
        weekTotal++;
        if (t.completed) weekCompleted++;
      }
    }
    const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

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
    return { completed, total, pomodoroMins, streak, focusToday, weekRate };
  }, [todos, logicalDate]);

  const progress = total > 0 ? completed / total : 0;
  const pct = Math.round(progress * 100);

  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={styles.todayCard}>
      {/* Prominent streak banner */}
      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakBannerFire}>🔥</Text>
          <Text style={styles.streakBannerNum}>{streak}</Text>
          <Text style={styles.streakBannerLabel}>day streak</Text>
        </View>
      )}

      <View style={styles.todayCardInner}>
        <View style={styles.todayRingContainer}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2} cy={size / 2} r={radius}
              stroke={Colors.dark.border} strokeWidth={strokeWidth} fill="transparent"
            />
            <Circle
              cx={size / 2} cy={size / 2} r={radius}
              stroke={progress === 1 ? Colors.dark.success : Colors.dark.accent}
              strokeWidth={strokeWidth} fill="transparent"
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
        <View style={styles.todayStats}>
          <Text style={styles.todayCardTitle}>Today</Text>
          <View style={styles.todayStatRow}>
            <Text style={styles.todayStatValue}>{completed}/{total}</Text>
            <Text style={styles.todayStatLabel}>tasks done</Text>
          </View>
          {focusToday > 0 && (
            <View style={styles.todayStatRow}>
              <Text style={[styles.todayStatValue, { color: Colors.dark.timer }]}>{focusToday}</Text>
              <Text style={styles.todayStatLabel}>focus mins</Text>
            </View>
          )}
          <View style={styles.todayStatRow}>
            <Text style={[styles.todayStatValue, { color: Colors.dark.success }]}>{weekRate}%</Text>
            <Text style={styles.todayStatLabel}>this week</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TaskCompletionStreak() {
  const todos = useTodoStore(s => s.todos);

  const { streak, bestDay } = useMemo(() => {
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
      if (i === 0 && total === 0) continue;
      if (total > 0 && rate >= 0.5) streak++;
      else if (total > 0) break;
    }
    return { streak, bestDay };
  }, [todos]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Your Streak</Text>
      <View style={styles.streakCardRow}>
        <View style={styles.streakCard}>
          <View style={styles.streakNumRow}>
            <Text style={styles.streakFlameIcon}>{streak > 0 ? '🔥' : '💤'}</Text>
            <Text style={styles.streakBigNum}>{streak}</Text>
          </View>
          <Text style={styles.streakCardLabel}>day streak</Text>
          <Text style={styles.streakCardSub}>{'>'}50% completion</Text>
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
              const height = day.totalTasks > 0 ? Math.max(4, (rate * BAR_MAX_HEIGHT)) : 4;
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
                            : day.totalTasks > 0 ? Colors.dark.textSecondary : Colors.dark.border,
                        },
                      ]}
                    />
                    {day.totalTasks > 0 && rate > 0 && (
                      <View
                        style={[
                          styles.barGlow,
                          {
                            height: Math.min(height + 8, BAR_MAX_HEIGHT),
                            backgroundColor: isToday ? 'rgba(255,255,255,0.06)' : 'rgba(136,136,136,0.06)',
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={[styles.barLabel, isToday && { color: Colors.dark.accent }]}>
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
          <Text style={styles.streakFlame}>🔥</Text>
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
        <Text style={styles.dayMeta}>{day.completedTasks}/{day.totalTasks} tasks</Text>
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

function ProgressEmptyHero() {
  const todos = useTodoStore(s => s.todos);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  if (todos.length > 0) return null;

  return (
    <RNAnimated.View style={[styles.emptyHero, { opacity: fadeAnim }]}>
      <Text style={styles.emptyHeroIcon}>◧</Text>
      <Text style={styles.emptyHeroTitle}>Your progress story starts here</Text>
      <Text style={styles.emptyHeroSubtext}>
        Complete tasks on the Today tab and watch your progress unfold. Every task counts.
      </Text>
    </RNAnimated.View>
  );
}

// --- Share Card ---
function ShareSection({ analytics }: { analytics: AnalyticsData }) {
  const viewShotRef = useRef<ViewShot>(null);
  const todos = useTodoStore(s => s.todos);

  const weekStats = useMemo(() => getWeekStats(), [todos]);
  const logicalDate = getLogicalDate();
  const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
  const streak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = todos.filter(t => t.logicalDate === dateStr);
      const total = dayTodos.length;
      const completed = dayTodos.filter(t => t.completed).length;
      if (i === 0 && total === 0) continue;
      if (total > 0 && completed / total >= 0.5) s++;
      else if (total > 0) break;
    }
    return s;
  }, [todos]);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          message: `This week: ${Math.round(weekStats.completionRate * 100)}% completion rate | ${streak} day streak | Powered by untodo`,
        });
      }
    } catch {
      // Share cancelled or failed
    }
  };

  const weekPct = Math.round(weekStats.completionRate * 100);
  const weekPomoMins = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return todos.reduce((sum, t) => {
      const d = new Date(t.logicalDate + 'T12:00:00');
      if (d >= weekAgo && d <= today) return sum + (t.pomodoroMinutesLogged || 0);
      return sum;
    }, 0);
  }, [todos]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Share Progress</Text>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.shareCard}>
          <Text style={styles.shareCardTitle}>Weekly Stats</Text>
          <View style={styles.shareStatsRow}>
            <View style={styles.shareStatItem}>
              <Text style={styles.shareStatValue}>{weekPct}%</Text>
              <Text style={styles.shareStatLabel}>completion</Text>
            </View>
            <View style={styles.shareStatItem}>
              <Text style={styles.shareStatValue}>{streak}</Text>
              <Text style={styles.shareStatLabel}>day streak</Text>
            </View>
            <View style={styles.shareStatItem}>
              <Text style={[styles.shareStatValue, { color: Colors.dark.timer }]}>{weekPomoMins}m</Text>
              <Text style={styles.shareStatLabel}>focus time</Text>
            </View>
          </View>
          <Text style={styles.shareWatermark}>Powered by untodo</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

function ProgressScreenContent() {
  const [refreshing, setRefreshing] = useState(false);
  const todos = useTodoStore(s => s.todos);
  const hasAnyTasks = todos.length > 0;
  const analytics = useMemo(() => computeAnalytics(todos), [todos]);

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
            title="Syncing..."
            titleColor={Colors.dark.textTertiary}
          />
        }
      >
        <Text style={styles.heading} accessibilityRole="header">Progress</Text>
        {!hasAnyTasks ? (
          <ProgressEmptyHero />
        ) : (
          <>
            <TodaySummaryCard />
            <ContributionGraph heatmap={analytics.heatmap} />
            <WeeklyReviewComponent />
            <AnalyticsSummary analytics={analytics} />
            <CategoryBreakdown data={analytics.categoryBreakdown} />
            <TaskCompletionStreak />
            <WeeklyOverview />
            <Streaks />
            <DailyHistory />
            <ShareSection analytics={analytics} />
          </>
        )}
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
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  streakBannerFire: {
    fontSize: 24,
  },
  streakBannerNum: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 32,
    lineHeight: 36,
  },
  streakBannerLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  todayCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  todayRingContainer: {
    position: 'relative',
    width: 140,
    height: 140,
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
    fontSize: 36,
    lineHeight: 40,
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

  // Contribution Graph (GitHub-style)
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  heatmapSummary: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  monthLabelsRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  monthLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
  },
  heatmapContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapDayLabels: {
    width: 16,
    justifyContent: 'flex-start',
  },
  heatmapDayLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
    textAlign: 'right',
  },
  heatmapGrid: {
    flexDirection: 'row',
    flex: 1,
  },
  heatmapWeek: {
    flexDirection: 'column',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
  },
  heatmapLegendText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
  },
  heatmapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },

  // Category breakdown
  catBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  catBarLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    width: 70,
  },
  catBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.dark.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  catBarCount: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accent,
    fontSize: 14,
    minWidth: 28,
    textAlign: 'right',
  },

  // Analytics summary
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  analyticsCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    alignItems: 'center',
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 2) / 3,
  },
  analyticsValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 24,
    lineHeight: 28,
  },
  analyticsLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },

  // Streak cards
  streakCardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
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
  streakNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakFlameIcon: {
    fontSize: 28,
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

  // Empty hero
  emptyHero: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: Spacing.xl,
  },
  emptyHeroIcon: {
    fontSize: 64,
    color: Colors.dark.textTertiary,
    marginBottom: Spacing.lg,
    opacity: 0.4,
  },
  emptyHeroTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptyHeroSubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barPctLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
    height: 14,
  },
  barTrack: {
    width: '100%',
    maxWidth: 36,
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.dark.surface,
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    zIndex: 2,
  },
  barGlow: {
    position: 'absolute',
    bottom: 0,
    left: -4,
    right: -4,
    borderRadius: 10,
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
    paddingVertical: 12,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
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

  // Share
  shareCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  shareCardTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 20,
    marginBottom: Spacing.md,
  },
  shareStatsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  shareStatItem: {
    alignItems: 'center',
  },
  shareStatValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 28,
  },
  shareStatLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  shareWatermark: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    opacity: 0.6,
  },
  shareBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  shareBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
});
