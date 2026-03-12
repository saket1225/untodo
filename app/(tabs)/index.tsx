import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { getLogicalDate, formatDisplayDate } from '../../lib/date-utils';
import { useTodoStore } from '../../engines/todo/store';
import TodoInput from '../../engines/todo/components/TodoInput';
import TodoItem from '../../engines/todo/components/TodoItem';
import PomodoroTimer from '../../engines/todo/components/PomodoroTimer';
import { Todo } from '../../engines/todo/types';

export default function TodayScreen() {
  const logicalDate = getLogicalDate();
  const todos = useTodoStore(s => s.todos.filter(t => t.logicalDate === logicalDate).sort((a, b) => a.order - b.order));
  const addTodo = useTodoStore(s => s.addTodo);
  const toggleTodo = useTodoStore(s => s.toggleTodo);
  const deleteTodo = useTodoStore(s => s.deleteTodo);
  const [pomodoroTodo, setPomodoroTodo] = useState<Todo | null>(null);

  const completed = todos.filter(t => t.completed).length;
  const total = todos.length;
  const progress = total > 0 ? completed / total : 0;

  const renderItem = useCallback(({ item }: { item: Todo }) => (
    <TodoItem
      todo={item}
      onToggle={() => toggleTodo(item.id)}
      onDelete={() => deleteTodo(item.id)}
      onPress={() => setPomodoroTodo(item)}
    />
  ), [toggleTodo, deleteTodo]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatDisplayDate(logicalDate)}</Text>
        <Text style={styles.countText}>
          {completed}/{total} done
        </Text>
      </View>

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
            <Text style={styles.emptyIcon}>○</Text>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>Add something to get started</Text>
          </View>
        }
      />

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
    paddingBottom: Spacing.sm,
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
});
