import { useRef, useEffect } from 'react';
import { Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { getTimeOfDay, TimeOfDay } from './helpers';
import { DailyQuote } from './DailyQuote';

export function EmptyState({ isToday, allCompleted }: { isToday: boolean; allCompleted: boolean }) {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  if (allCompleted) {
    const tod = getTimeOfDay();
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
        <Text style={emptyStyles.emptyQuote}>{doneMsg}</Text>
        <Text style={emptyStyles.emptySubtext}>{doneSub}</Text>
      </RNAnimated.View>
    );
  }

  if (isToday) {
    const tod = getTimeOfDay();
    const emptyMessages: Record<TimeOfDay, { prompt: string; sub: string }> = {
      morning: { prompt: 'A blank slate.', sub: 'What matters most today?' },
      afternoon: { prompt: "What's the plan?", sub: "It's not too late to set your intentions." },
      evening: { prompt: 'Quiet evening ahead.', sub: 'Plan tomorrow, or just breathe.' },
      night: { prompt: 'Nothing on the plate.', sub: 'Rest. Tomorrow is a new day.' },
    };
    const { prompt, sub } = emptyMessages[tod];
    return (
      <RNAnimated.View style={[emptyStyles.empty, { opacity: fadeAnim }]}>
        <Text style={emptyStyles.emptyIcon}>○</Text>
        <Text style={emptyStyles.emptyQuote}>{prompt}</Text>
        <Text style={emptyStyles.emptySubtext}>{sub}</Text>
        <DailyQuote />
      </RNAnimated.View>
    );
  }

  return (
    <RNAnimated.View style={[emptyStyles.empty, { opacity: fadeAnim }]}>
      <Text style={emptyStyles.emptyQuote}>Nothing here yet</Text>
      <Text style={emptyStyles.emptySubtext}>Add a task or navigate to another day</Text>
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
    color: Colors.dark.textTertiary,
    fontSize: 40,
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
  emptyQuote: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },
  emptySubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
