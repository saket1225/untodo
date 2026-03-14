import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../../../engines/todo/types';

export function useTaskStreak(allTodos: Todo[]): { streak: number; atRisk: boolean } {
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

export function StreakBanner({ streak, atRisk }: { streak: number; atRisk: boolean }) {
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

export const streakStyles = StyleSheet.create({
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
