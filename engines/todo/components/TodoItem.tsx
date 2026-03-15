import { useRef, memo, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
  LayoutAnimation, UIManager, Platform, PanResponder, Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

const SWIPE_THRESHOLD = 80;
const ICON_FADE_START = 40;

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
    <Text style={styles.trackingTime}>
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
    <View style={styles.confettiContainer} pointerEvents="none">
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

  // Swipe gesture state
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHaptic = useRef(false);
  const swipeDirection = useRef<'left' | 'right' | null>(null);

  const canSwipe = !todo.completed && !selectionMode;
  const canSwipeRef = useRef(canSwipe);
  canSwipeRef.current = canSwipe;

  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return canSwipeRef.current && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        hasTriggeredHaptic.current = false;
        swipeDirection.current = null;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!canSwipeRef.current) return;

        const { dx } = gestureState;
        swipeDirection.current = dx > 0 ? 'right' : 'left';
        translateX.setValue(dx);

        // Trigger haptic at threshold
        if (Math.abs(dx) >= SWIPE_THRESHOLD && !hasTriggeredHaptic.current) {
          hasTriggeredHaptic.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        // Reset haptic if user swipes back below threshold
        if (Math.abs(dx) < SWIPE_THRESHOLD && hasTriggeredHaptic.current) {
          hasTriggeredHaptic.current = false;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!canSwipeRef.current) return;

        const { dx } = gestureState;
        if (dx >= SWIPE_THRESHOLD) {
          // Swipe right → complete
          Animated.timing(translateX, {
            toValue: Dimensions.get('window').width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onToggleRef.current();
          });
        } else if (dx <= -SWIPE_THRESHOLD) {
          // Swipe left → delete
          Animated.timing(translateX, {
            toValue: -Dimensions.get('window').width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onDeleteRef.current();
          });
        } else {
          // Spring back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 200,
            friction: 15,
          }).start();
        }
        swipeDirection.current = null;
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 15,
        }).start();
        swipeDirection.current = null;
      },
    })
  ).current;

  // Interpolations for swipe backgrounds and icons
  const rightSwipeOpacity = translateX.interpolate({
    inputRange: [0, ICON_FADE_START, SWIPE_THRESHOLD],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const leftSwipeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -ICON_FADE_START, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const rightBgOpacity = translateX.interpolate({
    inputRange: [0, 20],
    outputRange: [0, 0.1],
    extrapolate: 'clamp',
  });

  const leftBgOpacity = translateX.interpolate({
    inputRange: [-20, 0],
    outputRange: [0.1, 0],
    extrapolate: 'clamp',
  });

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

  return (
    <View style={styles.wrapper}>
      {/* Swipe action backgrounds */}
      {canSwipe && (
        <>
          {/* Right swipe - complete (green) */}
          <Animated.View
            style={[
              styles.swipeBackground,
              styles.swipeBackgroundLeft,
              { opacity: rightBgOpacity, backgroundColor: Colors.dark.success },
            ]}
            pointerEvents="none"
          >
            <Animated.Text style={[styles.swipeIcon, { opacity: rightSwipeOpacity }]}>
              ✓
            </Animated.Text>
          </Animated.View>
          {/* Left swipe - delete (red) */}
          <Animated.View
            style={[
              styles.swipeBackground,
              styles.swipeBackgroundRight,
              { opacity: leftBgOpacity, backgroundColor: Colors.dark.error },
            ]}
            pointerEvents="none"
          >
            <Animated.Text style={[styles.swipeIcon, styles.swipeIconDelete, { opacity: leftSwipeOpacity }]}>
              ✕
            </Animated.Text>
          </Animated.View>
        </>
      )}
      <Animated.View
        {...(canSwipe ? panResponder.panHandlers : {})}
        style={[
          styles.container,
          { transform: [{ scale: scaleAnim }, ...(canSwipe ? [{ translateX }] : [])] },
          priorityColor ? { borderLeftWidth: 3, borderLeftColor: priorityColor } : { borderLeftWidth: 3, borderLeftColor: 'transparent' },
          todo.priority === 'high' && !selectionMode && styles.highPriorityContainer,
          todo.priority === 'medium' && !selectionMode && styles.mediumPriorityContainer,
          isTracking && !selectionMode && { borderColor: Colors.dark.timer, borderWidth: 1 },
          todo.completed && !selectionMode && { opacity: 0.4 },
          selectionMode && isSelected && styles.selectedContainer,
        ]}
      >
        {/* Checkbox / Selection */}
        {selectionMode ? (
          <TouchableOpacity
            style={styles.checkbox}
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
            style={styles.checkbox}
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
              <View style={[styles.categoryDot, { backgroundColor: categoryInfo.color }]} />
            )}
            <Text
              style={[
                styles.title,
                todo.completed && styles.titleCompleted,
                !todo.completed && todo.priority === 'high' && styles.highPriorityTitle,
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
              <View style={styles.subtaskMeta}>
                <Text style={[styles.metaText, subtasksDone === subtasks.length && { color: Colors.dark.success }]}>
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
          <View style={styles.habitDots}>
            {habitHistory.map((done, i) => (
              <View
                key={i}
                style={[
                  styles.habitDot,
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

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    overflow: 'hidden',
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  swipeBackgroundLeft: {
    alignItems: 'flex-start',
    paddingLeft: 24,
  },
  swipeBackgroundRight: {
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  swipeIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  swipeIconDelete: {
    color: Colors.dark.error,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
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
    backgroundColor: Colors.dark.accent + '12',
  },
  highPriorityTitle: {
    fontFamily: Fonts.bodyMedium,
  },
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
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  selectionCheck: {
    color: Colors.dark.background,
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.success,
    borderColor: Colors.dark.success,
  },
  checkmark: {
    color: Colors.dark.background,
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
    backgroundColor: Colors.dark.timer + '22',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  carriedOverArrow: {
    color: Colors.dark.timer,
    fontSize: 11,
  },
  carriedOverText: {
    color: Colors.dark.timer,
    fontSize: 9,
    fontFamily: Fonts.body,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 21,
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    minWidth: 40,
  },
  metaText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  subtaskMeta: {
    alignItems: 'center',
    gap: 2,
  },
  subtaskProgressBar: {
    width: 28,
    height: 2,
    backgroundColor: Colors.dark.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  subtaskProgressFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 1,
  },
  pomodoroText: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  estimate: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
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
  habitDotDone: {
    backgroundColor: Colors.dark.success,
  },
  habitDotMissed: {
    backgroundColor: Colors.dark.border,
  },
  habitDotToday: {
    backgroundColor: Colors.dark.success,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trackingBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBtnActive: {
    backgroundColor: Colors.dark.timer + '22',
    borderWidth: 1,
    borderColor: Colors.dark.timer,
  },
  trackingBtnText: {
    fontSize: 9,
    color: Colors.dark.textTertiary,
  },
  trackingBtnTextActive: {
    color: Colors.dark.timer,
  },
  trackingTime: {
    color: Colors.dark.timer,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
  },
  trackingTimeIdle: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
});
