import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { usePomodoroState } from '../../engines/todo/pomodoroState';

export function PomodoroHeaderIndicator() {
  const { isActive, taskTitle, phase, secondsLeft, isFlowtime } = usePomodoroState();

  if (!isActive) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const phaseLabel = phase === 'work' ? (isFlowtime ? 'Flow' : 'Focus') : 'Break';
  const phaseColor = phase === 'work' ? Colors.dark.text : Colors.dark.timer;

  return (
    <View style={pomHeaderStyles.container}>
      <View style={pomHeaderStyles.dot} />
      <Text style={[pomHeaderStyles.phase, { color: phaseColor }]}>{phaseLabel}</Text>
      <Text style={pomHeaderStyles.time}>{timeStr}</Text>
      <Text style={pomHeaderStyles.task} numberOfLines={1}>{taskTitle}</Text>
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  phase: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  time: {
    color: Colors.dark.text,
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  task: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    flex: 1,
  },
});
