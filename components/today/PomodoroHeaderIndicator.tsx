import { View, Text, StyleSheet } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { usePomodoroState } from '../../engines/todo/pomodoroState';

export function PomodoroHeaderIndicator() {
  const { colors } = useTheme();
  const { isActive, taskTitle, phase, secondsLeft, isFlowtime } = usePomodoroState();

  if (!isActive) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const phaseLabel = phase === 'work' ? (isFlowtime ? 'Flow' : 'Focus') : 'Break';
  const phaseColor = phase === 'work' ? colors.text : colors.timer;

  return (
    <View style={[pomHeaderStyles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[pomHeaderStyles.dot, { backgroundColor: colors.success }]} />
      <Text style={[pomHeaderStyles.phase, { color: phaseColor }]}>{phaseLabel}</Text>
      <Text style={[pomHeaderStyles.time, { color: colors.text }]}>{timeStr}</Text>
      <Text style={[pomHeaderStyles.task, { color: colors.textTertiary }]} numberOfLines={1}>{taskTitle}</Text>
    </View>
  );
}

const pomHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phase: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  time: {
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  task: {
    fontFamily: Fonts.body,
    fontSize: 12,
    flex: 1,
  },
});
