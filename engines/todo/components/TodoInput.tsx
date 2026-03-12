import { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Priority, Category, CATEGORIES, PRIORITY_CONFIG } from '../types';

interface Props {
  onAdd: (title: string, priority?: Priority, category?: Category) => void;
}

const PRIORITY_CYCLE: (Priority)[] = [null, 'low', 'medium', 'high'];

export default function TodoInput({ onAdd }: Props) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>(null);
  const [category, setCategory] = useState<Category>(null);
  const [showCategories, setShowCategories] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, priority, category);
    setText('');
    setPriority(null);
    setCategory(null);
    setShowCategories(false);
    inputRef.current?.focus();
  };

  const cyclePriority = () => {
    const idx = PRIORITY_CYCLE.indexOf(priority);
    setPriority(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
  };

  const priorityLabel = priority ? PRIORITY_CONFIG[priority].label : '—';
  const priorityColor = priority ? PRIORITY_CONFIG[priority].color : Colors.dark.textTertiary;

  const selectedCat = CATEGORIES.find(c => c.key === category);

  return (
    <View>
      <View style={styles.container}>
        {/* Priority toggle */}
        <TouchableOpacity style={styles.priorityBtn} onPress={cyclePriority}>
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
        />

        {/* Category toggle */}
        <TouchableOpacity
          style={[styles.catBtn, selectedCat && { borderColor: selectedCat.color }]}
          onPress={() => setShowCategories(!showCategories)}
        >
          <Text style={[styles.catBtnText, selectedCat && { color: selectedCat.color }]}>
            {selectedCat ? selectedCat.label.charAt(0) : '#'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addButton, !text.trim() && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!text.trim()}
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
            onPress={() => { setCategory(null); setShowCategories(false); }}
          >
            <Text style={[styles.catChipText, !category && styles.catChipTextActive]}>None</Text>
          </TouchableOpacity>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catChip, category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
              onPress={() => { setCategory(c.key); setShowCategories(false); }}
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
