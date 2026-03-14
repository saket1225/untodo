import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../../../engines/todo/types';
import { generateDailyInsight } from '../../../lib/insights';

export function TaskInsight({ todos }: { todos: Todo[] }) {
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
