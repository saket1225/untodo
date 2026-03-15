import { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

export const GESTURE_TUTORIAL_KEY = 'untodo-gesture-tutorial-shown';

export function GestureTutorial({ onDismiss }: { onDismiss: () => void }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const dismiss = useCallback(() => {
    RNAnimated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  }, [onDismiss]);

  return (
    <RNAnimated.View style={[tutorialStyles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity style={tutorialStyles.touchArea} activeOpacity={1} onPress={dismiss}>
        <View style={[tutorialStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[tutorialStyles.title, { color: colors.text }]}>Quick gestures</Text>
          <View style={[tutorialStyles.row, { borderBottomColor: colors.border }]}>
            <Text style={[tutorialStyles.gesture, { color: colors.accent }]}>Tap circle</Text>
            <Text style={[tutorialStyles.desc, { color: colors.textSecondary }]}>Complete task</Text>
          </View>
          <View style={[tutorialStyles.row, { borderBottomColor: colors.border }]}>
            <Text style={[tutorialStyles.gesture, { color: colors.accent }]}>Long press</Text>
            <Text style={[tutorialStyles.desc, { color: colors.textSecondary }]}>Edit, priority, delete…</Text>
          </View>
          <View style={[tutorialStyles.row, { borderBottomColor: colors.border }]}>
            <Text style={[tutorialStyles.gesture, { color: colors.accent }]}>Swipe left / right</Text>
            <Text style={[tutorialStyles.desc, { color: colors.textSecondary }]}>Change date</Text>
          </View>
          <View style={[tutorialStyles.row, { borderBottomColor: colors.border }]}>
            <Text style={[tutorialStyles.gesture, { color: colors.accent }]}>Tap task</Text>
            <Text style={[tutorialStyles.desc, { color: colors.textSecondary }]}>Task details</Text>
          </View>
          <Text style={[tutorialStyles.dismiss, { color: colors.textTertiary }]}>Tap anywhere to dismiss</Text>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

const tutorialStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  title: {
    fontFamily: Fonts.accentItalic,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gesture: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  desc: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  dismiss: {
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
