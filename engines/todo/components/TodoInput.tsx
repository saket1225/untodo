import { useState, useRef, useEffect, memo, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, Animated, Modal, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Priority, Category, CATEGORIES, PRIORITY_CONFIG, Recurrence } from '../types';
import { useTemplateStore, TaskTemplate, TemplateTask } from '../templates';
import { useTodoStore } from '../store';
import { getLogicalDate } from '../../../lib/date-utils';

interface Props {
  onAdd: (title: string, priority?: Priority, category?: Category, recurrence?: Recurrence, date?: string) => void;
  autoFocus?: boolean;
  viewingDate?: string;
}

const PRIORITY_CYCLE: (Priority)[] = [null, 'low', 'medium', 'high'];

function TodoInputInner({ onAdd, autoFocus, viewingDate }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>(null);
  const [category, setCategory] = useState<Category>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const hasAutoFocused = useRef(false);
  const getAllTemplates = useTemplateStore(s => s.getAllTemplates);
  const addCustomTemplate = useTemplateStore(s => s.addCustomTemplate);
  const deleteTemplate = useTemplateStore(s => s.deleteTemplate);
  const allTodos = useTodoStore(s => s.todos);

  const today = useMemo(() => getLogicalDate(), []);
  const dateLabel = useMemo(() => {
    if (!scheduledDate) return undefined;
    if (scheduledDate === today) return undefined;
    const todayDate = new Date(today + 'T12:00:00');
    const tmrw = format(addDays(todayDate, 1), 'yyyy-MM-dd');
    if (scheduledDate === tmrw) return 'Tomorrow';
    return format(new Date(scheduledDate + 'T12:00:00'), 'MMM d');
  }, [scheduledDate, today]);

  useEffect(() => {
    if (autoFocus && !hasAutoFocused.current) {
      hasAutoFocused.current = true;
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [autoFocus]);

  // Quick-add shortcut: parse ! and #category from text
  const parseShortcuts = (raw: string): { title: string; quickPriority: Priority; quickCategory: Category } => {
    let title = raw.trim();
    let quickPriority: Priority = priority;
    let quickCategory: Category = category;

    // ! at start = high priority
    if (title.startsWith('!')) {
      quickPriority = 'high';
      title = title.slice(1).trim();
    }

    // #category anywhere
    const categoryMap: Record<string, Category> = {
      work: 'work', personal: 'personal', health: 'health',
      learning: 'learning', finance: 'finance', creative: 'creative',
      gym: 'health', fit: 'health', exercise: 'health',
      study: 'learning', read: 'learning', money: 'finance',
    };
    const hashMatch = title.match(/#(\w+)/);
    if (hashMatch) {
      const tag = hashMatch[1].toLowerCase();
      if (categoryMap[tag]) {
        quickCategory = categoryMap[tag];
        title = title.replace(hashMatch[0], '').trim();
      }
    }

    return { title, quickPriority, quickCategory };
  };

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { title, quickPriority, quickCategory } = parseShortcuts(trimmed);
    if (!title) return;
    onAdd(title, quickPriority, quickCategory, recurrence, scheduledDate);
    setText('');
    setPriority(null);
    setCategory(null);
    setRecurrence(undefined);
    setScheduledDate(undefined);
    setShowDatePicker(false);
    setShowCategories(false);
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    inputRef.current?.focus();
  };

  const cyclePriority = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = PRIORITY_CYCLE.indexOf(priority);
    setPriority(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
  };

  const handleApplyTemplate = (template: TaskTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    template.tasks.forEach(task => {
      onAdd(task.title, task.priority, task.category);
    });
    setShowTemplates(false);
  };

  const handleSaveAsTemplate = () => {
    const date = viewingDate || getLogicalDate();
    const dayTodos = allTodos.filter(t => t.logicalDate === date && !t.completed);
    if (dayTodos.length === 0) {
      Alert.alert('No Tasks', 'Add some tasks first to save as a template.');
      return;
    }
    Alert.prompt(
      'Save as Template',
      'Enter a name for this template:',
      (name) => {
        if (!name?.trim()) return;
        const tasks: TemplateTask[] = dayTodos.map(t => ({
          title: t.title,
          priority: t.priority,
          category: t.category,
        }));
        addCustomTemplate(name.trim(), tasks);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      'plain-text',
      '',
      'default'
    );
  };

  const priorityLabel = priority ? PRIORITY_CONFIG[priority].label : '—';
  const priorityColor = priority ? PRIORITY_CONFIG[priority].color : Colors.dark.textTertiary;
  const selectedCat = CATEGORIES.find(c => c.key === category);
  const templates = getAllTemplates();

  return (
    <View>
      <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />
      {/* Main input row - always clean: just input + add button */}
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          style={[styles.input, isFocused && styles.inputFocused]}
          placeholder="Add a task..."
          placeholderTextColor={Colors.dark.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleAdd}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { if (!text.trim()) setIsFocused(false); }}
          returnKeyType="done"
          accessibilityLabel="Task title"
          accessibilityHint="Type a task name and press done to add"
        />

        <TouchableOpacity
          style={[styles.addButton, !text.trim() && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!text.trim()}
          accessibilityLabel="Add task"
          accessibilityRole="button"
          accessibilityState={{ disabled: !text.trim() }}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar row - appears below input when focused */}
      {isFocused && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.priorityBtn}
            onPress={cyclePriority}
            accessibilityLabel={`Priority: ${priorityLabel}`}
            accessibilityRole="button"
            accessibilityHint="Cycle through priority levels"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[styles.priorityText, { color: priorityColor }]}>{priorityLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.repeatBtn, recurrence && styles.repeatBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setRecurrence(prev => prev ? undefined : { type: 'daily' });
            }}
            accessibilityLabel={recurrence ? `Recurring: ${recurrence.type}` : 'Set recurring'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.repeatBtnText, recurrence && styles.repeatBtnTextActive]}>↻</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.catBtn, selectedCat && { borderColor: selectedCat.color }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCategories(!showCategories);
            }}
            accessibilityLabel={`Category: ${selectedCat ? selectedCat.label : 'None'}`}
            accessibilityRole="button"
            accessibilityHint="Open category picker"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.catBtnText, selectedCat && { color: selectedCat.color }]}>
              {selectedCat ? selectedCat.label.charAt(0) : '#'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, scheduledDate && styles.dateBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker(!showDatePicker);
            }}
            accessibilityLabel={dateLabel ? `Scheduled for ${dateLabel}` : 'Schedule for a date'}
            accessibilityRole="button"
            accessibilityHint="Open date picker"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.dateBtnText, scheduledDate && styles.dateBtnTextActive]}>{'📅'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.templateBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowTemplates(true);
            }}
            accessibilityLabel="Task templates"
            accessibilityRole="button"
            accessibilityHint="Open task templates"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.templateBtnText}>⊞</Text>
          </TouchableOpacity>

          <View style={styles.toolbarSpacer} />

          {/* Quick-add hint inline */}
          {!text.trim() && (
            <Text style={styles.quickAddHint}>! · #tag · ↻</Text>
          )}
        </View>
      )}

      {/* Category chips */}
      {showCategories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catScrollContent}
        >
          <TouchableOpacity
            style={[styles.catChip, !category && styles.catChipActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCategory(null); setShowCategories(false);
            }}
            accessibilityLabel="No category"
            accessibilityRole="button"
          >
            <Text style={[styles.catChipText, !category && styles.catChipTextActive]}>None</Text>
          </TouchableOpacity>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catChip, category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCategory(c.key); setShowCategories(false);
              }}
              accessibilityLabel={`Category: ${c.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c.key }}
            >
              <Text style={[styles.catChipText, category === c.key && { color: Colors.dark.background }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Scheduled date indicator */}
      {dateLabel && !showDatePicker && (
        <Text style={styles.scheduledLabel}>Scheduled for {dateLabel}</Text>
      )}

      {/* Date picker */}
      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateQuickOptions}>
            <TouchableOpacity
              style={[styles.dateChip, !scheduledDate && styles.dateChipActive]}
              onPress={() => { setScheduledDate(undefined); setShowDatePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Text style={[styles.dateChipText, !scheduledDate && styles.dateChipTextActive]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd') && styles.dateChipActive]}
              onPress={() => {
                const d = format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
                setScheduledDate(d); setShowDatePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.dateChipText, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd') && styles.dateChipTextActive]}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 2), 'yyyy-MM-dd') && styles.dateChipActive]}
              onPress={() => {
                const d = format(addDays(new Date(today + 'T12:00:00'), 2), 'yyyy-MM-dd');
                setScheduledDate(d); setShowDatePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.dateChipText, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 2), 'yyyy-MM-dd') && styles.dateChipTextActive]}>In 2 days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 3), 'yyyy-MM-dd') && styles.dateChipActive]}
              onPress={() => {
                const d = format(addDays(new Date(today + 'T12:00:00'), 3), 'yyyy-MM-dd');
                setScheduledDate(d); setShowDatePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.dateChipText, scheduledDate === format(addDays(new Date(today + 'T12:00:00'), 3), 'yyyy-MM-dd') && styles.dateChipTextActive]}>In 3 days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, (() => { const todayDate = new Date(today + 'T12:00:00'); const dayOfWeek = todayDate.getDay(); const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; return scheduledDate === format(addDays(todayDate, daysUntilMon), 'yyyy-MM-dd'); })() && styles.dateChipActive]}
              onPress={() => {
                const todayDate = new Date(today + 'T12:00:00');
                const dayOfWeek = todayDate.getDay();
                const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
                const d = format(addDays(todayDate, daysUntilMon), 'yyyy-MM-dd');
                setScheduledDate(d); setShowDatePicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={[styles.dateChipText, (() => { const todayDate = new Date(today + 'T12:00:00'); const dayOfWeek = todayDate.getDay(); const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; return scheduledDate === format(addDays(todayDate, daysUntilMon), 'yyyy-MM-dd'); })() && styles.dateChipTextActive]}>Next week</Text>
            </TouchableOpacity>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateDayGrid}>
            {Array.from({ length: 14 }, (_, i) => {
              const d = addDays(new Date(today + 'T12:00:00'), i);
              const dateStr = format(d, 'yyyy-MM-dd');
              const dayName = format(d, 'EEE');
              const dayNum = d.getDate();
              const isSelected = scheduledDate === dateStr;
              const isToday = i === 0;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.dateDayCell, isSelected && styles.dateDayCellActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (isToday) {
                      setScheduledDate(undefined);
                    } else {
                      setScheduledDate(dateStr);
                    }
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateDayTextActive, isToday && !isSelected && styles.dateDayToday]}>{dayName}</Text>
                  <Text style={[styles.dateDayNum, isSelected && styles.dateDayTextActive, isToday && !isSelected && styles.dateDayToday]}>{dayNum}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Template picker modal */}
      <Modal visible={showTemplates} transparent animationType="slide">
        <TouchableOpacity
          style={styles.templateOverlay}
          activeOpacity={1}
          onPress={() => setShowTemplates(false)}
        >
          <View style={styles.templateSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.templateHandle} />
            <Text style={styles.templateTitle}>Task Templates</Text>
            <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false}>
              {templates.map(template => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateItem}
                  onPress={() => handleApplyTemplate(template)}
                  onLongPress={() => {
                    if (template.isCustom) {
                      Alert.alert('Delete Template', `Delete "${template.name}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteTemplate(template.id) },
                      ]);
                    }
                  }}
                >
                  <View style={styles.templateItemHeader}>
                    <Text style={styles.templateItemName}>{template.name}</Text>
                    {template.isCustom && <Text style={styles.templateCustomBadge}>custom</Text>}
                  </View>
                  <Text style={styles.templateItemTasks}>
                    {template.tasks.map(t => t.title).join(' · ')}
                  </Text>
                  <Text style={styles.templateItemCount}>{template.tasks.length} tasks</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveTemplateBtn} onPress={handleSaveAsTemplate}>
              <Text style={styles.saveTemplateBtnText}>Save today's tasks as template</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const TodoInput = memo(TodoInputInner);
