import { useState, memo, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
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
  const { colors } = useTheme();
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

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.lg,
      paddingBottom: Spacing.xxl,
      maxHeight: '85%',
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
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
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    taskTitle: {
      color: colors.text,
      fontFamily: Fonts.headingMedium,
      fontSize: 20,
      marginBottom: Spacing.xs,
    },
    titleInput: {
      color: colors.text,
      fontFamily: Fonts.headingMedium,
      fontSize: 20,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    createdDate: {
      color: colors.textTertiary,
      fontFamily: Fonts.accentItalic,
      fontSize: 12,
      marginBottom: Spacing.lg,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.headingMedium,
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    notesInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 80,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipTextActive: {
      color: colors.background,
    },
    dayChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    dayChipText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    dayChipTextActive: {
      color: colors.background,
    },
    subtaskCheck: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.textTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtaskCheckDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    subtaskCheckmark: {
      color: colors.background,
      fontSize: 11,
      fontWeight: '700',
    },
    subtaskText: {
      flex: 1,
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 14,
    },
    subtaskTextDone: {
      textDecorationLine: 'line-through',
      color: colors.textTertiary,
    },
    subtaskDelete: {
      color: colors.textTertiary,
      fontSize: 12,
      padding: 4,
    },
    addSubtaskIcon: {
      color: colors.textSecondary,
      fontSize: 16,
      width: 24,
      textAlign: 'center',
    },
    addSubtaskText: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 14,
    },
    editInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
    },
    saveBtnText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 14,
    },
    pomodoroBtn: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    pomodoroBtnText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 15,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: Spacing.sm,
    },
    actionIcon: {
      color: colors.textSecondary,
      fontSize: 16,
      width: 24,
      textAlign: 'center',
    },
    actionText: {
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 15,
    },
  }), [colors]);

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
              <View style={staticStyles.titleEditRow}>
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
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />

            {/* Priority */}
            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={staticStyles.chipRow}>
              {([null, 'low', 'medium', 'high'] as Priority[]).map(p => {
                const isActive = todo.priority === p;
                const color = p ? PRIORITY_CONFIG[p].color : colors.textTertiary;
                return (
                  <TouchableOpacity
                    key={String(p)}
                    style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
                    onPress={() => handlePriority(p)}
                  >
                    <Text style={[styles.chipText, isActive && { color: colors.background }]}>
                      {p ? PRIORITY_CONFIG[p].label : 'None'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={staticStyles.catScroll}>
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
                  <Text style={[styles.chipText, todo.category === c.key && { color: colors.background }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Recurrence */}
            <Text style={styles.sectionLabel}>Recurring</Text>
            <View style={staticStyles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !todo.recurrence && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onUpdate(todo.id, { recurrence: undefined });
                }}
              >
                <Text style={[styles.chipText, !todo.recurrence && { color: colors.background }]}>None</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, todo.recurrence?.type === 'daily' && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onUpdate(todo.id, { recurrence: { type: 'daily' } });
                }}
              >
                <Text style={[styles.chipText, todo.recurrence?.type === 'daily' && { color: colors.background }]}>Daily</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const dayOfWeek = new Date().getDay();
                  onUpdate(todo.id, { recurrence: { type: 'custom', days: todo.recurrence?.days || [dayOfWeek] } });
                }}
              >
                <Text style={[styles.chipText, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && { color: colors.background }]}>Custom</Text>
              </TouchableOpacity>
            </View>
            {/* Day picker for custom recurrence */}
            {(todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && (
              <View style={staticStyles.dayPickerRow}>
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
              <View style={staticStyles.subtaskList}>
                {subtasks.map(s => (
                  <View key={s.id} style={staticStyles.subtaskRow}>
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
              <View style={staticStyles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={subtaskTitle}
                  onChangeText={setSubtaskTitle}
                  placeholder="Subtask title"
                  placeholderTextColor={colors.textTertiary}

                  onSubmitEditing={handleAddSubtask}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddSubtask}>
                  <Text style={styles.saveBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={staticStyles.addSubtaskBtn}
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
              style={[styles.actionRow, staticStyles.deleteRow]}
              onPress={handleDelete}
              accessibilityLabel="Delete task"
              accessibilityRole="button"
            >
              <Text style={[styles.actionIcon, { color: colors.error }]}>✕</Text>
              <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
  titleEditRow: {
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  addSubtaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  deleteRow: {
    borderTopWidth: 0,
    marginTop: 0,
  },
});

const TaskDetail = memo(TaskDetailInner);
export default TaskDetail;
