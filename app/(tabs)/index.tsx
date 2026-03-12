import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, formatDisplayDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Todo } from '../../engines/todo/types';

const GREETINGS = [
  'What will you conquer today?',
  'Make today count.',
  'One task at a time.',
  'Less planning, more doing.',
  'Focus on what matters.',
  'Small steps, big results.',
  'Today is yours.',
  'Build momentum.',
  'Ship something today.',
  'Stay locked in.',
  'Discipline is freedom.',
  'Do the hard thing first.',
  'Progress over perfection.',
  'Consistency beats intensity.',
];

function getDailyGreeting(): string {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return GREETINGS[dayOfYear % GREETINGS.length];
}

function TodayScreenContent() {
  const logicalDate = getLogicalDate();
  const allTodos = useTodoStore(s => s.todos);
  const addTodo = useTodoStore(s => s.addTodo);
  const toggleTodo = useTodoStore(s => s.toggleTodo);
  const deleteTodo = useTodoStore(s => s.deleteTodo);
  const carryOverTodos = useTodoStore(s => s.carryOverTodos);
  const todos = useMemo(() =>
    allTodos.filter(t => t.logicalDate === logicalDate).sort((a, b) => a.order - b.order),
    [allTodos, logicalDate]
  );
  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [checkedCarryOver, setCheckedCarryOver] = useState(false);

  // Check for carry-over tasks on mount
  useEffect(() => {
    if (checkedCarryOver) return;
    setCheckedCarryOver(true);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayTodos = allTodos.filter(t => t.logicalDate === logicalDate);
    const yesterdayIncomplete = allTodos.filter(
      t => t.logicalDate === yesterdayStr && !t.completed
    );
    // Only show if there are incomplete tasks from yesterday and no carried-over tasks today yet
    const alreadyCarried = todayTodos.some(t => t.carriedOverFrom);
    if (yesterdayIncomplete.length > 0 && !alreadyCarried) {
      setShowCarryOver(true);
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo(id);
  }, [toggleTodo]);

  const completed = todos.filter(t => t.completed).length;
  const total = todos.length;
  const progress = total > 0 ? completed / total : 0;
  const greeting = useMemo(() => getDailyGreeting(), [logicalDate]);

  // Count carry-over candidates
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const carryOverCount = useMemo(
    () => allTodos.filter(t => t.logicalDate === yesterdayStr && !t.completed).length,
    [allTodos, yesterdayStr]
  );

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <TodoItem
      todo={item}
      onToggle={() => handleToggle(item.id)}
      onDelete={() => deleteTodo(item.id)}
      onPress={() => setPomodoroTodo(item)}
    />
  ), [handleToggle, deleteTodo]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatDisplayDate(logicalDate)}</Text>
        <Text style={styles.countText}>
          {completed}/{total} done
        </Text>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>{greeting}</Text>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {/* Input */}
      <TodoInput onAdd={addTodo} />

      {/* Todo list */}
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>+</Text>
            <Text style={styles.emptyText}>Your day is a blank canvas</Text>
            <Text style={styles.emptySubtext}>Add your first task above to get started</Text>
          </View>
        }
      />

      {/* Carry-over modal */}
      {showCarryOver && (
        <Modal visible={showCarryOver} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Unfinished Business</Text>
              <Text style={styles.modalText}>
                You have {carryOverCount} unfinished task{carryOverCount !== 1 ? 's' : ''} from yesterday.
              </Text>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  carryOverTodos();
                  setShowCarryOver(false);
                }}
              >
                <Text style={styles.modalPrimaryBtnText}>Carry Over All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setShowCarryOver(false)}
              >
                <Text style={styles.modalSecondaryBtnText}>Start Fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Pomodoro modal */}
      {pomodoroTodo && (
        <PomodoroTimer
          todo={pomodoroTodo}
          visible={!!pomodoroTodo}
          onClose={() => setPomodoroTodo(null)}
        />
      )}
    </SafeAreaView>
  );
}

export default function TodayScreen() {
  return (
    <ErrorBoundary>
      <TodayScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  dateText: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 28,
  },
  countText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  greeting: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.success,
    borderRadius: 2,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    color: Colors.dark.textTertiary,
    marginBottom: Spacing.md,
    fontFamily: Fonts.body,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
  },
  emptySubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  // Carry-over modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 20,
    marginBottom: Spacing.sm,
  },
  modalText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalPrimaryBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  modalPrimaryBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  modalSecondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
});
