import { useState, useRef, memo, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, Animated, Modal, Alert, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
import { Priority, Category, CATEGORIES, PRIORITY_CONFIG, Recurrence } from '../types';
import { useTemplateStore, TaskTemplate, TemplateTask } from '../templates';
import { useTodoStore } from '../store';
import { getLogicalDate } from '../../../lib/date-utils';
import { CalendarPicker } from '../../../components/today/CalendarPicker';

interface Props {
  onAdd: (title: string, priority?: Priority, category?: Category, recurrence?: Recurrence, date?: string) => void;
  viewingDate?: string;
}

const PRIORITY_CYCLE: (Priority)[] = [null, 'low', 'medium', 'high'];

function TodoInputInner({ onAdd, viewingDate }: Props) {
  const { colors } = useTheme();
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
  const getAllTemplates = useTemplateStore(s => s.getAllTemplates);
  const addCustomTemplate = useTemplateStore(s => s.addCustomTemplate);
  const deleteTemplate = useTemplateStore(s => s.deleteTemplate);
  const allTodos = useTodoStore(s => s.todos);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      inputRef.current?.blur();
    });
    return () => sub.remove();
  }, []);

  const today = useMemo(() => getLogicalDate(), []);
  const dateLabel = useMemo(() => {
    if (!scheduledDate) return undefined;
    if (scheduledDate === today) return undefined;
    const todayDate = new Date(today + 'T12:00:00');
    const tmrw = format(addDays(todayDate, 1), 'yyyy-MM-dd');
    if (scheduledDate === tmrw) return 'Tomorrow';
    return format(new Date(scheduledDate + 'T12:00:00'), 'MMM d');
  }, [scheduledDate, today]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  const priorityColor = priority ? PRIORITY_CONFIG[priority].color : colors.textTertiary;
  const selectedCat = CATEGORIES.find(c => c.key === category);
  const templates = getAllTemplates();

  const styles = useMemo(() => StyleSheet.create({
    flashOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.accent,
      zIndex: 10,
      borderRadius: 12,
    },
    inputFocused: {
      borderColor: colors.textTertiary,
      backgroundColor: colors.surfaceHover,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    priorityBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: Spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 16,
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    templateBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateBtnText: {
      fontFamily: Fonts.body,
      fontSize: 16,
      color: colors.textSecondary,
    },
    repeatBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    repeatBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    repeatBtnText: {
      fontSize: 16,
      color: colors.textTertiary,
    },
    repeatBtnTextActive: {
      color: colors.background,
    },
    catBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    catBtnText: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 14,
      color: colors.textTertiary,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonDisabled: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    addButtonText: {
      fontSize: 22,
      color: colors.background,
      fontFamily: Fonts.body,
      fontWeight: '300',
      marginTop: -1,
    },
    addButtonTextDisabled: {
      color: colors.textTertiary,
    },
    quickAddHint: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    catChipText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    catChipTextActive: {
      color: colors.background,
    },
    dateBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    scheduledLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 11,
      paddingHorizontal: Spacing.lg,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.xs,
    },
    dateChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    dateChipText: {
      fontFamily: Fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
    },
    dateChipTextActive: {
      color: colors.background,
    },
    dateDayCell: {
      width: 44,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 2,
    },
    dateDayCellActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    dateDayName: {
      fontFamily: Fonts.body,
      fontSize: 10,
      color: colors.textTertiary,
    },
    dateDayNum: {
      fontFamily: Fonts.bodyMedium,
      fontSize: 14,
      color: colors.textSecondary,
    },
    dateDayTextActive: {
      color: colors.background,
    },
    dateDayToday: {
      color: colors.accent,
    },
    templateOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    templateSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
      maxHeight: '70%',
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
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
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.lg,
    },
    templateTitle: {
      color: colors.text,
      fontFamily: Fonts.headingMedium,
      fontSize: 18,
      marginBottom: Spacing.md,
    },
    templateItem: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    templateItemName: {
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 15,
    },
    templateCustomBadge: {
      color: colors.timer,
      fontFamily: Fonts.body,
      fontSize: 10,
      backgroundColor: colors.timer + '22',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 6,
    },
    templateItemTasks: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 12,
      marginBottom: 4,
    },
    templateItemCount: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 11,
    },
    saveTemplateBtn: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: Spacing.sm,
    },
    saveTemplateBtnText: {
      color: colors.textSecondary,
      fontFamily: Fonts.bodyMedium,
      fontSize: 14,
    },
  }), [colors]);

  return (
    <View>
      <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />
      {/* Main input row - always clean: just input + add button */}
      <View style={staticStyles.container}>
        <TextInput
          ref={inputRef}
          style={[styles.input, isFocused && styles.inputFocused]}
          placeholder={isFocused ? "What needs doing?" : "Add a task..."}
          placeholderTextColor={colors.text + '4D'}
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
          <Text style={[styles.addButtonText, !text.trim() && styles.addButtonTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar row - appears below input when focused */}
      {isFocused && (
        <View style={staticStyles.toolbar}>
          <TouchableOpacity
            style={styles.priorityBtn}
            onPress={cyclePriority}
            accessibilityLabel={`Priority: ${priorityLabel}`}
            accessibilityRole="button"
            accessibilityHint="Cycle through priority levels"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={[staticStyles.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[staticStyles.priorityText, { color: priorityColor }]}>{priorityLabel}</Text>
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
            <Text style={[staticStyles.dateBtnText, scheduledDate && staticStyles.dateBtnTextActive]}>{'📅'}</Text>
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

          <View style={staticStyles.toolbarSpacer} />

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
          style={staticStyles.catScroll}
          contentContainerStyle={staticStyles.catScrollContent}
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
              <Text style={[styles.catChipText, category === c.key && { color: colors.background }]}>
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

      {/* Calendar date picker */}
      {showDatePicker && (
        <CalendarPicker
          selectedDate={scheduledDate || today}
          allTodos={allTodos}
          onSelectDate={(dateStr) => {
            if (dateStr === today) {
              setScheduledDate(undefined);
            } else {
              setScheduledDate(dateStr);
            }
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
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
            <ScrollView style={staticStyles.templateList} showsVerticalScrollIndicator={false}>
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
                  <View style={staticStyles.templateItemHeader}>
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

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  dateBtnText: {
    fontSize: 16,
  },
  dateBtnTextActive: {
    fontSize: 16,
  },
  catScroll: {
    maxHeight: 40,
    marginBottom: Spacing.sm,
  },
  catScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  datePickerContainer: {
    paddingBottom: Spacing.sm,
  },
  dateQuickOptions: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  dateDayGrid: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  templateList: {
    flex: 1,
  },
  templateItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
});
