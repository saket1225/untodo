import { useMemo, useState, useCallback, useRef, memo, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Share, Dimensions, Animated as RNAnimated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useTodoStore } from '../../engines/todo/store';
import { useProgressStore, getWeekStats } from '../../engines/progress/store';
import { getLogicalDate } from '../../lib/date-utils';
import { computeAnalytics, AnalyticsData } from '../../lib/insights';
import { calculateStreak } from '../../lib/streak';
import { format } from 'date-fns';
import ErrorBoundary from '../../components/ErrorBoundary';
import WeeklyReviewComponent from '../../engines/progress/components/WeeklyReview';
import { useAchievementStore } from '../../engines/achievements/store';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BAR_MAX_HEIGHT = 120;
const COLLAPSE_STORAGE_KEY = 'untodo-progress-collapse';

// --- Collapse state persistence ---
function useCollapseState(defaults: Record<string, boolean>) {
  const [state, setState] = useState(defaults);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSE_STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          setState(prev => ({ ...prev, ...saved }));
        } catch {}
      }
      loaded.current = true;
    });
  }, []);

  const toggle = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setState(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  return { collapsed: state, toggle };
}

// --- Collapsible Section Header ---
function CollapsibleHeader({ title, collapsed, onToggle, count }: {
  title: string; collapsed: boolean; onToggle: () => void; count?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.collapsibleHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.collapsibleHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count && <Text style={styles.collapsibleCount}>{count}</Text>}
      </View>
      <Text style={styles.collapsibleChevron}>{collapsed ? '\u25B6' : '\u25BC'}</Text>
    </TouchableOpacity>
  );
}

// --- Letter Grade ---
function getLetterGrade(pct: number): { grade: string; color: string } {
  if (pct >= 95) return { grade: 'A+', color: Colors.dark.success };
  if (pct >= 90) return { grade: 'A', color: Colors.dark.success };
  if (pct >= 85) return { grade: 'A-', color: Colors.dark.success };
  if (pct >= 80) return { grade: 'B+', color: '#4ADE80CC' };
  if (pct >= 75) return { grade: 'B', color: '#4ADE80AA' };
  if (pct >= 70) return { grade: 'B-', color: '#4ADE8088' };
  if (pct >= 65) return { grade: 'C+', color: Colors.dark.timer };
  if (pct >= 60) return { grade: 'C', color: Colors.dark.timer };
  if (pct >= 55) return { grade: 'C-', color: Colors.dark.timer };
  if (pct >= 50) return { grade: 'D+', color: '#EF444499' };
  if (pct >= 45) return { grade: 'D', color: Colors.dark.error };
  if (pct >= 40) return { grade: 'D-', color: Colors.dark.error };
  return { grade: 'F', color: Colors.dark.error };
}

// --- 1. Today's Progress Ring ---
function TodayProgressRing() {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const { completed, total, focusMins } = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const completed = todayTodos.filter(t => t.completed).length;
    const total = todayTodos.length;
    const focusMins = todayTodos.reduce((s, t) => {
      let mins = t.pomodoroMinutesLogged || 0;
      if (t.timeTracking?.totalSeconds) mins += Math.floor(t.timeTracking.totalSeconds / 60);
      return s + mins;
    }, 0);
    return { completed, total, focusMins };
  }, [todos, logicalDate]);

  const progress = total > 0 ? completed / total : 0;
  const pct = Math.round(progress * 100);

  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={styles.ringSection}>
      <View style={styles.ringContainer}>
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
        <View style={styles.ringCenter}>
          <Text style={styles.ringPct}>{pct}%</Text>
          <Text style={styles.ringLabel}>{completed}/{total}</Text>
        </View>
      </View>
      {focusMins > 0 && (
        <Text style={styles.ringFocus}>{focusMins}m focused today</Text>
      )}
    </View>
  );
}

