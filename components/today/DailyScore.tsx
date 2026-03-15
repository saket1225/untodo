import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';

export function getDailyScore(completed: number, total: number, streak: number): { grade: string; color: string; pct: number } {
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

export function DailyScore({ completed, total, streak }: { completed: number; total: number; streak: number }) {
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
    paddingVertical: 12,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.sm,
  },
  gradeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    fontFamily: Fonts.accent,
    fontSize: 18,
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

export function StreakMilestone({ streak, visible, onDismiss }: { streak: number; visible: boolean; onDismiss: () => void }) {
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
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    const t3 = setTimeout(onDismiss, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
