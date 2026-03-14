import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Modal, TouchableOpacity, ScrollView,
  Animated as RNAnimated, RefreshControl, TextInput, Dimensions, PanResponder,
  LayoutAnimation, UIManager, Platform, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, formatDisplayDate, shiftDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import QuickActions from '../../engines/todo/components/QuickActions';
import TaskDetail from '../../engines/todo/components/TaskDetail';
import FocusMode from '../../engines/todo/components/FocusMode';
import ErrorBoundary from '../../components/ErrorBoundary';
import UndoToast, { showUndoToast } from '../../components/UndoToast';
import { Todo, Category, CATEGORIES, Priority, Recurrence } from '../../engines/todo/types';
import { onSyncStateChange } from '../../lib/firebase-sync';
import { useKeyboardShortcuts } from '../../lib/useKeyboardShortcuts';
import { generateDailyInsight } from '../../lib/insights';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 72; // Approximate fixed height for getItemLayout

// --- Confetti Celebration Component ---
function ConfettiCelebration({ visible, onDismiss, streak }: { visible: boolean; onDismiss: () => void; streak: number }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const textScale = useRef(new RNAnimated.Value(0.5)).current;
  const textOpacity = useRef(new RNAnimated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      x: new RNAnimated.Value(SCREEN_WIDTH / 2),
      y: new RNAnimated.Value(500),
      opacity: new RNAnimated.Value(1),
      rotate: new RNAnimated.Value(0),
      color: ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#F5F5F5', '#34D399', '#FB923C'][i % 8],
      targetX: Math.random() * SCREEN_WIDTH,
      targetY: Math.random() * -300 + 50,
      targetRotate: (Math.random() - 0.5) * 720,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    // Fade in
    RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Text entrance with spring
    textScale.setValue(0.5);
    textOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.delay(400),
      RNAnimated.parallel([
        RNAnimated.spring(textScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        RNAnimated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    // Animate particles in two waves
    particles.forEach((p, i) => {
      const delay = i < 20 ? 0 : 300;
      p.x.setValue(SCREEN_WIDTH / 2);
      p.y.setValue(500);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
      RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.parallel([
          RNAnimated.timing(p.x, { toValue: p.targetX, duration: 1400, useNativeDriver: true }),
          RNAnimated.sequence([
            RNAnimated.timing(p.y, { toValue: p.targetY, duration: 700, useNativeDriver: true }),
            RNAnimated.timing(p.y, { toValue: 900, duration: 700, useNativeDriver: true }),
          ]),
          RNAnimated.timing(p.rotate, { toValue: p.targetRotate, duration: 1400, useNativeDriver: true }),
          RNAnimated.timing(p.opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      ]).start();
    });
    // Celebration haptic pattern
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    // Auto-dismiss after 3.5 seconds
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <RNAnimated.View style={[styles.confettiOverlay, { opacity }]} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
        return (
          <RNAnimated.View
            key={i}
            style={[
              styles.confettiParticle,
              {
                backgroundColor: p.color,
                width: i % 4 === 0 ? 10 : i % 3 === 0 ? 8 : 6,
                height: i % 4 === 0 ? 10 : i % 3 === 0 ? 8 : 6,
                borderRadius: i % 2 === 0 ? 5 : 1,
                transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: spin }],
                opacity: p.opacity,
              },
            ]}
          />
        );
      })}
      <RNAnimated.View style={[styles.celebrationTextContainer, { opacity: textOpacity, transform: [{ scale: textScale }] }]}>
        <Text style={styles.celebrationEmoji}>🔥</Text>
        <Text style={styles.celebrationText}>Everything done!</Text>
        <Text style={styles.celebrationSubtext}>You're a machine.</Text>
        {streak > 0 && (
          <Text style={styles.celebrationStreak}>{streak} day streak</Text>
        )}
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

// --- Search Results Component ---
function SearchResults({
  query,
  results,
  onSelect,
  onClose,
}: {
  query: string;
  results: Todo[];
  onSelect: (todo: Todo) => void;
  onClose: () => void;
}) {
  if (!query.trim() || results.length === 0) {
    if (query.trim()) {
      return (
        <View style={styles.searchResults}>
          <Text style={styles.searchNoResults}>No tasks found</Text>
        </View>
      );
    }
    return null;
  }

  // Group results by date
  const grouped = results.slice(0, 20).reduce<Record<string, Todo[]>>((acc, todo) => {
    const date = todo.logicalDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(todo);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <View style={styles.searchResults}>
      <ScrollView style={styles.searchScroll} keyboardShouldPersistTaps="handled">
        {sortedDates.map(date => (
          <View key={date}>
            <View style={styles.searchDateHeader}>
              <Text style={styles.searchDateHeaderText}>{formatDisplayDate(date)}</Text>
            </View>
            {grouped[date].map(todo => (
              <TouchableOpacity
                key={todo.id}
                style={styles.searchResultItem}
                onPress={() => onSelect(todo)}
              >
                <View style={styles.searchResultContent}>
                  <Text
                    style={[styles.searchResultTitle, todo.completed && styles.searchResultTitleDone]}
                    numberOfLines={1}
                  >
                    {todo.title}
                  </Text>
                </View>
                {todo.completed && <Text style={styles.searchResultCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// --- Skeleton Loading ---
function SkeletonBar({ width, delay = 0 }: { width: number | string; delay?: number }) {
  const shimmer = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmer, { toValue: 1, duration: 1000, delay, useNativeDriver: true }),
        RNAnimated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.12],
  });

  return (
    <RNAnimated.View
      style={{
        height: 14,
        width: width as any,
        backgroundColor: Colors.dark.text,
        borderRadius: 7,
        opacity,
        marginBottom: 8,
      }}
    />
  );
}

function SkeletonLoader() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          gap: Spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: Colors.dark.border,
        }}>
          <RNAnimated.View style={{
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: Colors.dark.text,
            opacity: 0.06,
          }} />
          <View style={{ flex: 1 }}>
            <SkeletonBar width={`${70 - i * 10}%`} delay={i * 100} />
            <SkeletonBar width={`${40 - i * 5}%`} delay={i * 100 + 50} />
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Empty States ---
function EmptyState({ isToday, allCompleted }: { isToday: boolean; allCompleted: boolean }) {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  if (allCompleted) {
    const tod = getTimeOfDay();
    const doneMsg = tod === 'night'
      ? 'All done. Get some rest.'
      : tod === 'evening'
        ? 'Everything done. Enjoy your evening.'
        : 'Everything done! You\'re a machine.';
    const doneSub = tod === 'night'
      ? 'Tomorrow will thank you.'
      : 'Go live your day. You earned it.';
    return (
      <RNAnimated.View style={[styles.empty, { opacity: fadeAnim }]}>
        <Text style={styles.emptyIcon}>🔥</Text>
        <Text style={styles.emptyQuote}>{doneMsg}</Text>
        <Text style={styles.emptySubtext}>{doneSub}</Text>
      </RNAnimated.View>
    );
  }

  if (isToday) {
    const tod = getTimeOfDay();
    const emptyMessages: Record<TimeOfDay, { prompt: string; sub: string }> = {
      morning: { prompt: 'A blank slate.', sub: 'What matters most today?' },
      afternoon: { prompt: "What's the plan?", sub: "It's not too late to set your intentions." },
      evening: { prompt: 'Quiet evening ahead.', sub: 'Plan tomorrow, or just breathe.' },
      night: { prompt: 'Nothing on the plate.', sub: 'Rest. Tomorrow is a new day.' },
    };
    const { prompt, sub } = emptyMessages[tod];
    return (
      <RNAnimated.View style={[styles.empty, { opacity: fadeAnim }]}>
        <Text style={styles.emptyIcon}>○</Text>
        <Text style={styles.emptyQuote}>{prompt}</Text>
        <Text style={styles.emptySubtext}>{sub}</Text>
        <DailyQuote />
      </RNAnimated.View>
    );
  }

  return (
    <RNAnimated.View style={[styles.empty, { opacity: fadeAnim }]}>
      <Text style={styles.emptyQuote}>Nothing here yet</Text>
      <Text style={styles.emptySubtext}>Add a task or navigate to another day</Text>
    </RNAnimated.View>
  );
}

// --- Streak Banner ---
function useTaskStreak(allTodos: Todo[]): { streak: number; atRisk: boolean } {
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if any task completed today
    const todayStr = today.toISOString().split('T')[0];
    const todayCompleted = allTodos.some(t => t.logicalDate === todayStr && t.completed);
    const todayHasTasks = allTodos.some(t => t.logicalDate === todayStr);

    // Count consecutive days with at least 1 completion, going backwards
    let streak = 0;
    // Start from today if completed, otherwise from yesterday
    const startDay = new Date(today);
    if (todayCompleted) {
      streak = 1;
      startDay.setDate(startDay.getDate() - 1);
    } else {
      startDay.setDate(startDay.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
      const dateStr = startDay.toISOString().split('T')[0];
      const dayTodos = allTodos.filter(t => t.logicalDate === dateStr);
      const hasCompleted = dayTodos.some(t => t.completed);
      if (hasCompleted) {
        streak++;
        startDay.setDate(startDay.getDate() - 1);
      } else {
        break;
      }
    }

    // At risk: it's evening (after 6pm), there are tasks today, but none completed
    const hour = new Date().getHours();
    const atRisk = streak > 0 && !todayCompleted && todayHasTasks && hour >= 18;

    return { streak, atRisk };
  }, [allTodos]);
}

function StreakBanner({ streak, atRisk }: { streak: number; atRisk: boolean }) {
  if (streak <= 0 && !atRisk) return null;

  if (atRisk) {
    return (
      <View style={[streakStyles.banner, streakStyles.bannerWarning]}>
        <Text style={streakStyles.streakEmoji}>⚠️</Text>
        <Text style={streakStyles.warningText}>Your streak is about to break! Complete a task.</Text>
      </View>
    );
  }

  return (
    <View style={streakStyles.banner}>
      <Text style={streakStyles.streakEmoji}>🔥</Text>
      <Text style={streakStyles.streakText}>
        {streak} day streak
      </Text>
    </View>
  );
}

const streakStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.timer + '15',
    borderRadius: 12,
    marginTop: Spacing.xs,
  },
  bannerWarning: {
    backgroundColor: Colors.dark.error + '15',
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  warningText: {
    color: Colors.dark.error,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});

// --- Daily Score Component ---
function getDailyScore(completed: number, total: number, streak: number): { grade: string; color: string; pct: number } {
  if (total === 0) return { grade: '--', color: Colors.dark.textTertiary, pct: 0 };
  const completionPct = completed / total;
  // Weighted: 70% completion, 15% streak bonus, 15% total tasks bonus
  const streakBonus = Math.min(streak / 30, 1); // max at 30-day streak
  const taskBonus = Math.min(total / 8, 1); // max at 8 tasks
  const score = (completionPct * 0.7 + streakBonus * 0.15 + taskBonus * 0.15) * 100;

  if (score >= 95) return { grade: 'A+', color: Colors.dark.success, pct: score };
  if (score >= 85) return { grade: 'A', color: Colors.dark.success, pct: score };
  if (score >= 75) return { grade: 'B+', color: '#4ADE80', pct: score };
  if (score >= 65) return { grade: 'B', color: Colors.dark.timer, pct: score };
  if (score >= 50) return { grade: 'C', color: Colors.dark.timer, pct: score };
  return { grade: 'D', color: Colors.dark.error, pct: score };
}

function DailyScore({ completed, total, streak }: { completed: number; total: number; streak: number }) {
  const { grade, color, pct } = getDailyScore(completed, total, streak);
  const scaleAnim = useRef(new RNAnimated.Value(0.8)).current;

  useEffect(() => {
    RNAnimated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [grade]);

  if (total === 0) return null;

  return (
    <View style={scoreStyles.container}>
      <RNAnimated.View style={[scoreStyles.gradeCircle, { borderColor: color, transform: [{ scale: scaleAnim }] }]}>
        <Text style={[scoreStyles.gradeText, { color }]}>{grade}</Text>
      </RNAnimated.View>
      <View style={scoreStyles.details}>
        <Text style={scoreStyles.label}>Today's score</Text>
        <View style={scoreStyles.barTrack}>
          <View style={[scoreStyles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    marginTop: Spacing.sm,
  },
  gradeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  details: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});

// --- Streak Milestone Celebrations ---
const STREAK_MILESTONES: Record<number, { emoji: string; title: string; message: string }> = {
  3: { emoji: '🔥', title: '3-Day Streak!', message: 'Consistency is building. Keep it up!' },
  7: { emoji: '⚡', title: 'One Week Strong!', message: 'A full week of showing up. You\'re unstoppable.' },
  14: { emoji: '💎', title: '2-Week Machine!', message: 'Two weeks straight. Discipline is becoming habit.' },
  30: { emoji: '🏆', title: '30-Day Legend!', message: 'A full month. You\'re in the top 1%.' },
  60: { emoji: '🦾', title: '60-Day Titan!', message: 'Two months of relentless execution.' },
  100: { emoji: '👑', title: '100-Day King!', message: 'One hundred days. Legendary status unlocked.' },
};

function StreakMilestone({ streak, visible, onDismiss }: { streak: number; visible: boolean; onDismiss: () => void }) {
  const milestone = STREAK_MILESTONES[streak];
  const scale = useRef(new RNAnimated.Value(0)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!visible || !milestone) return;
    scale.setValue(0.5);
    opacity.setValue(0);
    RNAnimated.parallel([
      RNAnimated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);

    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible || !milestone) return null;

  return (
    <RNAnimated.View style={[milestoneStyles.overlay, { opacity }]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={1} onPress={onDismiss} style={milestoneStyles.touchArea}>
        <RNAnimated.View style={[milestoneStyles.card, { transform: [{ scale }] }]}>
          <Text style={milestoneStyles.emoji}>{milestone.emoji}</Text>
          <Text style={milestoneStyles.title}>{milestone.title}</Text>
          <Text style={milestoneStyles.message}>{milestone.message}</Text>
          <Text style={milestoneStyles.streakNum}>{streak} days</Text>
        </RNAnimated.View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

const milestoneStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  emoji: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  streakNum: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
});

// --- Daily Motivational Quotes ---
const DAILY_QUOTES = [
  'Memento mori.',
  'The obstacle is the way.',
  'Discipline equals freedom.',
  'Do the work.',
  'Amor fati.',
  'Less but better.',
  'Ship it.',
  'Be water.',
  'Start before you\'re ready.',
  'No shortcuts.',
  'Trust the process.',
  'Stay hungry.',
  'Own your day.',
  'Execute.',
  'One thing at a time.',
  'Progress, not perfection.',
  'Show up daily.',
  'Outwork everyone.',
  'Build in silence.',
  'Make it happen.',
  'We suffer more in imagination than reality.',
  'The best time to plant a tree was 20 years ago.',
  'Action cures fear.',
  'What stands in the way becomes the way.',
  'You could leave life right now. Let that determine what you do.',
  'Waste no more time arguing about what a good person should be. Be one.',
  'It is not that we have a short time to live, but that we waste much of it.',
  'He who has a why can bear almost any how.',
  'The impediment to action advances action.',
  'Begin at once to live.',
];

function getDailyQuoteIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000) % DAILY_QUOTES.length;
}

function DailyQuote() {
  const [quoteIndex, setQuoteIndex] = useState(getDailyQuoteIndex);
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;

  const handleTap = useCallback(() => {
    RNAnimated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setQuoteIndex(prev => (prev + 1) % DAILY_QUOTES.length);
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, []);

  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={0.6} style={quoteStyles.container}>
      <RNAnimated.Text style={[quoteStyles.text, { opacity: fadeAnim }]}>
        "{DAILY_QUOTES[quoteIndex]}"
      </RNAnimated.Text>
    </TouchableOpacity>
  );
}

const quoteStyles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  text: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.6,
  },
});

// --- Gesture Tutorial Overlay ---
const GESTURE_TUTORIAL_KEY = 'untodo-gesture-tutorial-shown';

function GestureTutorial({ onDismiss }: { onDismiss: () => void }) {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const dismiss = useCallback(() => {
    RNAnimated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  }, [onDismiss]);

  return (
    <RNAnimated.View style={[tutorialStyles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={tutorialStyles.touchArea} activeOpacity={1} onPress={dismiss}>
        <View style={tutorialStyles.card}>
          <Text style={tutorialStyles.title}>Quick gestures</Text>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Swipe right</Text>
            <Text style={tutorialStyles.desc}>Complete task</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Swipe left</Text>
            <Text style={tutorialStyles.desc}>Delete task</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Long press</Text>
            <Text style={tutorialStyles.desc}>Quick actions</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Tap</Text>
            <Text style={tutorialStyles.desc}>Task details</Text>
          </View>
          <Text style={tutorialStyles.dismiss}>Tap anywhere to dismiss</Text>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

const tutorialStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  gesture: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  desc: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  dismiss: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});

// --- Calendar Picker Component ---
function CalendarPicker({
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

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function getGreeting(): string {
  const tod = getTimeOfDay();
  switch (tod) {
    case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening': return 'Good evening';
    case 'night': return 'Still up?';
  }
}

function getGreetingSub(completed: number, total: number): string | null {
  const tod = getTimeOfDay();
  if (total === 0) {
    switch (tod) {
      case 'morning': return 'Fresh start. What matters today?';
      case 'afternoon': return 'Still time to set intentions.';
      case 'evening': return 'Plan tomorrow before you rest.';
      case 'night': return 'Rest well. Tomorrow is yours.';
    }
  }
  const remaining = total - completed;
  if (remaining === 0) return null; // all done - handled elsewhere
  switch (tod) {
    case 'morning': return `${total} task${total !== 1 ? 's' : ''} ahead. Let's go.`;
    case 'afternoon': return remaining <= 3 ? `Just ${remaining} left. Strong finish.` : `${completed}/${total} done. Keep pushing.`;
    case 'evening': return remaining <= 2 ? `Almost there — ${remaining} to go.` : `${remaining} remaining. Focus up.`;
    case 'night': return remaining <= 2 ? `Finish ${remaining} or let it rest.` : 'Tomorrow is another day.';
  }
}

// --- Task Insight Banner ---
function TaskInsight({ todos }: { todos: Todo[] }) {
  const insight = useMemo(() => generateDailyInsight(todos), [todos]);
  if (!insight) return null;

  return (
    <View style={insightStyles.container}>
      <Text style={insightStyles.icon}>◆</Text>
      <Text style={insightStyles.text}>{insight}</Text>
    </View>
  );
}

const insightStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  icon: {
    color: Colors.dark.textTertiary,
    fontSize: 8,
    opacity: 0.5,
  },
  text: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    opacity: 0.8,
  },
});

// --- Share Your Day Card ---
function ShareDayCard({ completed, total, streak }: { completed: number; total: number; streak: number }) {
  const viewShotRef = useRef<ViewShot>(null);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const { grade, color } = getDailyScore(completed, total, streak);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          message: `${dateStr}: ${completed}/${total} tasks done (${pct}%) | ${streak} day streak | untodo`,
        });
      }
    } catch {
      // Share cancelled
    }
  };

  if (total === 0) return null;

  return (
    <View style={shareCardStyles.wrapper}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={shareCardStyles.card}>
          <Text style={shareCardStyles.date}>{dateStr}</Text>
          <View style={shareCardStyles.statsRow}>
            <View style={shareCardStyles.statItem}>
              <Text style={[shareCardStyles.statValue, { color }]}>{grade}</Text>
              <Text style={shareCardStyles.statLabel}>score</Text>
            </View>
            <View style={shareCardStyles.divider} />
            <View style={shareCardStyles.statItem}>
              <Text style={shareCardStyles.statValue}>{completed}/{total}</Text>
              <Text style={shareCardStyles.statLabel}>tasks</Text>
            </View>
            <View style={shareCardStyles.divider} />
            <View style={shareCardStyles.statItem}>
              <Text style={shareCardStyles.statValue}>{pct}%</Text>
              <Text style={shareCardStyles.statLabel}>done</Text>
            </View>
            {streak > 0 && (
              <>
                <View style={shareCardStyles.divider} />
                <View style={shareCardStyles.statItem}>
                  <Text style={[shareCardStyles.statValue, { color: Colors.dark.timer }]}>{streak}</Text>
                  <Text style={shareCardStyles.statLabel}>streak</Text>
                </View>
              </>
            )}
          </View>
          <Text style={shareCardStyles.watermark}>untodo</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={shareCardStyles.btn} onPress={handleShare} activeOpacity={0.7}>
        <Text style={shareCardStyles.btnText}>Share your day</Text>
      </TouchableOpacity>
    </View>
  );
}

const shareCardStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  date: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 24,
    lineHeight: 28,
  },
  statLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.dark.border,
  },
  watermark: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    opacity: 0.4,
    marginTop: Spacing.md,
  },
  btn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function TodayScreenContent() {
  const logicalDate = getLogicalDate();
  const allTodos = useTodoStore(s => s.todos);
  const addTodo = useTodoStore(s => s.addTodo);
  const toggleTodo = useTodoStore(s => s.toggleTodo);
  const deleteTodo = useTodoStore(s => s.deleteTodo);
  const restoreTodo = useTodoStore(s => s.restoreTodo);
  const updateTodo = useTodoStore(s => s.updateTodo);
  const reorderTodos = useTodoStore(s => s.reorderTodos);
  const carryOverTodos = useTodoStore(s => s.carryOverTodos);
  const autoCarryOldTodos = useTodoStore(s => s.autoCarryOldTodos);

  // Streak
  const { streak, atRisk } = useTaskStreak(allTodos);

  // Date navigation
  const [viewingDate, setViewingDate] = useState(logicalDate);
  const isToday = viewingDate === logicalDate;
  const [showCalendar, setShowCalendar] = useState(false);

  // Search
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Collapsible completed section
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  // All todos for the viewing date (sorted with smart ordering)
  const dateTodos = useMemo(() => {
    const dayTodos = allTodos.filter(t => t.logicalDate === viewingDate);
    return [...dayTodos].sort((a, b) => {
      // Completed tasks always at bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // Carried-over / overdue tasks at top
      const aCarried = a.carriedOverFrom ? 1 : 0;
      const bCarried = b.carriedOverFrom ? 1 : 0;
      if (aCarried !== bCarried) return bCarried - aCarried;
      // Then by priority
      const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
      const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  }, [allTodos, viewingDate]);

  // Split into active and completed
  const activeTodos = useMemo(() => dateTodos.filter(t => !t.completed), [dateTodos]);
  const completedTodos = useMemo(() => dateTodos.filter(t => t.completed), [dateTodos]);

  // Filtered by category
  const todos = useMemo(() => {
    const active = activeCategory === 'all' ? activeTodos : activeTodos.filter(t => t.category === activeCategory);
    const done = activeCategory === 'all' ? completedTodos : completedTodos.filter(t => t.category === activeCategory);
    // If completed section is collapsed, only show active tasks
    if (completedCollapsed) return active;
    return [...active, ...done];
  }, [activeTodos, completedTodos, activeCategory, completedCollapsed]);

  // Search results across all tasks
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTodos
      .filter(t => t.title.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 15);
  }, [allTodos, searchQuery]);

  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [quickActionTodo, setQuickActionTodo] = useState<Todo | null>(null);
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [focusTodo, setFocusTodo] = useState<Todo | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(0);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [carryOverMode, setCarryOverMode] = useState<'prompt' | 'review'>('prompt');
  const [carryOverSelected, setCarryOverSelected] = useState<Set<string>>(new Set());
  const [checkedCarryOver, setCheckedCarryOver] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCelebratedCount, setLastCelebratedCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showGestureTutorial, setShowGestureTutorial] = useState(false);
  const syncFromFirestore = useTodoStore(s => s.syncFromFirestore);
  const spawnRecurringTasks = useTodoStore(s => s.spawnRecurringTasks);

  // Swipe gesture for day navigation
  const swipeAnim = useRef(new RNAnimated.Value(0)).current;
  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 30 && Math.abs(gs.dy) < 30 && !searchExpanded,
      onPanResponderMove: (_, gs) => {
        swipeAnim.setValue(gs.dx * 0.3);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -80) {
          // Swipe left -> next day
          RNAnimated.timing(swipeAnim, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setViewingDate(prev => shiftDate(prev, 1));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            swipeAnim.setValue(SCREEN_WIDTH);
            RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          });
        } else if (gs.dx > 80) {
          // Swipe right -> prev day
          RNAnimated.timing(swipeAnim, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setViewingDate(prev => shiftDate(prev, -1));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            swipeAnim.setValue(-SCREEN_WIDTH);
            RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          });
        } else {
          RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // Keyboard shortcut state (for web)
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRefForFocus = useRef<any>(null);

  useKeyboardShortcuts({
    onNewTask: () => {
      // Focus the TodoInput - we use a ref indirectly
      inputRefForFocus.current?.focus?.();
    },
    onNavigateUp: () => {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    },
    onNavigateDown: () => {
      setSelectedIndex(prev => Math.min(todos.length - 1, prev + 1));
    },
    onToggleSelected: () => {
      if (selectedIndex >= 0 && selectedIndex < todos.length) {
        handleToggle(todos[selectedIndex].id);
      }
    },
    onDeleteSelected: () => {
      if (selectedIndex >= 0 && selectedIndex < todos.length) {
        handleDelete(todos[selectedIndex]);
        setSelectedIndex(prev => Math.min(prev, todos.length - 2));
      }
    },
  }, true);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drag reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOrder, setDragOrder] = useState<string[]>([]);

  // Sync indicator
  const syncPulse = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const unsub = onSyncStateChange((syncing) => {
      setIsSyncing(syncing);
      if (syncing) {
        RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(syncPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            RNAnimated.timing(syncPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        ).start();
      } else {
        syncPulse.stopAnimation();
        syncPulse.setValue(1);
      }
    });
    return unsub;
  }, []);

  // Sync on mount and spawn recurring tasks
  useEffect(() => {
    syncFromFirestore().catch(() => {}).finally(() => setInitialLoading(false));
    spawnRecurringTasks();
  }, []);

  // Streak milestone check
  const MILESTONE_KEY = 'untodo-last-milestone';
  useEffect(() => {
    if (streak <= 0 || !isToday) return;
    const milestones = [3, 7, 14, 30, 60, 100];
    if (!milestones.includes(streak)) return;
    AsyncStorage.getItem(MILESTONE_KEY).then(val => {
      const last = parseInt(val || '0', 10);
      if (streak > last) {
        setMilestoneStreak(streak);
        setShowMilestone(true);
        AsyncStorage.setItem(MILESTONE_KEY, streak.toString());
      }
    });
  }, [streak, isToday]);

  // Compute habit history for recurring tasks (last 7 days completion)
  const habitHistories = useMemo(() => {
    const map: Record<string, boolean[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dateTodos.filter(t => t.recurrence).forEach(todo => {
      const history: boolean[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        // Check if a task with the same title (or recurringParentId match) was completed on that day
        const parentId = todo.recurringParentId || todo.id;
        const found = allTodos.some(t =>
          t.logicalDate === dateStr &&
          t.completed &&
          (t.recurringParentId === parentId || t.id === parentId || (t.title === todo.title && t.recurrence))
        );
        history.push(found);
      }
      map[todo.id] = history;
    });
    return map;
  }, [dateTodos, allTodos]);

  // Progress bar animation
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const completed = dateTodos.filter(t => t.completed).length;
  const total = dateTodos.length;
  const progress = total > 0 ? completed / total : 0;

  useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Celebration: trigger when all tasks completed
  useEffect(() => {
    if (isToday && total > 0 && completed === total && completed > lastCelebratedCount) {
      setShowCelebration(true);
      setLastCelebratedCount(completed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [completed, total, isToday]);

  // Reset celebration tracking when date changes
  useEffect(() => {
    setLastCelebratedCount(0);
  }, [viewingDate]);

  // Check for carry-over tasks on mount
  useEffect(() => {
    if (checkedCarryOver) return;
    setCheckedCarryOver(true);

    // Auto-carry tasks from 2+ days ago without asking
    autoCarryOldTodos();

    // Show modal only for yesterday's incomplete tasks
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayTodos = allTodos.filter(t => t.logicalDate === logicalDate);
    const yesterdayIncomplete = allTodos.filter(
      t => t.logicalDate === yesterdayStr && !t.completed
    );
    const alreadyCarried = todayTodos.some(t => t.carriedOverFrom);
    if (yesterdayIncomplete.length > 0 && !alreadyCarried) {
      setShowCarryOver(true);
      setCarryOverMode('prompt');
      setCarryOverSelected(new Set(yesterdayIncomplete.map(t => t.id)));
    }
  }, []);

  // Gesture tutorial on first use
  useEffect(() => {
    AsyncStorage.getItem(GESTURE_TUTORIAL_KEY).then(val => {
      if (!val) {
        setShowGestureTutorial(true);
      }
    });
  }, []);

  const dismissGestureTutorial = useCallback(() => {
    setShowGestureTutorial(false);
    AsyncStorage.setItem(GESTURE_TUTORIAL_KEY, 'true');
  }, []);

  const handleToggle = useCallback((id: string) => {
    const todo = allTodos.find(t => t.id === id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo(id);
    // Show undo toast only when completing (not uncompleting)
    if (todo && !todo.completed) {
      showUndoToast({
        id,
        message: 'Task completed.',
        onUndo: () => toggleTodo(id),
      });
    }
  }, [toggleTodo, allTodos]);

  const handleAdd = useCallback((title: string, priority?: Priority, category?: Category, recurrence?: Recurrence, date?: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addTodo(title, priority ?? null, category ?? null, date || viewingDate, recurrence);
  }, [addTodo, viewingDate]);

  // Carry-over candidates count
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const yesterdayIncomplete = useMemo(
    () => allTodos.filter(t => t.logicalDate === yesterdayStr && !t.completed),
    [allTodos, yesterdayStr]
  );
  const carryOverCount = yesterdayIncomplete.length;

  // Categories that exist in viewed date's tasks
  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    dateTodos.forEach(t => { if (t.category) cats.add(t.category); });
    return CATEGORIES.filter(c => cats.has(c.key!));
  }, [dateTodos]);

  // Date navigation handlers
  const goToPrevDay = useCallback(() => {
    setViewingDate(prev => shiftDate(prev, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToNextDay = useCallback(() => {
    setViewingDate(prev => shiftDate(prev, 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToToday = useCallback(() => {
    setViewingDate(logicalDate);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [logicalDate]);

  // Search handlers
  const toggleSearch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchExpanded(prev => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery('');
      }
      return !prev;
    });
  }, []);

  const handleSearchSelect = useCallback((todo: Todo) => {
    setViewingDate(todo.logicalDate);
    setSearchExpanded(false);
    setSearchQuery('');
  }, []);

  // Drag to reorder handlers
  const handleDragStart = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const incompleteIds = dateTodos.filter(t => !t.completed).map(t => t.id);
    setDraggingId(id);
    setDragOrder(incompleteIds);
  }, [dateTodos]);

  const handleDragEnd = useCallback((fromId: string, toIndex: number) => {
    if (dragOrder.length === 0) return;
    const fromIndex = dragOrder.indexOf(fromId);
    if (fromIndex < 0 || fromIndex === toIndex) {
      setDraggingId(null);
      setDragOrder([]);
      return;
    }
    const newOrder = [...dragOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    reorderTodos(newOrder);
    setDraggingId(null);
    setDragOrder([]);
  }, [dragOrder, reorderTodos]);

  // Multi-select handlers
  const enterSelectionMode = useCallback((firstId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([firstId]));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) {
          setSelectionMode(false);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set(activeTodos.map(t => t.id)));
  }, [activeTodos]);

  const batchComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    selectedIds.forEach(id => toggleTodo(id));
    cancelSelection();
  }, [selectedIds, toggleTodo, cancelSelection]);

  const batchDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const deletedTodos = allTodos.filter(t => selectedIds.has(t.id));
    selectedIds.forEach(id => deleteTodo(id));
    cancelSelection();
    showUndoToast({
      id: 'batch-delete',
      message: `${deletedTodos.length} tasks deleted.`,
      onUndo: () => {
        deletedTodos.forEach(t => restoreTodo(t));
      },
    });
  }, [selectedIds, deleteTodo, restoreTodo, allTodos, cancelSelection]);

  const batchSetPriority = useCallback((priority: Priority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectedIds.forEach(id => updateTodo(id, { priority }));
    cancelSelection();
  }, [selectedIds, updateTodo, cancelSelection]);

  const handleDelete = useCallback((todo: Todo) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    deleteTodo(todo.id);
    showUndoToast({
      id: todo.id,
      message: 'Task deleted.',
      onUndo: () => restoreTodo(todo),
    });
  }, [deleteTodo, restoreTodo]);

  const renderItem = useCallback(({ item, index }: { item: Todo; index: number }) => (
    <TodoItem
      todo={item}
      onToggle={() => handleToggle(item.id)}
      onDelete={() => handleDelete(item)}
      onPress={() => setDetailTodo(item)}
      onLongPress={() => {
        if (!selectionMode) {
          enterSelectionMode(item.id);
        }
      }}
      onFocus={!item.completed ? () => setFocusTodo(item) : undefined}
      selectionMode={selectionMode}
      isSelected={selectedIds.has(item.id)}
      onSelect={() => toggleSelection(item.id)}
      habitHistory={habitHistories[item.id]}
    />
  ), [handleToggle, handleDelete, selectionMode, selectedIds, enterSelectionMode, toggleSelection, habitHistories]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {isToday && (
              <View>
                <Text style={styles.greetingText}>{getGreeting()}</Text>
                {(() => {
                  const sub = getGreetingSub(completed, total);
                  return sub ? <Text style={styles.greetingSubText}>{sub}</Text> : null;
                })()}
              </View>
            )}
            <View style={styles.dateRow}>
              <TouchableOpacity
                onPress={goToPrevDay}
                style={styles.navArrow}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Previous day"
                accessibilityRole="button"
              >
                <Text style={styles.navArrowText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCalendar(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText} accessibilityRole="header">{formatDayHeader(viewingDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goToNextDay}
                style={styles.navArrow}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Next day"
                accessibilityRole="button"
              >
                <Text style={styles.navArrowText}>›</Text>
              </TouchableOpacity>
              {isSyncing && (
                <RNAnimated.Text style={[styles.syncIcon, { opacity: syncPulse }]} accessibilityLabel="Syncing">☁</RNAnimated.Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            {activeCats.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowFilters(prev => !prev);
                }}
                style={styles.searchIconBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
                accessibilityRole="button"
              >
                <Text style={[styles.searchIconText, showFilters && { color: Colors.dark.text }]}>☰</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={toggleSearch}
              style={styles.searchIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={searchExpanded ? 'Close search' : 'Search tasks'}
              accessibilityRole="button"
            >
              <Text style={styles.searchIconText}>{searchExpanded ? '✕' : '⌕'}</Text>
            </TouchableOpacity>
            {total > 0 && (
              <Text style={styles.progressText} accessibilityLabel={`${completed} of ${total} tasks done`}>
                {completed}/{total}{total > 0 && completed === total ? ' ✓' : ''}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Search bar (collapsible) */}
      {searchExpanded && (
        <View style={styles.searchContainer}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search all tasks..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onSelect={handleSearchSelect}
            onClose={() => { setSearchExpanded(false); setSearchQuery(''); }}
          />
        </View>
      )}

      {/* Back to Today pill */}
      {!isToday && (
        <TouchableOpacity
          style={styles.backToTodayPill}
          onPress={goToToday}
          accessibilityLabel="Go back to today"
          accessibilityRole="button"
        >
          <Text style={styles.backToTodayText}>Back to Today</Text>
        </TouchableOpacity>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressBar}>
          <RNAnimated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      )}

      {/* Category filter chips - only visible when showFilters is true */}
      {showFilters && activeCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          accessibilityRole="tablist"
        >
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveCategory('all');
            }}
            accessibilityLabel="All categories"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeCategory === 'all' }}
          >
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {activeCats.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.filterChip,
                activeCategory === c.key && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveCategory(activeCategory === c.key ? 'all' : c.key);
              }}
              accessibilityLabel={`Filter: ${c.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeCategory === c.key }}
            >
              <Text style={[
                styles.filterChipText,
                activeCategory === c.key && { color: Colors.dark.background },
              ]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Daily score */}
      {isToday && total > 0 && (
        <DailyScore completed={completed} total={total} streak={streak} />
      )}

      {/* Streak banner */}
      {isToday && (streak > 0 || atRisk) && (
        <StreakBanner streak={streak} atRisk={atRisk} />
      )}

      {/* Evening/night encouragement */}
      {isToday && (getTimeOfDay() === 'evening' || getTimeOfDay() === 'night') && activeTodos.length > 0 && activeTodos.length <= 3 && (
        <View style={styles.encourageBanner}>
          <Text style={styles.encourageText}>
            {getTimeOfDay() === 'night'
              ? `${activeTodos.length} left. Finish or let it go — sleep matters.`
              : `Almost there — just ${activeTodos.length} left. Quick finish?`}
          </Text>
        </View>
      )}

      {/* Selection mode bar */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionBarLeft}>
            <TouchableOpacity onPress={cancelSelection} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.selectionCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          </View>
          <View style={styles.selectionBarRight}>
            <TouchableOpacity onPress={selectAll} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={styles.selectionActionText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={batchComplete} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.success }]}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => batchSetPriority('high')} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.priorityHigh }]}>!</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={batchDelete} style={styles.selectionActionBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={[styles.selectionActionText, { color: Colors.dark.error }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input */}
      {!selectionMode && (
        <TodoInput onAdd={handleAdd} autoFocus={isToday} viewingDate={viewingDate} />
      )}

      {/* Skeleton loading */}
      {initialLoading && total === 0 && (
        <SkeletonLoader />
      )}

      {/* All done banner */}
      {isToday && total > 0 && completed === total && !showCelebration && (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneCheck}>✓</Text>
          <View style={styles.allDoneContent}>
            <Text style={styles.allDoneText}>
              {getTimeOfDay() === 'night' ? 'All clear. Rest well.' :
               getTimeOfDay() === 'evening' ? 'Done for the day. Nice work.' :
               "Everything done! You're a machine 🔥"}
            </Text>
            {streak > 0 && (
              <Text style={styles.allDoneStreak}>{streak} day streak</Text>
            )}
          </View>
        </View>
      )}

      {/* Todo list with swipe gesture */}
      <RNAnimated.View
        style={{ flex: 1, transform: [{ translateX: swipeAnim }] }}
        {...swipePanResponder.panHandlers}
      >
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Re-check carry-over, spawn recurring, and sync
              setCheckedCarryOver(false);
              spawnRecurringTasks();
              await syncFromFirestore().catch(() => {});
              setRefreshing(false);
            }}
            tintColor={Colors.dark.textTertiary}
            title="Pull to sync"
            titleColor={Colors.dark.textTertiary}
          />
        }
        ListEmptyComponent={
          !initialLoading ? (
            <EmptyState isToday={isToday} allCompleted={false} />
          ) : null
        }
        ListFooterComponent={
          <View>
            {completedTodos.length > 0 && (
              <View>
                <TouchableOpacity
                  style={styles.completedSectionHeader}
                  onPress={() => {
                    Haptics.selectionAsync();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setCompletedCollapsed(prev => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.completedSectionText}>
                    Completed ({completedTodos.length})
                  </Text>
                  <Text style={styles.completedSectionChevron}>
                    {completedCollapsed ? '›' : '⌄'}
                  </Text>
                </TouchableOpacity>
                {!completedCollapsed && completedTodos.map(item => (
                  <TodoItem
                    key={item.id}
                    todo={item}
                    onToggle={() => handleToggle(item.id)}
                    onDelete={() => handleDelete(item)}
                    onPress={() => setDetailTodo(item)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setQuickActionTodo(item);
                    }}
                  />
                ))}
              </View>
            )}
            {isToday && <TaskInsight todos={allTodos} />}
            {isToday && total > 0 && <DailyQuote />}
            {isToday && total > 0 && completed > 0 && (
              <ShareDayCard completed={completed} total={total} streak={streak} />
            )}
          </View>
        }
      />
      </RNAnimated.View>

      {/* Carry-over modal */}
      {showCarryOver && (
        <Modal visible={showCarryOver} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Unfinished Business</Text>
              {carryOverMode === 'prompt' ? (
                <>
                  <Text style={styles.modalText}>
                    You have {carryOverCount} unfinished task{carryOverCount !== 1 ? 's' : ''} from yesterday.
                  </Text>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      carryOverTodos();
                      setShowCarryOver(false);
                    }}
                    accessibilityLabel="Carry over all unfinished tasks"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalPrimaryBtnText}>Carry All Forward</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalOutlineBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCarryOverMode('review');
                    }}
                    accessibilityLabel="Review tasks to carry over"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalOutlineBtnText}>Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => setShowCarryOver(false)}
                    accessibilityLabel="Start fresh without carrying over"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalSecondaryBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalText}>Select tasks to carry forward:</Text>
                  <ScrollView style={styles.reviewList}>
                    {yesterdayIncomplete.map(task => {
                      const selected = carryOverSelected.has(task.id);
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.reviewItem}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setCarryOverSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(task.id)) next.delete(task.id);
                              else next.add(task.id);
                              return next;
                            });
                          }}
                        >
                          <View style={[styles.reviewCheck, selected && styles.reviewCheckSelected]}>
                            {selected && <Text style={styles.reviewCheckMark}>✓</Text>}
                          </View>
                          <Text style={styles.reviewItemText} numberOfLines={2}>{task.title}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.modalPrimaryBtn, carryOverSelected.size === 0 && { opacity: 0.4 }]}
                    disabled={carryOverSelected.size === 0}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      // Carry only selected tasks
                      const now = new Date().toISOString();
                      const selectedTasks = yesterdayIncomplete.filter(t => carryOverSelected.has(t.id));
                      selectedTasks.forEach(t => {
                        addTodo(t.title, t.priority, t.category, logicalDate, t.recurrence);
                      });
                      setShowCarryOver(false);
                    }}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      Carry {carryOverSelected.size} Task{carryOverSelected.size !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSecondaryBtn}
                    onPress={() => setCarryOverMode('prompt')}
                  >
                    <Text style={styles.modalSecondaryBtnText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Pomodoro modal */}
      {pomodoroTodo && (
        <PomodoroTimer
          todo={pomodoroTodo}
          visible={!!pomodoroTodo}
          onClose={() => setPomodoroTodo(null)}
        />
      )}

      {/* Task detail */}
      {detailTodo && (
        <TaskDetail
          todo={detailTodo}
          visible={!!detailTodo}
          onClose={() => setDetailTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => { deleteTodo(id); setDetailTodo(null); }}
          onStartPomodoro={(todo) => { setDetailTodo(null); setPomodoroTodo(todo); }}
        />
      )}

      {/* Quick actions */}
      {quickActionTodo && (
        <QuickActions
          todo={quickActionTodo}
          visible={!!quickActionTodo}
          onClose={() => setQuickActionTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => {
            const todo = allTodos.find(t => t.id === id);
            deleteTodo(id);
            setQuickActionTodo(null);
            if (todo) {
              showUndoToast({
                id,
                message: 'Task deleted.',
                onUndo: () => restoreTodo(todo),
              });
            }
          }}
        />
      )}

      {/* Celebration overlay */}
      <ConfettiCelebration
        visible={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        streak={streak}
      />

      {/* Calendar picker */}
      {showCalendar && (
        <CalendarPicker
          selectedDate={viewingDate}
          allTodos={allTodos}
          onSelectDate={setViewingDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Focus mode */}
      {focusTodo && (
        <FocusMode
          todo={focusTodo}
          visible={!!focusTodo}
          onClose={() => setFocusTodo(null)}
          onComplete={() => {
            toggleTodo(focusTodo.id);
            setFocusTodo(null);
          }}
        />
      )}

      {/* Streak milestone celebration */}
      <StreakMilestone
        streak={milestoneStreak}
        visible={showMilestone}
        onDismiss={() => setShowMilestone(false)}
      />

      {/* Gesture tutorial */}
      {showGestureTutorial && (
        <GestureTutorial onDismiss={dismissGestureTutorial} />
      )}

      {/* Undo toast */}
      <UndoToast />
    </SafeAreaView>
  );
}

export default function TodayScreen() {
  return (
    <ErrorBoundary>
      <TodayScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: 2,
  },
  greetingSubText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  navArrow: {
    padding: 4,
  },
  navArrowText: {
    color: Colors.dark.textSecondary,
    fontSize: 28,
    fontFamily: Fonts.body,
    lineHeight: 32,
  },
  syncIcon: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
  },
  dateText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    flexShrink: 1,
  },
  completedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  completedSectionText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  completedSectionChevron: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
  },
  // Search
  searchIconBtn: {
    padding: 4,
  },
  searchIconText: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
    fontFamily: Fonts.body,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  searchInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchResults: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.xs,
    maxHeight: 240,
    overflow: 'hidden',
  },
  searchScroll: {
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  searchResultTitleDone: {
    color: Colors.dark.textTertiary,
    textDecorationLine: 'line-through',
  },
  searchResultDate: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  searchResultCheck: {
    color: Colors.dark.success,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  searchDateHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.dark.background,
  },
  searchDateHeaderText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchNoResults: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },

  // Back to today
  backToTodayPill: {
    alignSelf: 'center',
    backgroundColor: Colors.dark.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  backToTodayText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },

  progressBar: {
    height: 3,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 2,
  },
  filterScroll: {
    maxHeight: 40,
    marginTop: Spacing.sm,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  filterChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.dark.background,
  },
  // Selection mode
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  selectionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  selectionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  selectionCancel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  selectionCount: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  selectionActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionActionText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  list: {
    paddingBottom: 120,
    paddingTop: Spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    color: Colors.dark.textTertiary,
    fontSize: 40,
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
  emptyQuote: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },
  emptySubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  allDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.success + '12',
    borderRadius: 12,
    marginTop: Spacing.xs,
  },
  allDoneCheck: {
    color: Colors.dark.success,
    fontSize: 18,
    fontWeight: '700',
  },
  allDoneText: {
    color: Colors.dark.success,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
  },

  // Carry-over modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 20,
    marginBottom: Spacing.sm,
  },
  modalText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalPrimaryBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modalPrimaryBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  modalSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  modalOutlineBtn: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalOutlineBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  reviewList: {
    maxHeight: 240,
    width: '100%',
    marginBottom: Spacing.md,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    gap: Spacing.md,
  },
  reviewCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewCheckSelected: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  reviewCheckMark: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewItemText: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    flex: 1,
  },

  // Celebration
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiParticle: {
    position: 'absolute',
  },
  celebrationTextContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  celebrationText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 24,
    textAlign: 'center',
  },
  celebrationSubtext: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  celebrationStreak: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  encourageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.timer + '15',
    borderRadius: 12,
    marginTop: Spacing.xs,
  },
  encourageText: {
    color: Colors.dark.timer,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    textAlign: 'center',
  },
  allDoneContent: {
    flex: 1,
  },
  allDoneStreak: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    marginTop: 2,
  },
});
