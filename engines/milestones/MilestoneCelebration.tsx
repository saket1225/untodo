import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated as RNAnimated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import { useMilestoneStore, TaskMilestone } from './store';

export default function MilestoneCelebration() {
  const pendingMilestone = useMilestoneStore(s => s.pendingMilestone);
  const dismissMilestone = useMilestoneStore(s => s.dismissMilestone);
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const scale = useRef(new RNAnimated.Value(0.5)).current;
  const counterAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!pendingMilestone) return;

    opacity.setValue(0);
    scale.setValue(0.5);
    counterAnim.setValue(0);

    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]).start();

    // Counter animation
    RNAnimated.timing(counterAnim, { toValue: 1, duration: 1200, useNativeDriver: false }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    const t3 = setTimeout(dismiss, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pendingMilestone?.threshold]);

  const dismiss = () => {
    RNAnimated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      dismissMilestone();
    });
  };

  if (!pendingMilestone) return null;

  const animatedCount = counterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, pendingMilestone.threshold - 10), pendingMilestone.threshold],
  });

  return (
    <RNAnimated.View style={[styles.overlay, { opacity }]}>
      <TouchableOpacity activeOpacity={1} onPress={dismiss} style={styles.touchArea}>
        <RNAnimated.View style={[styles.card, { transform: [{ scale }] }]}>
          <Text style={styles.emoji}>{pendingMilestone.emoji}</Text>
          <Text style={styles.title}>{pendingMilestone.title}</Text>
          <RNAnimated.Text style={styles.counter}>
            {pendingMilestone.threshold}
          </RNAnimated.Text>
          <Text style={styles.counterLabel}>tasks completed</Text>
          <Text style={styles.message}>{pendingMilestone.message}</Text>
        </RNAnimated.View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 150,
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
    color: Colors.dark.text,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 26,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  counter: {
    color: Colors.dark.accent,
    fontFamily: Fonts.heading,
    fontSize: 56,
    lineHeight: 64,
  },
  counterLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  message: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
