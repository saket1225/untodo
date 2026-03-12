import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated as RNAnimated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, formatDisplayDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import QuickActions from '../../engines/todo/components/QuickActions';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Todo, Category, CATEGORIES, Priority } from '../../engines/todo/types';

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
  const updateTodo = useTodoStore(s => s.updateTodo);
  const carryOverTodos = useTodoStore(s => s.carryOverTodos);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  // All today's todos (sorted by priority in store)
  const todayTodos = useMemo(() => {
    const today = allTodos.filter(t => t.logicalDate === logicalDate);
    // Sort: incomplete first, then by priority (high>med>low>none), then order
    return [...today].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
      const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  }, [allTodos, logicalDate]);

  // Filtered by category
  const todos = useMemo(() => {
    if (activeCategory === 'all') return todayTodos;
    return todayTodos.filter(t => t.category === activeCategory);
  }, [todayTodos, activeCategory]);

  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);
  const [quickActionTodo, setQuickActionTodo] = useState<Todo | null>(null);
  const [showCarryOver, setShowCarryOver] = useState(false);
  const [checkedCarryOver, setCheckedCarryOver] = useState(false);

  // Progress bar animation
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const completed = todayTodos.filter(t => t.completed).length;
  const total = todayTodos.length;
  const progress = total > 0 ? completed / total : 0;

  useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Total pomodoro minutes for today
  const totalPomodoroMinutes = useMemo(
    () => todayTodos.reduce((s, t) => s + (t.pomodoroMinutesLogged || 0), 0),
    [todayTodos]
  );

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
    const alreadyCarried = todayTodos.some(t => t.carriedOverFrom);
    if (yesterdayIncomplete.length > 0 && !alreadyCarried) {
      setShowCarryOver(true);
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTodo(id);
  }, [toggleTodo]);

  const handleAdd = useCallback((title: string, priority?: Priority, category?: Category) => {
    addTodo(title, priority ?? null, category ?? null);
  }, [addTodo]);

  const greeting = useMemo(() => getDailyGreeting(), [logicalDate]);

  // Carry-over candidates count
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);
  const carryOverCount = useMemo(
    () => allTodos.filter(t => t.logicalDate === yesterdayStr && !t.completed).length,
    [allTodos, yesterdayStr]
  );

  // Categories that exist in today's tasks
  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    todayTodos.forEach(t => { if (t.category) cats.add(t.category); });
    return CATEGORIES.filter(c => cats.has(c.key!));
  }, [todayTodos]);

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <TodoItem
      todo={item}
      onToggle={() => handleToggle(item.id)}
      onDelete={() => deleteTodo(item.id)}
      onPress={() => setPomodoroTodo(item)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setQuickActionTodo(item);
      }}
    />
  ), [handleToggle, deleteTodo]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{formatDisplayDate(logicalDate)}</Text>
        </View>
        <View style={styles.headerRight}>
          {totalPomodoroMinutes > 0 && (
            <Text style={styles.pomodoroTotal}>⏱ {totalPomodoroMinutes}m</Text>
          )}
          <Text style={styles.countText}>
            {completed}/{total} done
          </Text>
        </View>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>{greeting}</Text>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressBar}>
          <RNAnimated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      )}

      {/* Category filter chips */}
      {activeCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}
            onPress={() => setActiveCategory('all')}
          >
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {activeCats.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.filterChip,
                activeCategory === c.key && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => setActiveCategory(activeCategory === c.key ? 'all' : c.key)}
            >
              <Text style={[
                styles.filterChipText,
                activeCategory === c.key && { color: Colors.dark.background },
              ]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <TodoInput onAdd={handleAdd} />

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

      {/* Quick actions */}
      {quickActionTodo && (
        <QuickActions
          todo={quickActionTodo}
          visible={!!quickActionTodo}
          onClose={() => setQuickActionTodo(null)}
          onUpdate={updateTodo}
          onDelete={(id) => { deleteTodo(id); setQuickActionTodo(null); }}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.md,
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
  pomodoroTotal: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 13,
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
  filterScroll: {
    maxHeight: 40,
    marginTop: Spacing.sm,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  filterChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.dark.background,
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
