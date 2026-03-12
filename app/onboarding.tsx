import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Dimensions, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing } from '../lib/theme';
import { useUserStore } from '../engines/user/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WalkthroughSlide {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
}

const WALKTHROUGH_SLIDES: WalkthroughSlide[] = [
  {
    icon: '◉\n┊\n◉\n┊\n◉',
    title: 'Track your tasks',
    subtitle: 'Simple. Focused. Minimal.',
    description: 'Add tasks, set priorities, and organize by category.\nLong press any task for quick actions.',
  },
  {
    icon: '⬤ ⬤ ⬤ ⬤ ⬤\n⬤ ⬤ ⬤ ○ ○\n○ ○ ○ ○ ○',
    title: 'Stay accountable',
    subtitle: 'Your progress, visualized.',
    description: 'Each dot represents a day. Brighter dots mean more tasks done.\nWatch your wallpaper fill up over time.',
  },
  {
    icon: '[ Si ]',
    title: 'Connect Silicon',
    subtitle: 'Your AI companion.',
    description: 'Silicon can add tasks, write reviews, and nudge you.\nPair from Settings to get started.',
  },
];

function WalkthroughScreen({ onComplete }: { onComplete: () => void }) {
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const goNext = () => {
    if (currentIndex < WALKTHROUGH_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const renderSlide = ({ item, index }: { item: WalkthroughSlide; index: number }) => (
    <View style={[walkStyles.slide, { width: SCREEN_WIDTH }]}>
      <Text style={walkStyles.icon}>{item.icon}</Text>
      <Text style={walkStyles.title}>{item.title}</Text>
      <Text style={walkStyles.subtitle}>{item.subtitle}</Text>
      <Text style={walkStyles.description}>{item.description}</Text>
    </View>
  );

  const isLast = currentIndex === WALKTHROUGH_SLIDES.length - 1;

  return (
    <Animated.View style={[walkStyles.container, { opacity: fadeAnim }]}>
      <FlatList
        ref={flatListRef}
        data={WALKTHROUGH_SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(idx);
        }}
        keyExtractor={(_, i) => String(i)}
      />

      {/* Dots */}
      <View style={walkStyles.dots}>
        {WALKTHROUGH_SLIDES.map((_, i) => (
          <View
            key={i}
            style={[walkStyles.dot, i === currentIndex && walkStyles.dotActive]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={walkStyles.buttons}>
        {!isLast && (
          <TouchableOpacity style={walkStyles.skipBtn} onPress={onComplete}>
            <Text style={walkStyles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={walkStyles.nextBtn} onPress={goNext}>
          <Text style={walkStyles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const walkStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  icon: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 32,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  description: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.border,
  },
  dotActive: {
    backgroundColor: Colors.dark.accent,
    width: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl + 20,
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
});

export default function OnboardingScreen() {
  const [input, setInput] = useState('');
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const setUsername = useUserStore(s => s.setUsername);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const sanitized = input.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');

  const handleSubmit = () => {
    if (!sanitized) return;
    setShowWalkthrough(true);
  };

  const handleWalkthroughComplete = () => {
    setUsername(sanitized);
    router.replace('/(tabs)');
  };

  if (showWalkthrough) {
    return <WalkthroughScreen onComplete={handleWalkthroughComplete} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.title}>untodo</Text>
        <Text style={styles.tagline}>Do less. Mean more.</Text>
        <Text style={styles.subtitle}>pick a username</Text>

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="username"
          placeholderTextColor={Colors.dark.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          maxLength={20}
        />

        {input.length > 0 && sanitized !== input && (
          <Text style={styles.sanitizedHint}>{sanitized}</Text>
        )}

        <TouchableOpacity
          style={[styles.button, !sanitized && { opacity: 0.3 }]}
          onPress={handleSubmit}
          disabled={!sanitized}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 64,
    marginBottom: Spacing.xs,
  },
  tagline: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 16,
    marginBottom: Spacing.xxl,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sanitizedHint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  button: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
});
