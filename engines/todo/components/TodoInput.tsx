import { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Priority, Category, CATEGORIES, PRIORITY_CONFIG } from '../types';

interface Props {
  onAdd: (title: string, priority?: Priority, category?: Category) => void;
  autoFocus?: boolean;
}

const PRIORITY_CYCLE: (Priority)[] = [null, 'low', 'medium', 'high'];

export default function TodoInput({ onAdd, autoFocus }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>(null);
  const [category, setCategory] = useState<Category>(null);
  const [showCategories, setShowCategories] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [autoFocus]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(trimmed, priority, category);
    setText('');
    setPriority(null);
    setCategory(null);
    setShowCategories(false);
    // Flash animation
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    inputRef.current?.focus();
  };

  const cyclePriority = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = PRIORITY_CYCLE.indexOf(priority);
    setPriority(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
  };

  const priorityLabel = priority ? PRIORITY_CONFIG[priority].label : '—';
  const priorityColor = priority ? PRIORITY_CONFIG[priority].color : Colors.dark.textTertiary;

  const selectedCat = CATEGORIES.find(c => c.key === category);

  return (
    <View>
      <Animated.View style={[styles.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />
      <View style={styles.container}>
        {/* Priority toggle */}
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

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Add a task..."
          placeholderTextColor={Colors.dark.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          accessibilityLabel="Task title"
          accessibilityHint="Type a task name and press done to add"
        />

        {/* Category toggle */}
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
    </View>
  );
}

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
    paddingVertical: Spacing.md,
  },
  priorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
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
    paddingVertical: 14,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  catBtn: {
    width: 36,
    height: 36,
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
    width: 48,
    height: 48,
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
});
