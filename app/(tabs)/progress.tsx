import { useMemo, useState, useCallback, useRef, memo, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Share, Dimensions, Animated as RNAnimated, LayoutAnimation, Platform, UIManager, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing, type ColorPalette } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
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

// --- Dynamic styles factory ---
function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.lg,
    },
    heading: {
      color: colors.text,
      fontFamily: Fonts.accentItalic,
      fontSize: 36,
      paddingTop: Spacing.lg,
      marginBottom: Spacing.xl,
      letterSpacing: -0.5,
    },

    // --- 1. Hero Card ---
    heroCard: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    ringContainer: {
      position: 'relative',
      width: 120,
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ringCenter: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
    },
    ringGrade: {
      fontFamily: Fonts.accent,
      fontSize: 36,
      lineHeight: 40,
    },
    ringTaskInfo: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 13,
      marginTop: Spacing.sm,
    },
    ringStreak: {
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 14,
      marginTop: Spacing.xs,
    },
    ringFocus: {
      color: colors.timer,
      fontFamily: Fonts.body,
      fontSize: 13,
      marginTop: Spacing.xs,
    },

    // --- Sections ---
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      color: colors.textSecondary,
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
      color: colors.textTertiary,
      fontFamily: Fonts.accent,
      fontSize: 14,
    },
    collapsibleChevron: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 18,
      lineHeight: 20,
    },

    // --- 2. Bar Chart ---
    weekHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: Spacing.md,
    },
    weekPct: {
      color: colors.text,
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
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      height: 14,
    },
    barTrack: {
      width: '100%',
      maxWidth: 28,
      height: BAR_MAX_HEIGHT,
      justifyContent: 'flex-end',
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    barFill: {
      width: '100%',
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    },
    barLabel: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    weekSummary: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 13,
      textAlign: 'center',
    },

    // --- 3. Contribution Graph ---
    heatmapHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: Spacing.md,
    },
    heatmapSummary: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    monthLabelsRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    monthLabel: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
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
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
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
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    heatmapLegendDot: {
      width: 12,
      height: 12,
      borderRadius: 3,
    },

    // --- 5. Achievements Grid ---
    achievementsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    achievementBadge: {
      width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 2) / 3,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      alignItems: 'center',
      minHeight: 100,
    },
    achievementLocked: {
      opacity: 0.3,
    },
    achievementIcon: {
      fontSize: 32,
      color: colors.text,
      marginBottom: 6,
    },
    achievementTitle: {
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 4,
    },
    achievementDesc: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 15,
    },

    // --- 6. Deep Statistics ---
    deepStatsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    deepStatCard: {
      width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      alignItems: 'center',
    },
    deepStatValue: {
      color: colors.text,
      fontFamily: Fonts.accent,
      fontSize: 28,
      lineHeight: 32,
    },
    deepStatLabel: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 4,
    },

    // --- 7. Share ---
    shareCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.lg,
      alignItems: 'center',
    },
    shareCardDate: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      marginBottom: Spacing.xs,
    },
    shareCardTitle: {
      color: colors.text,
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
      color: colors.text,
      fontFamily: Fonts.accent,
      fontSize: 28,
    },
    shareStatLabel: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      marginTop: 2,
    },
    shareDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border,
    },
    shareWatermark: {
      color: colors.textTertiary,
      fontFamily: Fonts.accentItalic,
      fontSize: 11,
      opacity: 0.4,
    },
    shareBtn: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    shareBtnText: {
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 15,
    },

    // --- Celebration Toast ---
    celebrationToast: {
      position: 'absolute',
      top: 60,
      left: Spacing.lg,
      right: Spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.success,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      zIndex: 100,
    },
    celebrationIcon: {
      fontSize: 32,
      color: colors.success,
    },
    celebrationTitle: {
      color: colors.success,
      fontFamily: Fonts.headingMedium,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    celebrationName: {
      color: colors.text,
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
      color: colors.textTertiary,
      marginBottom: Spacing.lg,
      opacity: 0.4,
    },
    emptyHeroTitle: {
      color: colors.textSecondary,
      fontFamily: Fonts.accentItalic,
      fontSize: 22,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    emptyHeroSubtext: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
    },
    emptySection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: {
      color: colors.textSecondary,
      fontFamily: Fonts.headingMedium,
      fontSize: 16,
    },
  });
}

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

// --- Letter Grade ---
function getLetterGrade(pct: number, colors: ColorPalette): { grade: string; color: string } {
  if (pct >= 95) return { grade: 'A+', color: colors.success };
  if (pct >= 90) return { grade: 'A', color: colors.success };
  if (pct >= 85) return { grade: 'A-', color: colors.success };
  if (pct >= 80) return { grade: 'B+', color: colors.success + 'CC' };
  if (pct >= 75) return { grade: 'B', color: colors.success + 'AA' };
  if (pct >= 70) return { grade: 'B-', color: colors.success + '88' };
  if (pct >= 65) return { grade: 'C+', color: colors.timer };
  if (pct >= 60) return { grade: 'C', color: colors.timer };
  if (pct >= 55) return { grade: 'C-', color: colors.timer };
  if (pct >= 50) return { grade: 'D+', color: colors.error + '99' };
  if (pct >= 45) return { grade: 'D', color: colors.error };
  if (pct >= 40) return { grade: 'D-', color: colors.error };
  return { grade: 'F', color: colors.error };
}

