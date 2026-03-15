import { useRef, useEffect, useState, useCallback } from 'react';
import { Text, StyleSheet, Animated as RNAnimated, TouchableOpacity } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { getTimeOfDay, TimeOfDay } from './helpers';
import { DailyQuote } from './DailyQuote';

// Rotating prompts per time of day — each one is an invitation to act
const ROTATING_PROMPTS: Record<TimeOfDay, { prompt: string; sub: string }[]> = {
  morning: [
    { prompt: 'A blank slate.', sub: 'What matters most today?' },
    { prompt: 'Your day is wide open.', sub: 'One task to start the momentum.' },
    { prompt: 'Morning clarity.', sub: 'What would make today a win?' },
    { prompt: 'Fresh start.', sub: 'Name the one thing you won\'t skip.' },
    { prompt: 'The day is yours.', sub: 'Set your first intention.' },
  ],
  afternoon: [
    { prompt: 'What\'s the plan?', sub: 'It\'s not too late to set your intentions.' },
    { prompt: 'Afternoon reset.', sub: 'One task can change the whole day.' },
    { prompt: 'Still time left.', sub: 'What would you be proud of finishing?' },
    { prompt: 'Half the day ahead.', sub: 'Pick one thing and own it.' },
  ],
  evening: [
    { prompt: 'Quiet evening ahead.', sub: 'Plan tomorrow, or just breathe.' },
    { prompt: 'Wind down.', sub: 'Anything left to capture for tomorrow?' },
    { prompt: 'Evening mode.', sub: 'Reflect, plan, or rest.' },
  ],
  night: [
    { prompt: 'Nothing on the plate.', sub: 'Rest. Tomorrow is a new day.' },
    { prompt: 'Day\'s done.', sub: 'Sleep well. You\'ll start fresh.' },
    { prompt: 'Night mode.', sub: 'Let it go. Tomorrow awaits.' },
  ],
};

export function EmptyState({ isToday, allCompleted }: { isToday: boolean; allCompleted: boolean }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const breatheAnim = useRef(new RNAnimated.Value(0.4)).current;
  const textFade = useRef(new RNAnimated.Value(1)).current;

  const tod = getTimeOfDay();
  const prompts = ROTATING_PROMPTS[tod];
  const [promptIdx, setPromptIdx] = useState(() => {
    // Seed from current minute so it's not always index 0
    return Math.floor(Date.now() / 60000) % prompts.length;
  });

  // Entrance fade
  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // Gentle breathing pulse on the empty dot
  useEffect(() => {
    if (!isToday || allCompleted) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(breatheAnim, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
        RNAnimated.timing(breatheAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isToday, allCompleted]);

  // Rotate prompt every 8 seconds with crossfade
  useEffect(() => {
    if (!isToday || allCompleted) return;
    const interval = setInterval(() => {
      // Fade out
      RNAnimated.timing(textFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPromptIdx(prev => (prev + 1) % prompts.length);
        // Fade in
        RNAnimated.timing(textFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [isToday, allCompleted, prompts.length]);

  if (allCompleted) {
    const doneMsg = tod === 'night'
      ? 'All done. Get some rest.'
      : tod === 'evening'
        ? 'Everything done. Enjoy your evening.'
        : 'Everything done! You\'re a machine.';
    const doneSub = tod === 'night'
      ? 'Tomorrow will thank you.'
      : 'Go live your day. You earned it.';
    return (
      <RNAnimated.View style={[emptyStyles.empty, { opacity: fadeAnim }]}>
        <Text style={emptyStyles.emptyIcon}>🔥</Text>
        <Text style={[emptyStyles.emptyQuote, { color: colors.textSecondary }]}>{doneMsg}</Text>
        <Text style={[emptyStyles.emptySubtext, { color: colors.textTertiary }]}>{doneSub}</Text>
      </RNAnimated.View>
    );
  }

  if (isToday) {
    const { prompt, sub } = prompts[promptIdx];
    return (
      <RNAnimated.View style={[emptyStyles.empty, { opacity: fadeAnim }]}>
        <RNAnimated.Text style={[emptyStyles.emptyIcon, { color: colors.textTertiary, opacity: breatheAnim }]}>○</RNAnimated.Text>
        <RNAnimated.View style={{ opacity: textFade }}>
          <Text style={[emptyStyles.emptyQuote, { color: colors.textSecondary }]}>{prompt}</Text>
          <Text style={[emptyStyles.emptySubtext, { color: colors.textTertiary }]}>{sub}</Text>
        </RNAnimated.View>
        <DailyQuote />
      </RNAnimated.View>
    );
  }

  return (
    <RNAnimated.View style={[emptyStyles.empty, { opacity: fadeAnim }]}>
      <Text style={[emptyStyles.emptyQuote, { color: colors.textSecondary }]}>Nothing here yet</Text>
      <Text style={[emptyStyles.emptySubtext, { color: colors.textTertiary }]}>Add a task or navigate to another day</Text>
    </RNAnimated.View>
  );
}

const emptyStyles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.lg,
  },
  emptyQuote: {
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },
  emptySubtext: {
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
