import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
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
  const { colors } = useTheme();

  if (!query.trim() || results.length === 0) {
    if (query.trim()) {
      return (
        <View style={[searchStyles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[searchStyles.searchNoResults, { color: colors.textTertiary }]}>No tasks found</Text>
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
    <View style={[searchStyles.searchResults, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScrollView style={searchStyles.searchScroll} keyboardShouldPersistTaps="handled">
        {sortedDates.map(date => (
          <View key={date}>
            <View style={[searchStyles.searchDateHeader, { backgroundColor: colors.background }]}>
              <Text style={[searchStyles.searchDateHeaderText, { color: colors.textTertiary }]}>{formatDisplayDate(date)}</Text>
            </View>
            {grouped[date].map(todo => (
              <TouchableOpacity
                key={todo.id}
                style={[searchStyles.searchResultItem, { borderBottomColor: colors.border }]}
                onPress={() => onSelect(todo)}
              >
                <View style={searchStyles.searchResultContent}>
                  <Text
                    style={[searchStyles.searchResultTitle, { color: colors.text }, todo.completed && { color: colors.textTertiary, textDecorationLine: 'line-through' }]}
                    numberOfLines={1}
                  >
                    {todo.title}
                  </Text>
                </View>
                {todo.completed && <Text style={[searchStyles.searchResultCheck, { color: colors.success }]}>✓</Text>}
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
    borderRadius: 12,
    borderWidth: 1,
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
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  searchResultCheck: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  searchDateHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  searchDateHeaderText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchNoResults: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
