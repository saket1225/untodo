import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
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
  const { colors } = useTheme();

  if (streak <= 0 && !atRisk) return null;

  if (atRisk) {
    return (
      <View style={[streakStyles.banner, { backgroundColor: colors.error + '12', borderColor: colors.error + '25' }]}>
        <Text style={streakStyles.streakEmoji}>⚠️</Text>
        <Text style={[streakStyles.warningText, { color: colors.error }]}>Your streak is about to break! Complete a task.</Text>
      </View>
    );
  }

  return (
    <View style={[streakStyles.banner, { backgroundColor: colors.timer + '12', borderColor: colors.timer + '20' }]}>
      <Text style={streakStyles.streakEmoji}>🔥</Text>
      <Text style={[streakStyles.streakText, { color: colors.timer }]}>
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
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  bannerWarning: {
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  warningText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
