import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ConfettiCelebration({ visible, onDismiss, streak }: { visible: boolean; onDismiss: () => void; streak: number }) {
  const { colors } = useTheme();
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const textScale = useRef(new RNAnimated.Value(0.5)).current;
  const textOpacity = useRef(new RNAnimated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: 40 }, (_, i) => ({
      x: new RNAnimated.Value(SCREEN_WIDTH / 2),
      y: new RNAnimated.Value(500),
      opacity: new RNAnimated.Value(1),
      rotate: new RNAnimated.Value(0),
      color: ['#4ADE80', '#60A5FA', '#FBBF24', '#F472B6', '#A78BFA', '#F5F5F5', '#34D399', '#FB923C'][i % 8],
      targetX: Math.random() * SCREEN_WIDTH,
      targetY: Math.random() * -300 + 50,
      targetRotate: (Math.random() - 0.5) * 720,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    // Fade in
    RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Text entrance with spring
    textScale.setValue(0.5);
    textOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.delay(400),
      RNAnimated.parallel([
        RNAnimated.spring(textScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        RNAnimated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    // Animate particles in two waves
    particles.forEach((p, i) => {
      const delay = i < 20 ? 0 : 300;
      p.x.setValue(SCREEN_WIDTH / 2);
      p.y.setValue(500);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
      RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.parallel([
          RNAnimated.timing(p.x, { toValue: p.targetX, duration: 1400, useNativeDriver: true }),
          RNAnimated.sequence([
            RNAnimated.timing(p.y, { toValue: p.targetY, duration: 700, useNativeDriver: true }),
            RNAnimated.timing(p.y, { toValue: 900, duration: 700, useNativeDriver: true }),
          ]),
          RNAnimated.timing(p.rotate, { toValue: p.targetRotate, duration: 1400, useNativeDriver: true }),
          RNAnimated.timing(p.opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ]),
      ]).start();
    });
    // Celebration haptic pattern
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    // Auto-dismiss after 3.5 seconds
    const t3 = setTimeout(onDismiss, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  if (!visible) return null;

  return (
    <RNAnimated.View style={[confettiStyles.confettiOverlay, { opacity }]} pointerEvents="none">
      {particles.map((p, i) => {
        const spin = p.rotate.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
        return (
          <RNAnimated.View
            key={i}
            style={[
              confettiStyles.confettiParticle,
              {
                backgroundColor: p.color,
                width: i % 4 === 0 ? 10 : i % 3 === 0 ? 8 : 6,
                height: i % 4 === 0 ? 10 : i % 3 === 0 ? 8 : 6,
                borderRadius: i % 2 === 0 ? 5 : 1,
                transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: spin }],
                opacity: p.opacity,
              },
            ]}
          />
        );
      })}
      <RNAnimated.View style={[confettiStyles.celebrationTextContainer, { backgroundColor: colors.surface, borderColor: colors.border, opacity: textOpacity, transform: [{ scale: textScale }] }]}>
        <Text style={confettiStyles.celebrationEmoji}>🔥</Text>
        <Text style={[confettiStyles.celebrationText, { color: colors.text }]}>Everything done!</Text>
        <Text style={[confettiStyles.celebrationSubtext, { color: colors.textSecondary }]}>You're a machine.</Text>
        {streak > 0 && (
          <Text style={[confettiStyles.celebrationStreak, { color: colors.timer }]}>{streak} day streak</Text>
        )}
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

const confettiStyles = StyleSheet.create({
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiParticle: {
    position: 'absolute',
  },
  celebrationTextContainer: {
    borderRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  celebrationText: {
    fontFamily: Fonts.accentItalic,
    fontSize: 24,
    textAlign: 'center',
  },
  celebrationSubtext: {
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  celebrationStreak: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
});
