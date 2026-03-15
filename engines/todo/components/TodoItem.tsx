import { useRef, memo, useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
import { Todo, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CONFETTI_COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#F5F5F5'];
const NUM_CONFETTI = 8;

interface Props {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  habitHistory?: boolean[]; // last 7 days: true = completed, false = missed
}

function formatTrackingTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function LiveTimer({ startedAt, baseSeconds }: { startedAt: string; baseSeconds: number }) {
  const [elapsed, setElapsed] = useState(0);
  const { colors } = useTheme();

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <Text style={{ color: colors.timer, fontFamily: Fonts.bodyMedium, fontSize: 11 }}>
      {formatTrackingTime(baseSeconds + elapsed)}
    </Text>
  );
}

// Mini confetti burst on the checkbox area
function CheckboxConfetti({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: NUM_CONFETTI }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      angle: (i / NUM_CONFETTI) * 2 * Math.PI,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    const radius = 24;
    particles.forEach((p) => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(1);
      Animated.parallel([
        Animated.timing(p.x, {
          toValue: Math.cos(p.angle) * radius,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: Math.sin(p.angle) * radius,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={staticStyles.confettiContainer} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 5,
            height: 5,
            borderRadius: i % 2 === 0 ? 2.5 : 1,
            backgroundColor: p.color,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
            ],
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}

function TodoItemInner({ todo, onToggle, onDelete, onPress, onLongPress, onFocus, selectionMode, isSelected, onSelect, habitHistory }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeTracking = useTodoStore(s => s.startTimeTracking);
  const stopTimeTracking = useTodoStore(s => s.stopTimeTracking);
  const { colors } = useTheme();

  // Cleanup confetti timer on unmount
  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  const isTracking = !!todo.timeTracking?.startedAt;
  const totalSeconds = todo.timeTracking?.totalSeconds || 0;

  const handleToggle = () => {
    if (!todo.completed) {
      // Completing — satisfying scale pulse + confetti + haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 500);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 120, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 300 }),
      ]).start();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
      ]).start();
    }
    if (!todo.completed && isTracking) {
      stopTimeTracking(todo.id);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  const handleLongPress = () => {
    if (selectionMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.();
  };

  const toggleTracking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isTracking) {
      stopTimeTracking(todo.id);
    } else {
      startTimeTracking(todo.id);
    }
  };

  const priorityColor = todo.priority ? PRIORITY_CONFIG[todo.priority].color : null;
  const categoryInfo = todo.category ? CATEGORIES.find(c => c.key === todo.category) : null;
  const pomodoroMins = todo.pomodoroMinutesLogged || 0;
  const subtasks = todo.subtasks || [];
  const subtasksDone = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? subtasksDone / subtasks.length : 0;

  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      position: 'relative',
      marginHorizontal: Spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.sm,
    },
    highPriorityContainer: {
      backgroundColor: '#EF44440A',
      borderLeftWidth: 3,
      borderLeftColor: '#EF4444',
    },
    mediumPriorityContainer: {
      backgroundColor: '#FBBF240A',
    },
    selectedContainer: {
      backgroundColor: colors.accent + '12',
    },
    selectionCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectionCircleActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    selectionCheck: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '700',
    },
    checkboxInner: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    checkmark: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '700',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 6,
    },
    carriedOverBadge: {
      backgroundColor: colors.timer + '22',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    carriedOverArrow: {
      color: colors.timer,
      fontSize: 11,
    },
    carriedOverText: {
      color: colors.timer,
      fontSize: 9,
      fontFamily: Fonts.body,
    },
    title: {
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 15,
      lineHeight: 21,
      flex: 1,
    },
    titleCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textTertiary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      minWidth: 40,
    },
    metaText: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    subtaskProgressBar: {
      width: 28,
      height: 2,
      backgroundColor: colors.border,
      borderRadius: 1,
      overflow: 'hidden',
    },
    subtaskProgressFill: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 1,
    },
    estimate: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    habitDotDone: {
      backgroundColor: colors.success,
    },
    habitDotMissed: {
      backgroundColor: colors.border,
    },
    habitDotToday: {
      backgroundColor: colors.success,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    trackingBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    trackingBtnActive: {
      backgroundColor: colors.timer + '22',
      borderWidth: 1,
      borderColor: colors.timer,
    },
    trackingBtnText: {
      fontSize: 9,
      color: colors.textTertiary,
    },
    trackingBtnTextActive: {
      color: colors.timer,
    },
    trackingTimeIdle: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
  }), [colors]);

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ scale: scaleAnim }] },
          priorityColor ? { borderLeftWidth: 3, borderLeftColor: priorityColor } : { borderLeftWidth: 3, borderLeftColor: 'transparent' },
          todo.priority === 'high' && !selectionMode && styles.highPriorityContainer,
          todo.priority === 'medium' && !selectionMode && styles.mediumPriorityContainer,
          isTracking && !selectionMode && { borderColor: colors.timer, borderWidth: 1 },
          todo.completed && !selectionMode && { opacity: 0.4 },
          selectionMode && isSelected && styles.selectedContainer,
        ]}
      >
        {/* Checkbox / Selection */}
        {selectionMode ? (
          <TouchableOpacity
            style={staticStyles.checkbox}
            onPress={onSelect}
            accessibilityLabel={isSelected ? 'Deselect task' : 'Select task'}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
          >
            <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
              {isSelected && <Text style={styles.selectionCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={staticStyles.checkbox}
            onPress={handleToggle}
            accessibilityLabel={todo.completed ? `Mark "${todo.title}" incomplete` : `Complete "${todo.title}"`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: todo.completed }}
          >
            <View style={[
              styles.checkboxInner,
              todo.completed && styles.checkboxChecked,
              !todo.completed && todo.priority === 'high' && { borderColor: PRIORITY_CONFIG.high.color },
              !todo.completed && todo.priority === 'medium' && { borderColor: PRIORITY_CONFIG.medium.color },
            ]}>
              {todo.completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <CheckboxConfetti visible={showConfetti} />
          </TouchableOpacity>
        )}

        {/* Content */}
        <TouchableOpacity
          style={styles.content}
          onPress={selectionMode ? onSelect : onPress}
          onLongPress={selectionMode ? undefined : handleLongPress}
          activeOpacity={0.7}
          delayLongPress={400}
        >
          <View style={styles.titleRow}>
            {todo.carriedOverFrom && (
              <View style={styles.carriedOverBadge}>
                <Text style={styles.carriedOverArrow}>↗</Text>
                <Text style={styles.carriedOverText}>carried</Text>
              </View>
            )}
            {categoryInfo && (
              <View style={[staticStyles.categoryDot, { backgroundColor: categoryInfo.color }]} />
            )}
            <Text
              style={[
                styles.title,
                todo.completed && styles.titleCompleted,
                !todo.completed && todo.priority === 'high' && { fontFamily: Fonts.bodyMedium },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {todo.title}
            </Text>
          </View>

          {/* Right-side metadata */}
          <View style={styles.metaRow}>
            {todo.recurrence && (
              <Text style={styles.metaText}>↻</Text>
            )}
            {subtasks.length > 0 && (
              <View style={staticStyles.subtaskMeta}>
                <Text style={[styles.metaText, subtasksDone === subtasks.length && { color: colors.success }]}>
                  {subtasksDone}/{subtasks.length}
                </Text>
                <View style={styles.subtaskProgressBar}>
                  <View style={[styles.subtaskProgressFill, { width: `${subtaskProgress * 100}%` }]} />
                </View>
              </View>
            )}
            {/* Combined time: pomodoro + time tracking */}
            {(() => {
              const pomodoroSeconds = pomodoroMins * 60;
              const combinedBase = totalSeconds + pomodoroSeconds;
              if (isTracking && todo.timeTracking?.startedAt) {
                return <LiveTimer startedAt={todo.timeTracking.startedAt} baseSeconds={combinedBase} />;
              }
              if (combinedBase > 0) {
                return <Text style={styles.trackingTimeIdle}>{formatTrackingTime(combinedBase)}</Text>;
              }
              return null;
            })()}
            {todo.estimatedMinutes != null && todo.estimatedMinutes > 0 && (
              <Text style={styles.estimate}>~{todo.estimatedMinutes}m</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Habit tracking dots for recurring tasks */}
        {todo.recurrence && habitHistory && habitHistory.length > 0 && !selectionMode && (
          <View style={staticStyles.habitDots}>
            {habitHistory.map((done, i) => (
              <View
                key={i}
                style={[
                  staticStyles.habitDot,
                  done ? styles.habitDotDone : styles.habitDotMissed,
                  i === habitHistory.length - 1 && done && styles.habitDotToday,
                ]}
              />
            ))}
          </View>
        )}

        {/* Focus / Time tracking button */}
        {!todo.completed && (
          <TouchableOpacity
            style={[styles.trackingBtn, isTracking && styles.trackingBtnActive]}
            onPress={onFocus || toggleTracking}
            onLongPress={onFocus ? toggleTracking : undefined}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={isTracking ? 'Stop time tracking' : 'Focus on task'}
            accessibilityRole="button"
          >
            <Text style={[styles.trackingBtnText, isTracking && styles.trackingBtnTextActive]}>
              {isTracking ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const TodoItem = memo(TodoItemInner, (prev, next) => {
  return (
    prev.todo.id === next.todo.id &&
    prev.todo.title === next.todo.title &&
    prev.todo.completed === next.todo.completed &&
    prev.todo.priority === next.todo.priority &&
    prev.todo.category === next.todo.category &&
    prev.todo.estimatedMinutes === next.todo.estimatedMinutes &&
    prev.todo.pomodoroMinutesLogged === next.todo.pomodoroMinutesLogged &&
    prev.todo.notes === next.todo.notes &&
    prev.todo.subtasks?.length === next.todo.subtasks?.length &&
    prev.todo.subtasks?.filter(s => s.completed).length === next.todo.subtasks?.filter(s => s.completed).length &&
    prev.todo.carriedOverFrom === next.todo.carriedOverFrom &&
    prev.todo.recurrence?.type === next.todo.recurrence?.type &&
    prev.todo.timeTracking?.startedAt === next.todo.timeTracking?.startedAt &&
    prev.todo.timeTracking?.totalSeconds === next.todo.timeTracking?.totalSeconds &&
    prev.selectionMode === next.selectionMode &&
    prev.isSelected === next.isSelected &&
    prev.habitHistory === next.habitHistory
  );
});

export default TodoItem;

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
  checkbox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  subtaskMeta: {
    alignItems: 'center',
    gap: 2,
  },
  habitDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 4,
  },
  habitDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
