import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { formatDisplayDate } from '../../lib/date-utils';
import { Todo } from '../../engines/todo/types';

export function SearchResults({
  query,
  results,
  onSelect,
  onClose,
}: {
  query: string;
  results: Todo[];
  onSelect: (todo: Todo) => void;
  onClose: () => void;
}) {
  if (!query.trim() || results.length === 0) {
    if (query.trim()) {
      return (
        <View style={searchStyles.searchResults}>
          <Text style={searchStyles.searchNoResults}>No tasks found</Text>
        </View>
      );
    }
    return null;
  }

  // Group results by date
  const grouped = results.slice(0, 20).reduce<Record<string, Todo[]>>((acc, todo) => {
    const date = todo.logicalDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(todo);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <View style={searchStyles.searchResults}>
      <ScrollView style={searchStyles.searchScroll} keyboardShouldPersistTaps="handled">
        {sortedDates.map(date => (
          <View key={date}>
            <View style={searchStyles.searchDateHeader}>
              <Text style={searchStyles.searchDateHeaderText}>{formatDisplayDate(date)}</Text>
            </View>
            {grouped[date].map(todo => (
              <TouchableOpacity
                key={todo.id}
                style={searchStyles.searchResultItem}
                onPress={() => onSelect(todo)}
              >
                <View style={searchStyles.searchResultContent}>
                  <Text
                    style={[searchStyles.searchResultTitle, todo.completed && searchStyles.searchResultTitleDone]}
                    numberOfLines={1}
                  >
                    {todo.title}
                  </Text>
                </View>
                {todo.completed && <Text style={searchStyles.searchResultCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const searchStyles = StyleSheet.create({
  searchResults: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: Spacing.xs,
    maxHeight: 240,
    overflow: 'hidden',
  },
  searchScroll: {
    maxHeight: 240,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  searchResultTitleDone: {
    color: Colors.dark.textTertiary,
    textDecorationLine: 'line-through',
  },
  searchResultCheck: {
    color: Colors.dark.success,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  searchDateHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.dark.background,
  },
  searchDateHeaderText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchNoResults: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
