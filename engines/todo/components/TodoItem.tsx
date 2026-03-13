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
    // Stop tracking if completing
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
  const hasNotes = !!(todo.notes && todo.notes.trim());

  return (
    <View style={styles.wrapper}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Delete</Text>
      </View>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateX }, { scale: scaleAnim }] },
          priorityColor && { borderLeftWidth: 3, borderLeftColor: priorityColor },
          isTracking && { borderColor: Colors.dark.timer, borderWidth: 1 },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity style={styles.checkbox} onPress={handleToggle}>
          <View style={[styles.checkboxInner, todo.completed && styles.checkboxChecked]}>
            {todo.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.content}
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.7}
          delayLongPress={400}
        >
          <View style={styles.titleRow}>
            {todo.carriedOverFrom && (
              <Text style={styles.carriedOverArrow}>↩ </Text>
            )}
            <Text
              style={[styles.title, todo.completed && styles.titleCompleted]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {todo.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            {todo.carriedOverFrom && (
              <Text style={styles.carriedOver}>carried over</Text>
            )}
            {todo.recurrence && (
              <Text style={styles.recurringIcon}>↻</Text>
            )}
            {categoryInfo && (
              <View style={[styles.categoryChip, { backgroundColor: categoryInfo.color + '22', borderColor: categoryInfo.color + '44' }]}>
                <Text style={[styles.categoryChipText, { color: categoryInfo.color }]}>
                  {categoryInfo.label}
                </Text>
              </View>
            )}
            {subtasks.length > 0 && (
              <View style={styles.subtaskMeta}>
                <Text style={styles.subtaskText}>{subtasksDone}/{subtasks.length}</Text>
              </View>
            )}
            {hasNotes && (
              <Text style={styles.noteIcon}>📝</Text>
            )}
            {pomodoroMins > 0 && (
              <View style={styles.pomodoroMeta}>
                <Text style={styles.pomodoroIcon}>⏱</Text>
                <Text style={styles.pomodoroText}>{pomodoroMins}m</Text>
              </View>
            )}
            {(isTracking || totalSeconds > 0) && (
              <View style={styles.trackingMeta}>
                {isTracking ? (
                  <LiveTimer startedAt={todo.timeTracking!.startedAt!} baseSeconds={totalSeconds} />
                ) : (
                  <Text style={styles.trackingTimeIdle}>{formatTrackingTime(totalSeconds)}</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
        {/* Time tracking play/pause */}
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
        {todo.estimatedMinutes != null && todo.estimatedMinutes > 0 && (
          <Text style={styles.estimate}>{todo.estimatedMinutes}m</Text>
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
    marginBottom: Spacing.sm,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: Colors.dark.error,
    borderRadius: 12,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  checkbox: {
    padding: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
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
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carriedOverArrow: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  recurringIcon: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  carriedOver: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    fontFamily: Fonts.body,
    fontSize: 10,
  },
  subtaskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  subtaskText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 10,
  },
  noteIcon: {
    fontSize: 10,
  },
  pomodoroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pomodoroIcon: {
    fontSize: 10,
  },
  pomodoroText: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  estimate: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  // Time tracking
  trackingBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingBtnActive: {
    backgroundColor: Colors.dark.timer + '22',
    borderColor: Colors.dark.timer,
  },
  trackingBtnText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
  trackingBtnTextActive: {
    color: Colors.dark.timer,
  },
  trackingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
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