// --- Heatmap color scales ---
const HEATMAP_DARK = ['#1A1A1A', '#333333', '#555555', '#888888', '#F5F5F5'];
const HEATMAP_LIGHT = ['#EBEBEB', '#CCCCCC', '#999999', '#666666', '#333333'];

function getHeatmapColor(rate: number, count: number, date: string, isDark: boolean): string {
  if (!date) return 'transparent';
  const scale = isDark ? HEATMAP_DARK : HEATMAP_LIGHT;
  if (count === 0) return scale[0];
  if (rate >= 0.9) return scale[4];
  if (rate >= 0.7) return scale[3];
  if (rate >= 0.5) return scale[2];
  if (rate >= 0.2) return scale[1];
  return scale[0];
}

// --- Animated Ring Component ---
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

// --- Collapsible Section Header ---
function CollapsibleHeader({ title, collapsed, onToggle, count, styles }: {
  title: string; collapsed: boolean; onToggle: () => void; count?: string;
  styles: ReturnType<typeof createStyles>;
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

// --- 1. Today's Snapshot (Hero) ---
function TodaySnapshot() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const todos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();
  const ringAnim = useRef(new RNAnimated.Value(0)).current;

  const { completed, total, focusMins, progress, pct, grade, gradeColor, streak } = useMemo(() => {
    const todayTodos = todos.filter(t => t.logicalDate === logicalDate);
    const completed = todayTodos.filter(t => t.completed).length;
    const total = todayTodos.length;
    const focusMins = todayTodos.reduce((s, t) => {
      let mins = t.pomodoroMinutesLogged || 0;
      if (t.timeTracking?.totalSeconds) mins += Math.floor(t.timeTracking.totalSeconds / 60);
      return s + mins;
    }, 0);
    const progress = total > 0 ? completed / total : 0;
    const pct = Math.round(progress * 100);
    const { grade, color: gradeColor } = total > 0 ? getLetterGrade(pct, colors) : { grade: '-', color: colors.textTertiary };
    const streak = calculateStreak(todos);
    return { completed, total, focusMins, progress, pct, grade, gradeColor, streak };
  }, [todos, logicalDate, colors]);

  useEffect(() => {
    ringAnim.setValue(0);
    RNAnimated.timing(ringAnim, {
      toValue: progress,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedStrokeDashoffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.heroCard, shadows.lg]}>
      <View style={styles.ringContainer}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={colors.border} strokeWidth={strokeWidth} fill="transparent"
          />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={progress === 1 ? colors.success : colors.accent}
            strokeWidth={strokeWidth} fill="transparent"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={animatedStrokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringGrade, { color: gradeColor }]}>{grade}</Text>
        </View>
      </View>
      <Text style={styles.ringTaskInfo}>{completed}/{total} tasks · {pct}%</Text>
      {streak > 0 && (
        <Text style={styles.ringStreak}>{'\uD83D\uDD25'} {streak} day streak</Text>
      )}
      {focusMins > 0 && (
        <Text style={styles.ringFocus}>{focusMins}m focused today</Text>
      )}
    </View>
  );
}

// --- 2. Weekly Bar Chart ---
function WeeklyBarChart() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const todos = useTodoStore(s => s.todos);
  const stats = useMemo(() => getWeekStats(), [todos]);
  const hasData = stats.totalTasks > 0;
  const barAnims = useRef(stats.weekDays.map(() => new RNAnimated.Value(0))).current;

  useEffect(() => {
    if (hasData) {
      barAnims.forEach((anim, i) => {
        anim.setValue(0);
        RNAnimated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: i * 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    }
  }, [hasData]);

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
          const targetHeight = day.totalTasks > 0 ? Math.max(4, rate * BAR_MAX_HEIGHT) : 4;
          const isToday = day.date === new Date().toISOString().split('T')[0];
          const pctLabel = day.totalTasks > 0 ? `${Math.round(rate * 100)}%` : '';

          const animatedHeight = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, targetHeight],
          });

          return (
            <View key={day.date} style={styles.barCol}>
              {pctLabel ? (
                <Text style={styles.barPctLabel}>{pctLabel}</Text>
              ) : (
                <Text style={styles.barPctLabel}> </Text>
              )}
              <View style={[styles.barTrack, isToday && { backgroundColor: colors.surface }]}>
                <RNAnimated.View
                  style={[
                    styles.barFill,
                    {
                      height: animatedHeight,
                      backgroundColor: isToday ? colors.accent : colors.textSecondary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, isToday && { color: colors.accent }]}>
                {DAY_LABELS[i]}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.weekSummary}>{stats.totalCompleted} of {stats.totalTasks} completed</Text>
    </View>
  );
}

