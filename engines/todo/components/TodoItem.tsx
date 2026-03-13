import { useRef, memo, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder,
} from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

interface Props {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
  onLongPress?: () => void;
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

function TodoItemInner({ todo, onToggle, onDelete, onPress, onLongPress }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const startTimeTracking = useTodoStore(s => s.startTimeTracking);
  const stopTimeTracking = useTodoStore(s => s.stopTimeTracking);

  const isTracking = !!todo.timeTracking?.startedAt;
  const totalSeconds = todo.timeTracking?.totalSeconds || 0;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -100) {
          Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(onDelete);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    if (!todo.completed && isTracking) {
      stopTimeTracking(todo.id);
    }
    onToggle();
  };

  const toggleTracking = () => {
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

  return (
    <View style={styles.wrapper}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Delete</Text>
      </View>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateX }, { scale: scaleAnim }] },
          priorityColor ? { borderLeftWidth: 3, borderLeftColor: priorityColor } : { borderLeftWidth: 3, borderLeftColor: 'transparent' },
          isTracking && { borderColor: Colors.dark.timer, borderWidth: 1 },
          todo.completed && { opacity: 0.4 },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Checkbox */}
        <TouchableOpacity style={styles.checkbox} onPress={handleToggle}>
          <View style={[styles.checkboxInner, todo.completed && styles.checkboxChecked]}>
            {todo.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        {/* Content */}
        <TouchableOpacity
          style={styles.content}
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.7}
          delayLongPress={400}
        >
          <View style={styles.titleRow}>
            {todo.carriedOverFrom && (
              <Text style={styles.carriedOverArrow}>↩</Text>
            )}
            {categoryInfo && (
              <View style={[styles.categoryDot, { backgroundColor: categoryInfo.color }]} />
            )}
            <Text
              style={[styles.title, todo.completed && styles.titleCompleted]}
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
              <Text style={styles.metaText}>{subtasksDone}/{subtasks.length}</Text>
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
    prev.todo.carriedOverFrom === next.todo.carriedOverFrom &&
    prev.todo.recurrence?.type === next.todo.recurrence?.type &&
    prev.todo.timeTracking?.startedAt === next.todo.timeTracking?.startedAt &&
    prev.todo.timeTracking?.totalSeconds === next.todo.timeTracking?.totalSeconds
  );
});

export default TodoItem;

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: Colors.dark.error,
    borderRadius: 0,
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
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  checkbox: {
    padding: 2,
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
  carriedOverArrow: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
    opacity: 0.6,
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
  },
  metaText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
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
  // Time tracking
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