// --- 2. Daily Score Letter Grade ---
function DailyScoreGrade() {
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const { grade, color, pct } = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const total = todayTodos.length;
    const completed = todayTodos.filter(t => t.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const { grade, color } = total > 0 ? getLetterGrade(pct) : { grade: '-', color: Colors.dark.textTertiary };
    return { grade, color, pct };
  }, [todos, logicalDate]);

  return (
    <View style={styles.gradeCard}>
      <Text style={[styles.gradeValue, { color }]}>{grade}</Text>
      <View>
        <Text style={styles.gradeLabel}>Daily Score</Text>
        <Text style={styles.gradeSub}>{pct}% completion</Text>
      </View>
    </View>
  );
}

// --- 3. Streak Counter ---
function StreakCounter() {
  const todos = useTodoStore(s => s.todos);
  const streak = useMemo(() => calculateStreak(todos), [todos]);

  return (
    <View style={styles.streakCard}>
      <Text style={styles.streakEmoji}>{streak > 0 ? '\uD83D\uDD25' : '\uD83D\uDCA4'}</Text>
      <Text style={styles.streakNum}>{streak}</Text>
      <Text style={styles.streakLabel}>day streak</Text>
    </View>
  );
}

// --- 4. Weekly Bar Chart ---
function WeeklyBarChart() {
  const todos = useTodoStore(s => s.todos);
  const stats = useMemo(() => getWeekStats(), [todos]);
  const hasData = stats.totalTasks > 0;

  if (!hasData) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle}>No tasks this week yet</Text>
        </View>
      </View>
    );
  }

  const pct = Math.round(stats.completionRate * 100);

  return (
    <View style={styles.section}>
      <View style={styles.weekHeader}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <Text style={styles.weekPct}>{pct}%</Text>
      </View>
      <View style={styles.barChart}>
        {stats.weekDays.map((day, i) => {
          const rate = day.totalTasks > 0 ? day.completionRate : 0;
          const height = day.totalTasks > 0 ? Math.max(4, rate * BAR_MAX_HEIGHT) : 4;
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
              </View>
              <Text style={[styles.barLabel, isToday && { color: Colors.dark.accent }]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.weekStatsRow}>
        <Text style={styles.weekStatText}>{stats.totalCompleted} completed</Text>
        <View style={styles.weekStatDot} />
        <Text style={styles.weekStatText}>{stats.totalTasks} total</Text>
      </View>
    </View>
  );
}

// --- 5. Contribution Graph ---
function ContributionGraph({ heatmap }: { heatmap: AnalyticsData['heatmap'] }) {
  const graphData = useMemo(() => {
    if (heatmap.length === 0) return { weeks: [], monthLabels: [], totalCompleted: 0, activeDays: 0 };
    const firstDate = new Date(heatmap[0].date + 'T12:00:00');
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7;
    const padded = [
      ...Array(firstDayOfWeek).fill({ date: '', count: 0, rate: 0 }),
      ...heatmap,
    ];
    const weeks: typeof heatmap[] = [];
    for (let i = 0; i < padded.length; i += 7) {
      const week = padded.slice(i, i + 7);
      while (week.length < 7) week.push({ date: '', count: 0, rate: 0 });
      weeks.push(week);
    }
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
          <View style={[styles.monthLabelsRow, { marginLeft: 20 }]}>
            {graphData.weeks.map((_, wi) => {
              const label = graphData.monthLabels.find(m => m.weekIndex === wi);
              return (
                <Text key={wi} style={[styles.monthLabel, { width: cellSize + gap }]} numberOfLines={1}>
                  {label ? label.label : ''}
                </Text>
              );
            })}
          </View>
          <View style={styles.heatmapContainer}>
            <View style={[styles.heatmapDayLabels, { gap }]}>
              {['M', '', 'W', '', 'F', '', ''].map((d, i) => (
                <Text key={i} style={[styles.heatmapDayLabel, { height: cellSize, lineHeight: cellSize }]}>{d}</Text>
              ))}
            </View>
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

// --- 6. Weekly Review (Collapsible) ---
// Uses the existing WeeklyReviewComponent

// --- 7. Achievements Grid (Collapsible) ---
function AchievementsGrid() {
  const achievements = useAchievementStore(s => s.achievements);
  const unlocked = achievements.filter(a => a.unlockedAt);

  return (
    <View style={styles.achievementsGrid}>
      {achievements.map(a => (
        <View
          key={a.id}
          style={[styles.achievementBadge, !a.unlockedAt && styles.achievementLocked]}
        >
          <Text style={[styles.achievementIcon, !a.unlockedAt && { opacity: 0.2 }]}>{a.icon}</Text>
          <Text style={[styles.achievementTitle, !a.unlockedAt && { color: Colors.dark.textTertiary }]} numberOfLines={1}>
            {a.title}
          </Text>
          <Text style={styles.achievementDesc} numberOfLines={2}>{a.description}</Text>
        </View>
      ))}
    </View>
  );
}

// --- 8. Deep Statistics (Collapsible) ---
function DeepStatistics({ analytics, todos }: { analytics: AnalyticsData; todos: any[] }) {
  const stats = useMemo(() => {
    const allCompleted = todos.filter((t: any) => t.completed);
    const totalCompleted = allCompleted.length;
    const totalTasks = todos.length;
    const datesWithTasks = new Set(todos.map((t: any) => t.logicalDate));
    const avgPerDay = datesWithTasks.size > 0 ? (totalCompleted / datesWithTasks.size).toFixed(1) : '0';
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    const hourBuckets: number[] = new Array(24).fill(0);
    allCompleted.forEach((t: any) => {
      if (t.updatedAt) {
        const hour = new Date(t.updatedAt).getHours();
        hourBuckets[hour]++;
      }
    });
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const timeOfDay = peakHour < 6 ? 'Late night' : peakHour < 12 ? 'Morning' : peakHour < 17 ? 'Afternoon' : peakHour < 21 ? 'Evening' : 'Night';
    const peakHourLabel = peakHour === 0 ? '12am' : peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`;

    let totalFocusMins = 0;
    todos.forEach((t: any) => {
      totalFocusMins += t.pomodoroMinutesLogged || 0;
      if (t.timeTracking?.totalSeconds) totalFocusMins += Math.floor(t.timeTracking.totalSeconds / 60);
    });
    const focusHours = Math.floor(totalFocusMins / 60);
    const focusMins = totalFocusMins % 60;
    const focusLabel = focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${focusMins}m`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let recent7Completed = 0, recent7Total = 0;
    let prev7Completed = 0, prev7Total = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = todos.filter((t: any) => t.logicalDate === dateStr);
      const completed = dayTodos.filter((t: any) => t.completed).length;
      if (i < 7) { recent7Completed += completed; recent7Total += dayTodos.length; }
      else { prev7Completed += completed; prev7Total += dayTodos.length; }
    }
    const recentRate = recent7Total > 0 ? recent7Completed / recent7Total : 0;
    const prevRate = prev7Total > 0 ? prev7Completed / prev7Total : 0;
    const trend = recentRate > prevRate + 0.05 ? 'improving' : recentRate < prevRate - 0.05 ? 'declining' : 'steady';
    const trendIcon = trend === 'improving' ? '\u2191' : trend === 'declining' ? '\u2193' : '\u2192';
    const trendColor = trend === 'improving' ? Colors.dark.success : trend === 'declining' ? Colors.dark.error : Colors.dark.textSecondary;

    return {
      totalCompleted, avgPerDay, completionRate,
      longestStreak: analytics.longestStreak,
      mostProductiveDay: analytics.mostProductiveDay,
      timeOfDay, peakHourLabel,
      focusLabel, totalFocusMins,
      trend, trendIcon, trendColor,
    };
  }, [todos, analytics]);

  return (
    <View style={styles.deepStatsGrid}>
      <View style={styles.deepStatCard}>
        <Text style={styles.deepStatValue}>{stats.totalCompleted}</Text>
        <Text style={styles.deepStatLabel}>all-time completed</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={styles.deepStatValue}>{stats.avgPerDay}</Text>
        <Text style={styles.deepStatLabel}>avg tasks/day</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={[styles.deepStatValue, { color: Colors.dark.success }]}>{stats.longestStreak}</Text>
        <Text style={styles.deepStatLabel}>best streak</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={styles.deepStatValue}>{stats.mostProductiveDay.slice(0, 3)}</Text>
        <Text style={styles.deepStatLabel}>best day</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={styles.deepStatValue}>{stats.peakHourLabel}</Text>
        <Text style={styles.deepStatLabel}>{stats.timeOfDay.toLowerCase()}</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={[styles.deepStatValue, { color: Colors.dark.timer }]}>{stats.focusLabel}</Text>
        <Text style={styles.deepStatLabel}>total focus</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={styles.deepStatValue}>{stats.completionRate}%</Text>
        <Text style={styles.deepStatLabel}>all-time rate</Text>
      </View>
      <View style={styles.deepStatCard}>
        <Text style={[styles.deepStatValue, { color: stats.trendColor }]}>{stats.trendIcon}</Text>
        <Text style={styles.deepStatLabel}>trend: {stats.trend}</Text>
      </View>
    </View>
  );
}

// --- 9. Share Card ---
function ShareSection({ analytics }: { analytics: AnalyticsData }) {
  const viewShotRef = useRef<ViewShot>(null);
  const todos = useTodoStore(s => s.todos);
  const weekStats = useMemo(() => getWeekStats(), [todos]);
  const streak = useMemo(() => calculateStreak(todos), [todos]);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          message: `This week: ${Math.round(weekStats.completionRate * 100)}% completion | ${streak} day streak | untodo`,
        });
      }
    } catch {}
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

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Share Progress</Text>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.shareCard}>
          <Text style={styles.shareCardDate}>{dateLabel}</Text>
          <Text style={styles.shareCardTitle}>Weekly Stats</Text>
          <View style={styles.shareStatsRow}>
            <View style={styles.shareStatItem}>
              <Text style={styles.shareStatValue}>{weekPct}%</Text>
              <Text style={styles.shareStatLabel}>completion</Text>
            </View>
            <View style={styles.shareDivider} />
            <View style={styles.shareStatItem}>
              <Text style={styles.shareStatValue}>{streak}</Text>
              <Text style={styles.shareStatLabel}>day streak</Text>
            </View>
            {weekPomoMins > 0 && (
              <>
                <View style={styles.shareDivider} />
                <View style={styles.shareStatItem}>
                  <Text style={[styles.shareStatValue, { color: Colors.dark.timer }]}>{weekPomoMins}m</Text>
                  <Text style={styles.shareStatLabel}>focus time</Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.shareWatermark}>untodo</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
        <Text style={styles.shareBtnText}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- Achievement Celebration Toast ---
function AchievementCelebration() {
  const newlyUnlocked = useAchievementStore(s => s.newlyUnlocked);
  const achievements = useAchievementStore(s => s.achievements);
  const dismissAll = useAchievementStore(s => s.dismissAllCelebrations);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;

  const toShow = achievements.filter(a => newlyUnlocked.includes(a.id));

  useEffect(() => {
    if (toShow.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      RNAnimated.parallel([
        RNAnimated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        RNAnimated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          dismissAll();
          scaleAnim.setValue(0.8);
        });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toShow.length]);

  if (toShow.length === 0) return null;
  const a = toShow[0];

  return (
    <RNAnimated.View style={[styles.celebrationToast, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.celebrationIcon}>{a.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.celebrationTitle}>Achievement Unlocked!</Text>
        <Text style={styles.celebrationName}>{a.title}</Text>
      </View>
    </RNAnimated.View>
  );
}

// --- Empty Hero ---
function ProgressEmptyHero() {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <RNAnimated.View style={[styles.emptyHero, { opacity: fadeAnim }]}>
      <Text style={styles.emptyHeroIcon}>{'\u25E7'}</Text>
      <Text style={styles.emptyHeroTitle}>Your progress story starts here</Text>
      <Text style={styles.emptyHeroSubtext}>
        Complete tasks on the Today tab and watch your progress unfold. Every task counts.
      </Text>
    </RNAnimated.View>
  );
}

// --- Main Screen ---
function ProgressScreenContent() {
  const [refreshing, setRefreshing] = useState(false);
  const todos = useTodoStore(s => s.todos);
  const hasAnyTasks = todos.length > 0;
  const analytics = useMemo(() => computeAnalytics(todos), [todos]);
  const checkAchievements = useAchievementStore(s => s.checkAchievements);
  const achievements = useAchievementStore(s => s.achievements);
  const unlockedCount = achievements.filter(a => a.unlockedAt).length;

  const { collapsed, toggle } = useCollapseState({
    weeklyReview: false,  // expanded by default
    achievements: true,   // collapsed by default
    deepStats: true,      // collapsed by default
  });

  useEffect(() => {
    if (hasAnyTasks) checkAchievements();
  }, [todos.length, todos.filter(t => t.completed).length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    checkAchievements();
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AchievementCelebration />
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
            {/* 1. Today's Progress Ring */}
            <TodayProgressRing />

            {/* 2. Daily Score + 3. Streak - side by side */}
            <View style={styles.gradeStreakRow}>
              <DailyScoreGrade />
              <StreakCounter />
            </View>

            {/* 4. Weekly Bar Chart */}
            <WeeklyBarChart />

            {/* 5. Contribution Graph */}
            <ContributionGraph heatmap={analytics.heatmap} />

            {/* 6. Weekly Review (collapsible) */}
            <View style={styles.section}>
              <CollapsibleHeader
                title="Weekly Review"
                collapsed={collapsed.weeklyReview}
                onToggle={() => toggle('weeklyReview')}
              />
              {!collapsed.weeklyReview && <WeeklyReviewComponent />}
            </View>

            {/* 7. Achievements (collapsible) */}
            <View style={styles.section}>
              <CollapsibleHeader
                title="Achievements"
                collapsed={collapsed.achievements}
                onToggle={() => toggle('achievements')}
                count={`${unlockedCount}/${achievements.length}`}
              />
              {!collapsed.achievements && <AchievementsGrid />}
            </View>

            {/* 8. Deep Stats (collapsible) */}
            <View style={styles.section}>
              <CollapsibleHeader
                title="Statistics"
                collapsed={collapsed.deepStats}
                onToggle={() => toggle('deepStats')}
              />
              {!collapsed.deepStats && <DeepStatistics analytics={analytics} todos={todos} />}
            </View>

            {/* 9. Share Card */}
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

  // --- 1. Ring ---
  ringSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  ringContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPct: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 42,
    lineHeight: 46,
  },
  ringLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  ringFocus: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: Spacing.md,
  },

  // --- 2+3. Grade + Streak Row ---
  gradeStreakRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  gradeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.md,
  },
  gradeValue: {
    fontFamily: Fonts.accent,
    fontSize: 36,
    lineHeight: 40,
  },
  gradeLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  gradeSub: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakNum: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 32,
    lineHeight: 36,
  },
  streakLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },

  // --- Sections ---
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // --- Collapsible ---
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  collapsibleCount: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accent,
    fontSize: 14,
  },
  collapsibleChevron: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 18,
    lineHeight: 20,
  },

  // --- 4. Bar Chart ---
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  weekPct: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 28,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 44,
    marginBottom: Spacing.md,
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
    backgroundColor: Colors.dark.surface,
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  weekStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekStatText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  weekStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textTertiary,
  },

  // --- 5. Contribution Graph ---
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

  // --- 7. Achievements Grid ---
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  achievementBadge: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 4) / 5,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.sm,
    alignItems: 'center',
    minHeight: 80,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 22,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  achievementTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
  },
  achievementDesc: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 7,
    textAlign: 'center',
    lineHeight: 10,
  },

  // --- 8. Deep Statistics ---
  deepStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  deepStatCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 3) / 4,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  deepStatValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 20,
    lineHeight: 24,
  },
  deepStatLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },

  // --- 9. Share ---
  shareCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  shareCardDate: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginBottom: Spacing.xs,
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
  shareDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.dark.border,
  },
  shareWatermark: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    opacity: 0.4,
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

  // --- Celebration Toast ---
  celebrationToast: {
    position: 'absolute',
    top: 60,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.success,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    zIndex: 100,
    shadowColor: Colors.dark.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  celebrationIcon: {
    fontSize: 32,
    color: Colors.dark.success,
  },
  celebrationTitle: {
    color: Colors.dark.success,
    fontFamily: Fonts.headingMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  celebrationName: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 20,
    marginTop: 2,
  },

  // --- Empty State ---
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
  },
});