// --- 3. Contribution Graph ---
function ContributionGraph({ heatmap }: { heatmap: AnalyticsData['heatmap'] }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heatmapScale = isDark ? HEATMAP_DARK : HEATMAP_LIGHT;

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

  if (graphData.weeks.length === 0) return null;

  const numWeeks = graphData.weeks.length;
  const cellSize = 16;
  const gap = 3;
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
                        backgroundColor: getHeatmapColor(day.rate, day.count, day.date, isDark),
                        borderRadius: 3,
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
        {heatmapScale.map((c, i) => (
          <View key={i} style={[styles.heatmapLegendDot, { backgroundColor: c }]} />
        ))}
        <Text style={styles.heatmapLegendText}>More</Text>
      </View>
    </View>
  );
}

// --- 4. Weekly Review (Collapsible) ---
// Uses the existing WeeklyReviewComponent

// --- 5. Achievements Grid (3-column) ---
function AchievementsGrid() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const achievements = useAchievementStore(s => s.achievements);

  return (
    <View style={styles.achievementsGrid}>
      {achievements.map(a => (
        <View
          key={a.id}
          style={[styles.achievementBadge, !a.unlockedAt && styles.achievementLocked]}
        >
          <Text style={[styles.achievementIcon, !a.unlockedAt && { opacity: 0.2 }]}>{a.icon}</Text>
          <Text style={[styles.achievementTitle, !a.unlockedAt && { color: colors.textTertiary }]} numberOfLines={1}>
            {a.title}
          </Text>
          <Text style={styles.achievementDesc} numberOfLines={2}>{a.description}</Text>
        </View>
      ))}
    </View>
  );
}

// --- 6. Deep Statistics (2-column) ---
function DeepStatistics({ analytics, todos }: { analytics: AnalyticsData; todos: any[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
    const trendColor = trend === 'improving' ? colors.success : trend === 'declining' ? colors.error : colors.textSecondary;

    return {
      totalCompleted, avgPerDay, completionRate,
      longestStreak: analytics.longestStreak,
      mostProductiveDay: analytics.mostProductiveDay,
      timeOfDay, peakHourLabel,
      focusLabel, totalFocusMins,
      trend, trendIcon, trendColor,
    };
  }, [todos, analytics, colors]);

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
        <Text style={[styles.deepStatValue, { color: colors.success }]}>{stats.longestStreak}</Text>
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
        <Text style={[styles.deepStatValue, { color: colors.timer }]}>{stats.focusLabel}</Text>
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

// --- 7. Share Card ---
function ShareSection({ analytics }: { analytics: AnalyticsData }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                  <Text style={[styles.shareStatValue, { color: colors.timer }]}>{weekPomoMins}m</Text>
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
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    <RNAnimated.View style={[styles.celebrationToast, shadows.lg, { shadowColor: colors.success, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const todos = useTodoStore(s => s.todos);

  const entranceFade = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(entranceFade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);
  const hasAnyTasks = todos.length > 0;
  const analytics = useMemo(() => computeAnalytics(todos), [todos]);
  const checkAchievements = useAchievementStore(s => s.checkAchievements);
  const achievements = useAchievementStore(s => s.achievements);
  const unlockedCount = achievements.filter(a => a.unlockedAt).length;
  const completedCount = useMemo(() => todos.filter(t => t.completed).length, [todos]);

  const { collapsed, toggle } = useCollapseState({
    weeklyReview: false,
    achievements: true,
    deepStats: true,
  });

  useEffect(() => {
    if (hasAnyTasks) checkAchievements();
  }, [todos.length, completedCount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    checkAchievements();
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AchievementCelebration />
      <RNAnimated.ScrollView
        showsVerticalScrollIndicator={false}
        style={{ opacity: entranceFade }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
            title="Syncing..."
            titleColor={colors.textTertiary}
          />
        }
      >
        <Text style={styles.heading} accessibilityRole="header">Progress</Text>
        {!hasAnyTasks ? (
          <ProgressEmptyHero />
        ) : (
          <>
            <TodaySnapshot />
            <WeeklyBarChart />
            <ContributionGraph heatmap={analytics.heatmap} />

            <View style={styles.section}>
              <CollapsibleHeader
                title="Weekly Review"
                collapsed={collapsed.weeklyReview}
                onToggle={() => toggle('weeklyReview')}
                styles={styles}
              />
              {!collapsed.weeklyReview && <WeeklyReviewComponent />}
            </View>

            <View style={styles.section}>
              <CollapsibleHeader
                title="Achievements"
                collapsed={collapsed.achievements}
                onToggle={() => toggle('achievements')}
                count={`${unlockedCount}/${achievements.length}`}
                styles={styles}
              />
              {!collapsed.achievements && <AchievementsGrid />}
            </View>

            <View style={styles.section}>
              <CollapsibleHeader
                title="Statistics"
                collapsed={collapsed.deepStats}
                onToggle={() => toggle('deepStats')}
                styles={styles}
              />
              {!collapsed.deepStats && <DeepStatistics analytics={analytics} todos={todos} />}
            </View>

            <ShareSection analytics={analytics} />
          </>
        )}
        <View style={{ height: 120 }} />
      </RNAnimated.ScrollView>
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
