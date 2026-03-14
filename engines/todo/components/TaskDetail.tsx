import { useState, memo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo, Priority, Category, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
  onStartPomodoro: (todo: Todo) => void;
}

function TaskDetailInner({ todo, visible, onClose, onUpdate, onDelete, onStartPomodoro }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [noteText, setNoteText] = useState(todo.notes || '');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  useEffect(() => {
    setTitle(todo.title);
  }, [todo.title]);

  useEffect(() => {
    setNoteText(todo.notes || '');
  }, [todo.notes]);

  const addSubtask = useTodoStore(s => s.addSubtask);
  const toggleSubtask = useTodoStore(s => s.toggleSubtask);
  const deleteSubtask = useTodoStore(s => s.deleteSubtask);

  const handleSaveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== todo.title) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdate(todo.id, { title: trimmed });
    }
    setEditingTitle(false);
  };

  const handleSaveNote = () => {
    if (noteText !== (todo.notes || '')) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdate(todo.id, { notes: noteText });
    }
  };

  const handlePriority = (p: Priority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { priority: p });
  };

  const handleCategory = (c: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { category: c });
  };

  const handleAddSubtask = () => {
    const trimmed = subtaskTitle.trim();
    if (trimmed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addSubtask(todo.id, trimmed);
      setSubtaskTitle('');
    }
    setAddingSubtask(false);
  };

  const handleMoveToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    onUpdate(todo.id, { logicalDate: tomorrowStr });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(todo.id);
  };

  const subtasks = todo.subtasks || [];
  const subtasksDone = subtasks.filter(s => s.completed).length;

  const createdDate = (() => {
    try {
      return format(new Date(todo.createdAt), 'MMM d, yyyy \'at\' h:mm a');
    } catch {
      return todo.createdAt;
    }
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Title */}
            {editingTitle ? (
              <View style={styles.titleEditRow}>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}

                  onSubmitEditing={handleSaveTitle}
                  onBlur={handleSaveTitle}
                  returnKeyType="done"
                  accessibilityLabel="Edit task title"
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTitle(todo.title);
                  setEditingTitle(true);
                }}
                activeOpacity={0.7}
                accessibilityLabel="Edit task title"
                accessibilityRole="button"
              >
                <Text style={styles.taskTitle} numberOfLines={3}>{todo.title}</Text>
              </TouchableOpacity>
            )}

            {/* Created date */}
            <Text style={styles.createdDate}>Created {createdDate}</Text>

            {/* Notes */}
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={noteText}
              onChangeText={setNoteText}
              onBlur={handleSaveNote}
              placeholder="Add notes..."
              placeholderTextColor={Colors.dark.textTertiary}
              multiline
              textAlignVertical="top"
            />

            {/* Priority */}
            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {([null, 'low', 'medium', 'high'] as Priority[]).map(p => {
                const isActive = todo.priority === p;
                const color = p ? PRIORITY_CONFIG[p].color : Colors.dark.textTertiary;
                return (
                  <TouchableOpacity
                    key={String(p)}
                    style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
                    onPress={() => handlePriority(p)}
                  >
                    <Text style={[styles.chipText, isActive && { color: Colors.dark.background }]}>
                      {p ? PRIORITY_CONFIG[p].label : 'None'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              <TouchableOpacity
                style={[styles.chip, !todo.category && styles.chipActive]}
                onPress={() => handleCategory(null)}
              >
                <Text style={[styles.chipText, !todo.category && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, todo.category === c.key && { backgroundColor: c.color, borderColor: c.color }, { marginLeft: Spacing.sm }]}
                  onPress={() => handleCategory(c.key)}
                >
                  <Text style={[styles.chipText, todo.category === c.key && { color: Colors.dark.background }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Recurrence */}
            <Text style={styles.sectionLabel}>Recurring</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !todo.recurrence && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onUpdate(todo.id, { recurrence: undefined });
                }}
              >
                <Text style={[styles.chipText, !todo.recurrence && { color: Colors.dark.background }]}>None</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, todo.recurrence?.type === 'daily' && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onUpdate(todo.id, { recurrence: { type: 'daily' } });
                }}
              >
                <Text style={[styles.chipText, todo.recurrence?.type === 'daily' && { color: Colors.dark.background }]}>Daily</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const dayOfWeek = new Date().getDay();
                  onUpdate(todo.id, { recurrence: { type: 'custom', days: todo.recurrence?.days || [dayOfWeek] } });
                }}
              >
                <Text style={[styles.chipText, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && { color: Colors.dark.background }]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {/* Day picker for custom recurrence */}
            {(todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && (
              <View style={styles.dayPickerRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => {
                  const isSelected = (todo.recurrence?.days || []).includes(idx);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dayChip, isSelected && styles.dayChipActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const currentDays = todo.recurrence?.days || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== idx)
                          : [...currentDays, idx];
                        if (newDays.length > 0) {
                          onUpdate(todo.id, { recurrence: { type: 'custom', days: newDays } });
                        }
                      }}
                    >
                      <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Subtasks */}
            <Text style={styles.sectionLabel}>
              Subtasks{subtasks.length > 0 ? ` (${subtasksDone}/${subtasks.length})` : ''}
            </Text>
            {subtasks.length > 0 && (
              <View style={styles.subtaskList}>
                {subtasks.map(s => (
                  <View key={s.id} style={styles.subtaskRow}>
                    <TouchableOpacity
                      onPress={() => toggleSubtask(todo.id, s.id)}
                      accessibilityLabel={s.completed ? `Mark "${s.title}" incomplete` : `Complete "${s.title}"`}
                      accessibilityRole="checkbox"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <View style={[styles.subtaskCheck, s.completed && styles.subtaskCheckDone]}>
                        {s.completed && <Text style={styles.subtaskCheckmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.subtaskText, s.completed && styles.subtaskTextDone]} numberOfLines={2}>{s.title}</Text>
                    <TouchableOpacity
                      onPress={() => deleteSubtask(todo.id, s.id)}
                      accessibilityLabel={`Delete subtask "${s.title}"`}
                      accessibilityRole="button"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.subtaskDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {addingSubtask ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={subtaskTitle}
                  onChangeText={setSubtaskTitle}
                  placeholder="Subtask title"
                  placeholderTextColor={Colors.dark.textTertiary}

                  onSubmitEditing={handleAddSubtask}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddSubtask}>
                  <Text style={styles.saveBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addSubtaskBtn}
                onPress={() => setAddingSubtask(true)}
                accessibilityLabel="Add subtask"
                accessibilityRole="button"
              >
                <Text style={styles.addSubtaskIcon}>+</Text>
                <Text style={styles.addSubtaskText}>Add subtask</Text>
              </TouchableOpacity>
            )}

            {/* Start Pomodoro */}
            <TouchableOpacity
              style={styles.pomodoroBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStartPomodoro(todo);
              }}
              accessibilityLabel="Start Pomodoro timer"
              accessibilityRole="button"
            >
              <Text style={styles.pomodoroBtnText}>Start Pomodoro</Text>
            </TouchableOpacity>

            {/* Move to tomorrow */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleMoveToTomorrow}
              accessibilityLabel="Move task to tomorrow"
              accessibilityRole="button"
            >
              <Text style={styles.actionIcon}>→</Text>
              <Text style={styles.actionText}>Move to tomorrow</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={[styles.actionRow, styles.deleteRow]}
              onPress={handleDelete}
              accessibilityLabel="Delete task"
              accessibilityRole="button"
            >
              <Text style={[styles.actionIcon, { color: Colors.dark.error }]}>✕</Text>
              <Text style={[styles.actionText, { color: Colors.dark.error }]}>Delete</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.dark.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  taskTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  titleEditRow: {
    marginBottom: Spacing.xs,
  },
  titleInput: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 20,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  createdDate: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 12,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  notesInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minHeight: 80,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  chipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  chipTextActive: {
    color: Colors.dark.background,
  },
  catScroll: {
    flexGrow: 0,
  },
  dayPickerRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  dayChipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  dayChipTextActive: {
    color: Colors.dark.background,
  },
  subtaskList: {
    marginBottom: Spacing.xs,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingLeft: 4,
  },
  subtaskCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtaskCheckDone: {
    backgroundColor: Colors.dark.success,
    borderColor: Colors.dark.success,
  },
  subtaskCheckmark: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '700',
  },
  subtaskText: {
    flex: 1,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  subtaskTextDone: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  subtaskDelete: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    padding: 4,
  },
  addSubtaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
  },
  addSubtaskIcon: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  addSubtaskText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  saveBtn: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  pomodoroBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  pomodoroBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginTop: Spacing.sm,
  },
  actionIcon: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  actionText: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  deleteRow: {
    borderTopWidth: 0,
    marginTop: 0,
  },
});

const TaskDetail = memo(TaskDetailInner);
export default TaskDetail;
