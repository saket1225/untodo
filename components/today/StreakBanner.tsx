import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { Todo } from '../../engines/todo/types';
import { calculateStreak } from '../../lib/streak';

export function useTaskStreak(allTodos: Todo[]): { streak: number; atRisk: boolean } {
  return useMemo(() => {
    const streak = calculateStreak(allTodos);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayCompleted = allTodos.some(t => t.logicalDate === todayStr && t.completed);
    const todayHasTasks = allTodos.some(t => t.logicalDate === todayStr);

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
