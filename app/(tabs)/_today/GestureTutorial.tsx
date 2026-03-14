import { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';

export const GESTURE_TUTORIAL_KEY = 'untodo-gesture-tutorial-shown';

export function GestureTutorial({ onDismiss }: { onDismiss: () => void }) {
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
        <View style={tutorialStyles.card}>
          <Text style={tutorialStyles.title}>Quick gestures</Text>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Swipe right</Text>
            <Text style={tutorialStyles.desc}>Complete task</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Swipe left</Text>
            <Text style={tutorialStyles.desc}>Delete task</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Long press</Text>
            <Text style={tutorialStyles.desc}>Quick actions</Text>
          </View>
          <View style={tutorialStyles.row}>
            <Text style={tutorialStyles.gesture}>Tap</Text>
            <Text style={tutorialStyles.desc}>Task details</Text>
          </View>
          <Text style={tutorialStyles.dismiss}>Tap anywhere to dismiss</Text>
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.text,
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
    borderBottomColor: Colors.dark.border,
  },
  gesture: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  desc: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  dismiss: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