export default TodoInput;

const styles = StyleSheet.create({
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.dark.accent,
    zIndex: 10,
    borderRadius: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  toolbarSpacer: {
    flex: 1,
  },
  inputFocused: {
    borderColor: Colors.dark.textTertiary,
  },
  priorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  templateBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateBtnText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  repeatBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatBtnActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  repeatBtnText: {
    fontSize: 16,
    color: Colors.dark.textTertiary,
  },
  repeatBtnTextActive: {
    color: Colors.dark.background,
  },
  catBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.dark.textTertiary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.dark.surfaceHover,
  },
  addButtonText: {
    fontSize: 24,
    color: Colors.dark.background,
    fontFamily: Fonts.bodyBold,
    marginTop: -2,
  },
  quickAddHint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  catScroll: {
    maxHeight: 40,
    marginBottom: Spacing.sm,
  },
  catScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
  // Date picker
  dateBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateBtnActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  dateBtnText: {
    fontSize: 16,
  },
  dateBtnTextActive: {
    fontSize: 16,
  },
  scheduledLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 11,
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.xs,
  },
  datePickerContainer: {
    paddingBottom: Spacing.sm,
  },
  dateQuickOptions: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  dateChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  dateChipTextActive: {
    color: Colors.dark.background,
  },
  dateDayGrid: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  dateDayCell: {
    width: 44,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  dateDayCellActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  dateDayName: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  dateDayNum: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  dateDayTextActive: {
    color: Colors.dark.background,
  },
  dateDayToday: {
    color: Colors.dark.accent,
  },
  // Template modal
  templateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  templateSheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
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
  templateHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  templateTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
    marginBottom: Spacing.md,
  },
  templateList: {
    flex: 1,
  },
  templateItem: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  templateItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  templateItemName: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  templateCustomBadge: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 10,
    backgroundColor: Colors.dark.timer + '22',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  templateItemTasks: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginBottom: 4,
  },
  templateItemCount: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  saveTemplateBtn: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.sm,
  },
  saveTemplateBtnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
});
