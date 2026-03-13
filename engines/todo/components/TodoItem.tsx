import { useRef, memo, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Alert, Dimensions,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_COMPLETE_THRESHOLD = 80;
const SWIPE_DELETE_THRESHOLD = -100;

const CONFETTI_COLORS = ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#F5F5F5'];
const NUM_CONFETTI = 8;

interface Props {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
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

function TodoItemInner({ todo, onToggle, onDelete, onPress, onLongPress, selectionMode, isSelected, onSelect }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [showConfetti, setShowConfetti] = useState(false);
  const startTimeTracking = useTodoStore(s => s.startTimeTracking);
  const stopTimeTracking = useTodoStore(s => s.stopTimeTracking);

  const isTracking = !!todo.timeTracking?.startedAt;
  const totalSeconds = todo.timeTracking?.totalSeconds || 0;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0 && !todo.completed) {
          translateX.setValue(gs.dx);
        } else if (gs.dx < 0) {
          translateX.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_COMPLETE_THRESHOLD && !todo.completed) {
          // Swipe right -> complete with satisfying animation
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 500);
          Animated.parallel([
            Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0.3, duration: 250, useNativeDriver: true }),
          ]).start(() => {
            if (isTracking) stopTimeTracking(todo.id);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggle();
            translateX.setValue(0);
            opacityAnim.setValue(1);
          });
        } else if (gs.dx < SWIPE_DELETE_THRESHOLD) {
          Animated.spring(translateX, { toValue: -120, useNativeDriver: true, friction: 8 }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(
            'Delete task?',
            todo.title,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
                },
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Animated.parallel([
                    Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                  ]).start(() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    onDelete();
                    translateX.setValue(0);
                    opacityAnim.setValue(1);
                  });
                },
              },
            ]
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    })
  ).current;

  const handleToggle = () => {
    if (!todo.completed) {
      // Completing — satisfying scale pulse + confetti + haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 500);
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

  const completeBackgroundOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_COMPLETE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const deleteBackgroundOpacity = translateX.interpolate({
    inputRange: [SWIPE_DELETE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.wrapper, { opacity: opacityAnim }]}>
      {/* Complete background (green, left side) */}
      {!todo.completed && (
        <Animated.View style={[styles.completeBackground, { opacity: completeBackgroundOpacity }]}>
          <Text style={styles.completeText}>✓ Done</Text>
        </Animated.View>
      )}
      {/* Delete background (red, right side) */}
      <Animated.View style={[styles.deleteBackground, { opacity: deleteBackgroundOpacity }]}>
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateX }, { scale: scaleAnim }] },
          priorityColor ? { borderLeftWidth: 3, borderLeftColor: priorityColor } : { borderLeftWidth: 3, borderLeftColor: 'transparent' },
          todo.priority === 'high' && !selectionMode && styles.highPriorityContainer,
          todo.priority === 'medium' && !selectionMode && styles.mediumPriorityContainer,
          isTracking && !selectionMode && { borderColor: Colors.dark.timer, borderWidth: 1 },
          todo.completed && !selectionMode && { opacity: 0.4 },
          selectionMode && isSelected && styles.selectedContainer,
        ]}
        {...panResponder.panHandlers}
      >
        {/* Checkbox / Selection */}
        {selectionMode ? (
          <TouchableOpacity style={styles.checkbox} onPress={onSelect}>
            <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
              {isSelected && <Text style={styles.selectionCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.checkbox} onPress={handleToggle}>
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
          onLongPress={selectionMode ? undefined : onLongPress}
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
            {pomodoroMins > 0 && (
              <Text style={styles.pomodoroText}>{pomodoroMins}m</Text>
            )}
            {(isTracking || totalSeconds > 0) && (
              isTracking ? (
                <LiveTimer startedAt={todo.timeTracking!.startedAt!} baseSeconds={totalSeconds} />
              ) : (
                <Text style={styles.trackingTimeIdle}>{formatTrackingTime(totalSeconds)}</Text>
              )
            )}
            {todo.estimatedMinutes != null && todo.estimatedMinutes > 0 && (
              <Text style={styles.estimate}>~{todo.estimatedMinutes}m</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Time tracking button */}
        {!todo.completed && (
          <TouchableOpacity
            style={[styles.trackingBtn, isTracking && styles.trackingBtnActive]}
            onPress={toggleTracking}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.trackingBtnText, isTracking && styles.trackingBtnTextActive]}>
              {isTracking ? '⏸' : '▶'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
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
    prev.isSelected === next.isSelected
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
  completeBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: Colors.dark.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: Spacing.lg,
  },
  completeText: {
    color: '#000',
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: Colors.dark.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.lg,
  },
  deleteText: {
    color: '#fff',
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
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
    padding: 2,
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
  trackingBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
