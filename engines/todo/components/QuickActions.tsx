import { useState, memo, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, LayoutAnimation } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
import { Todo, Priority, Category, CATEGORIES, PRIORITY_CONFIG } from '../types';
import { getLogicalDate } from '../../../lib/date-utils';
import { useTodoStore } from '../store';
import { CalendarPicker } from '../../../components/today/CalendarPicker';

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
}

function QuickActionsInner({ todo, visible, onClose, onUpdate, onDelete }: Props) {
  const { colors } = useTheme();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const allTodos = useTodoStore(s => s.todos);

  useEffect(() => {
    setTitle(todo.title);
  }, [todo.title]);

  const today = useMemo(() => getLogicalDate(), []);

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

  const handleScheduleDate = (dateStr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate(todo.id, { logicalDate: dateStr });
    setShowDatePicker(false);
    onClose();
  };

  const handleRecurrence = (type: 'none' | 'daily' | 'custom') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'none') {
      onUpdate(todo.id, { recurrence: undefined });
    } else if (type === 'daily') {
      onUpdate(todo.id, { recurrence: { type: 'daily' } });
    } else {
      const dayOfWeek = new Date().getDay();
      onUpdate(todo.id, { recurrence: { type: 'custom', days: todo.recurrence?.days || [dayOfWeek] } });
    }
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDelete(todo.id);
    onClose();
  };

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
      maxHeight: '75%',
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
      fontSize: 16,
      marginBottom: Spacing.md,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.headingMedium,
      fontSize: 13,
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.background,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionText: {
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 15,
      flex: 1,
    },
    actionMeta: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 12,
      maxWidth: '40%',
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
    datePickerSection: {
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={styles.taskTitle} numberOfLines={2}>{todo.title}</Text>

            {/* Edit title */}
            {editingTitle ? (
              <View style={staticStyles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={title}
                  onChangeText={setTitle}
                  onSubmitEditing={handleSaveTitle}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTitle}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.actionRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditingTitle(true); }}>
                <Text style={staticStyles.actionIcon}>✏️</Text>
                <Text style={styles.actionText}>Edit</Text>
                <Text style={styles.actionMeta} numberOfLines={1}>{todo.title}</Text>
              </TouchableOpacity>
            )}

            {/* Priority */}
            <Text style={styles.sectionLabel}>PRIORITY</Text>
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
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={staticStyles.catScrollOuter}>
              <View style={staticStyles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !todo.category && styles.chipActive]}
                  onPress={() => handleCategory(null)}
                >
                  <Text style={[styles.chipText, !todo.category && styles.chipTextActive]}>None</Text>
                </TouchableOpacity>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, todo.category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                    onPress={() => handleCategory(c.key)}
                  >
                    <Text style={[styles.chipText, todo.category === c.key && { color: colors.background }]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Recurrence */}
            <Text style={styles.sectionLabel}>RECURRENCE</Text>
            <View style={staticStyles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !todo.recurrence && styles.chipActive]}
                onPress={() => handleRecurrence('none')}
              >
                <Text style={[styles.chipText, !todo.recurrence && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, todo.recurrence?.type === 'daily' && styles.chipActive]}
                onPress={() => handleRecurrence('daily')}
              >
                <Text style={[styles.chipText, todo.recurrence?.type === 'daily' && styles.chipTextActive]}>🔁 Daily</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && styles.chipActive]}
                onPress={() => handleRecurrence('custom')}
              >
                <Text style={[styles.chipText, (todo.recurrence?.type === 'weekly' || todo.recurrence?.type === 'custom') && styles.chipTextActive]}>📅 Custom</Text>
              </TouchableOpacity>
            </View>
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

            {/* Schedule for date */}
            <TouchableOpacity style={styles.actionRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowDatePicker(true); }}>
              <Text style={staticStyles.actionIcon}>📆</Text>
              <Text style={styles.actionText}>Schedule for date</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <CalendarPicker
                selectedDate={todo.logicalDate}
                allTodos={allTodos}
                onSelectDate={(dateStr) => {
                  handleScheduleDate(dateStr);
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}

            {/* Move to tomorrow */}
            <TouchableOpacity style={styles.actionRow} onPress={handleMoveToTomorrow}>
              <Text style={staticStyles.actionIcon}>➡️</Text>
              <Text style={styles.actionText}>Move to tomorrow</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={[styles.actionRow, staticStyles.deleteRow]} onPress={handleDelete}>
              <Text style={staticStyles.actionIcon}>🗑️</Text>
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
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  catScrollOuter: {
    flexGrow: 0,
  },
  actionIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  dayPickerRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
});

const QuickActions = memo(QuickActionsInner);
export default QuickActions;
