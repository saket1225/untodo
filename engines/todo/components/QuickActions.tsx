import { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo, Priority, Category, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { useTodoStore } from '../store';

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
}

function QuickActionsInner({ todo, visible, onClose, onUpdate, onDelete }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimate, setEstimate] = useState(String(todo.estimatedMinutes || ''));
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(todo.notes || '');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [showSubtasks, setShowSubtasks] = useState(false);

  const addSubtask = useTodoStore(s => s.addSubtask);
  const toggleSubtask = useTodoStore(s => s.toggleSubtask);
  const deleteSubtask = useTodoStore(s => s.deleteSubtask);

  const handlePriority = (p: Priority) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { priority: p });
    onClose();
  };

  const handleCategory = (c: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { category: c });
    onClose();
  };

  const handleSaveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== todo.title) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdate(todo.id, { title: trimmed });
    }
    setEditingTitle(false);
    onClose();
  };

  const handleSaveEstimate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mins = parseInt(estimate);
    onUpdate(todo.id, { estimatedMinutes: mins > 0 ? mins : undefined });
    setEditingEstimate(false);
    onClose();
  };

  const handleSaveNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { notes: noteText });
    setEditingNote(false);
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

  const subtasks = todo.subtasks || [];
  const subtasksDone = subtasks.filter(s => s.completed).length;

  const handleMoveToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    onUpdate(todo.id, { logicalDate: tomorrowStr });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDelete(todo.id);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.taskTitle} numberOfLines={1}>{todo.title}</Text>

          {/* Edit title */}
          {editingTitle ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={title}
                onChangeText={setTitle}
                autoFocus
                onSubmitEditing={handleSaveTitle}
                returnKeyType="done"
                accessibilityLabel="Edit task title"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTitle} accessibilityLabel="Save title" accessibilityRole="button">
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditingTitle(true); }} accessibilityLabel="Edit title" accessibilityRole="button">
              <Text style={styles.actionIcon}>✎</Text>
              <Text style={styles.actionText}>Edit title</Text>
            </TouchableOpacity>
          )}

          {/* Priority */}
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {([null, 'low', 'medium', 'high'] as Priority[]).map(p => {
              const isActive = todo.priority === p;
              const color = p ? PRIORITY_CONFIG[p].color : Colors.dark.textTertiary;
              return (
                <TouchableOpacity
                  key={String(p)}
                  style={[styles.priorityChip, isActive && { backgroundColor: color, borderColor: color }]}
                  onPress={() => handlePriority(p)}
                >
                  <Text style={[styles.priorityChipText, isActive && { color: Colors.dark.background }]}>
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
              style={[styles.catChip, !todo.category && styles.catChipActive]}
              onPress={() => handleCategory(null)}
            >
              <Text style={[styles.catChipText, !todo.category && styles.catChipTextActive]}>None</Text>
            </TouchableOpacity>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, todo.category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => handleCategory(c.key)}
              >
                <Text style={[styles.catChipText, todo.category === c.key && { color: Colors.dark.background }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Estimated time */}
          {editingEstimate ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={estimate}
                onChangeText={setEstimate}
                keyboardType="number-pad"
                placeholder="minutes"
                placeholderTextColor={Colors.dark.textTertiary}
                autoFocus
                onSubmitEditing={handleSaveEstimate}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEstimate}>
                <Text style={styles.saveBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionRow} onPress={() => setEditingEstimate(true)}>
              <Text style={styles.actionIcon}>⏱</Text>
              <Text style={styles.actionText}>
                {todo.estimatedMinutes ? `Estimated: ${todo.estimatedMinutes}m` : 'Set estimated time'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Subtasks */}
          {subtasks.length > 0 && !showSubtasks && (
            <TouchableOpacity style={styles.actionRow} onPress={() => setShowSubtasks(true)}>
              <Text style={styles.actionIcon}>☐</Text>
              <Text style={styles.actionText}>Subtasks ({subtasksDone}/{subtasks.length})</Text>
            </TouchableOpacity>
          )}
          {showSubtasks && subtasks.length > 0 && (
            <View style={styles.subtaskList}>
              <Text style={styles.sectionLabel}>Subtasks</Text>
              {subtasks.map(s => (
                <View key={s.id} style={styles.subtaskRow}>
                  <TouchableOpacity onPress={() => toggleSubtask(todo.id, s.id)}>
                    <View style={[styles.subtaskCheck, s.completed && styles.subtaskCheckDone]}>
                      {s.completed && <Text style={styles.subtaskCheckmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.subtaskText, s.completed && styles.subtaskTextDone]}>{s.title}</Text>
                  <TouchableOpacity onPress={() => deleteSubtask(todo.id, s.id)}>
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
                autoFocus
                onSubmitEditing={handleAddSubtask}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddSubtask}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionRow} onPress={() => setAddingSubtask(true)}>
              <Text style={styles.actionIcon}>+</Text>
              <Text style={styles.actionText}>Add subtask</Text>
            </TouchableOpacity>
          )}

          {/* Notes */}
          {editingNote ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { minHeight: 60 }]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note..."
                placeholderTextColor={Colors.dark.textTertiary}
                autoFocus
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNote}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionRow} onPress={() => setEditingNote(true)}>
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={styles.actionText}>
                {todo.notes ? 'Edit note' : 'Add note'}
              </Text>
            </TouchableOpacity>
          )}
          {todo.notes && !editingNote ? (
            <Text style={styles.notePreview} numberOfLines={2}>{todo.notes}</Text>
          ) : null}

          {/* Make recurring */}
          <Text style={styles.sectionLabel}>Recurring</Text>
          <View style={styles.priorityRow}>
            <TouchableOpacity
              style={[styles.priorityChip, !todo.recurrence && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
              onPress={() => { onUpdate(todo.id, { recurrence: undefined }); }}
            >
              <Text style={[styles.priorityChipText, !todo.recurrence && { color: Colors.dark.background }]}>None</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityChip, todo.recurrence?.type === 'daily' && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onUpdate(todo.id, { recurrence: { type: 'daily' } });
              }}
            >
              <Text style={[styles.priorityChipText, todo.recurrence?.type === 'daily' && { color: Colors.dark.background }]}>Daily</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityChip, todo.recurrence?.type === 'weekly' && { backgroundColor: Colors.dark.accent, borderColor: Colors.dark.accent }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const dayOfWeek = new Date().getDay();
                onUpdate(todo.id, { recurrence: { type: 'weekly', days: [dayOfWeek] } });
              }}
            >
              <Text style={[styles.priorityChipText, todo.recurrence?.type === 'weekly' && { color: Colors.dark.background }]}>Weekly</Text>
            </TouchableOpacity>
          </View>

          {/* Move to tomorrow */}
          <TouchableOpacity style={styles.actionRow} onPress={handleMoveToTomorrow} accessibilityLabel="Move task to tomorrow" accessibilityRole="button">
            <Text style={styles.actionIcon}>→</Text>
            <Text style={styles.actionText}>Move to tomorrow</Text>
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity style={[styles.actionRow, styles.deleteRow]} onPress={handleDelete} accessibilityLabel="Delete task" accessibilityRole="button">
            <Text style={[styles.actionIcon, { color: Colors.dark.error }]}>✕</Text>
            <Text style={[styles.actionText, { color: Colors.dark.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '70%',
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
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  priorityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  priorityChipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  catScroll: {
    maxHeight: 40,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: Spacing.sm,
  },
  catChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  catChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  catChipTextActive: {
    color: Colors.dark.background,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
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
    borderBottomWidth: 0,
    marginTop: Spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  saveBtn: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  subtaskList: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
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
  notePreview: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    paddingHorizontal: 4,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
});

const QuickActions = memo(QuickActionsInner);
export default QuickActions;
