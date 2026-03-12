import { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder,
} from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../types';

interface Props {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
}

export default function TodoItem({ todo, onToggle, onDelete, onPress }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 20,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -100) {
          Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(onDelete);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Delete</Text>
      </View>
      <Animated.View
        style={[styles.container, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity style={styles.checkbox} onPress={onToggle}>
          <View style={[styles.checkboxInner, todo.completed && styles.checkboxChecked]}>
            {todo.completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.content} onPress={onPress} activeOpacity={0.7}>
          <View style={styles.titleRow}>
            {todo.carriedOverFrom && (
              <Text style={styles.carriedOverArrow}>↩ </Text>
            )}
            <Text style={[styles.title, todo.completed && styles.titleCompleted]} numberOfLines={2}>
              {todo.title}
            </Text>
          </View>
          {todo.carriedOverFrom && (
            <Text style={styles.carriedOver}>carried over</Text>
          )}
        </TouchableOpacity>
        {todo.estimatedMinutes && (
          <Text style={styles.estimate}>{todo.estimatedMinutes}m</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: Colors.dark.error,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.lg,
  },
  deleteText: {
    color: '#fff',
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  checkbox: {
    padding: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.success,
    borderColor: Colors.dark.success,
  },
  checkmark: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carriedOverArrow: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  carriedOver: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  estimate: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 13,
  },
});
