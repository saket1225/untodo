import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { Todo } from '../../engines/todo/types';
import { generateDailyInsight } from '../../lib/insights';

export function TaskInsight({ todos }: { todos: Todo[] }) {
  const { colors } = useTheme();
  const insight = useMemo(() => generateDailyInsight(todos), [todos]);
  if (!insight) return null;

  return (
    <View style={insightStyles.container}>
      <Text style={[insightStyles.icon, { color: colors.textTertiary }]}>◆</Text>
      <Text style={[insightStyles.text, { color: colors.textTertiary }]}>{insight}</Text>
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
    fontSize: 8,
    opacity: 0.5,
  },
  text: {
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
    opacity: 0.8,
  },
});
