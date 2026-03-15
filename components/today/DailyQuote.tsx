import { useState, useCallback, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';

const DAILY_QUOTES = [
  'Memento mori.',
  'The obstacle is the way.',
  'Discipline equals freedom.',
  'Do the work.',
  'Amor fati.',
  'Less but better.',
  'Ship it.',
  'Be water.',
  'Start before you\'re ready.',
  'No shortcuts.',
  'Trust the process.',
  'Stay hungry.',
  'Own your day.',
  'Execute.',
  'One thing at a time.',
  'Progress, not perfection.',
  'Show up daily.',
  'Outwork everyone.',
  'Build in silence.',
  'Make it happen.',
  'We suffer more in imagination than reality.',
  'The best time to plant a tree was 20 years ago.',
  'Action cures fear.',
  'What stands in the way becomes the way.',
  'You could leave life right now. Let that determine what you do.',
  'Waste no more time arguing about what a good person should be. Be one.',
  'It is not that we have a short time to live, but that we waste much of it.',
  'He who has a why can bear almost any how.',
  'The impediment to action advances action.',
  'Begin at once to live.',
];

function getDailyQuoteIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000) % DAILY_QUOTES.length;
}

export function DailyQuote() {
  const { colors } = useTheme();
  const [quoteIndex, setQuoteIndex] = useState(getDailyQuoteIndex);
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;

  const handleTap = useCallback(() => {
    RNAnimated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setQuoteIndex(prev => (prev + 1) % DAILY_QUOTES.length);
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, []);

  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={0.6} style={quoteStyles.container}>
      <RNAnimated.Text style={[quoteStyles.text, { color: colors.textTertiary, opacity: fadeAnim }]}>
        "{DAILY_QUOTES[quoteIndex]}"
      </RNAnimated.Text>
    </TouchableOpacity>
  );
}

const quoteStyles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  text: {
    fontFamily: Fonts.accentItalic,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.6,
  },
});
