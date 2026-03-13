import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../lib/theme';

interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
}

let _showUndo: ((action: UndoAction) => void) | null = null;

export function showUndoToast(action: UndoAction) {
  _showUndo?.(action);
}

export default function UndoToast() {
  const [action, setAction] = useState<UndoAction | null>(null);
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _showUndo = (newAction) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setAction(newAction);
      translateY.setValue(100);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 3000);
    };
    return () => { _showUndo = null; };
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setAction(null));
  };

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action?.onUndo();
    dismiss();
  };

  if (!action) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Text style={styles.message}>{action.message}</Text>
      <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.undoButton}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 999,
  },
  message: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    flex: 1,
  },
  undoButton: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    paddingLeft: Spacing.md,
  },
});
