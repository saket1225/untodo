import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Dimensions, Keyboard,
  TouchableWithoutFeedback, FlatList, ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Fonts, Spacing } from '../lib/theme';
import { useTheme } from '../lib/ThemeContext';
import { useUserStore } from '../engines/user/store';
import { useTodoStore } from '../engines/todo/store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Screen 1: Brand ---
function BrandScreen() {
  const { colors, fonts, isDark } = useTheme();
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.screen, styles.centerContent]}>
      {/* Decorative dot grid */}
      <Animated.View style={[styles.dotGrid, { opacity: dotOpacity }]}>
        {Array.from({ length: 15 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.decorDot,
              i < 5 && { backgroundColor: colors.textTertiary },
              i >= 5 && i < 10 && { backgroundColor: colors.border },
              i >= 10 && { backgroundColor: colors.surface },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.Text style={[
        styles.logo,
        { color: colors.text, opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        untodo
      </Animated.Text>

      <Animated.Text style={[
        styles.tagline,
        { color: colors.textTertiary, opacity: taglineOpacity },
      ]}>
        Do less. Mean more.
      </Animated.Text>
    </View>
  );
}

// --- Screen 2: Features ---
function FeaturesScreen() {
  const { colors } = useTheme();
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(anim1, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(anim2, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(anim3, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const features = [
    { anim: anim1, icon: '◉', title: 'Intentional Tasks', desc: 'Focus on what truly matters today' },
    { anim: anim2, icon: '◧', title: 'Track Progress', desc: 'Streaks, stats, and achievements' },
    { anim: anim3, icon: '◈', title: 'Your Wallpaper', desc: 'Turn your progress into art' },
  ];

  return (
    <View style={[styles.screen, styles.centerContent]}>
      <Text style={[styles.featuresHeading, { color: colors.text }]}>Built for focus</Text>
      <View style={styles.featuresList}>
        {features.map((f, i) => (
          <Animated.View
            key={i}
            style={[
              styles.featureRow,
              {
                opacity: f.anim,
                transform: [{ translateX: f.anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
              },
            ]}
          >
            <Text style={[styles.featureIcon, { color: colors.textSecondary }]}>{f.icon}</Text>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
              <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>{f.desc}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// --- Screen 3: Username ---
function UsernameScreen({ onComplete }: { onComplete: () => void }) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const setUsername = useUserStore(s => s.setUsername);
  const addSampleTasks = useTodoStore(s => s.addSampleTasks);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const sanitized = input.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
  const isValid = sanitized.length >= 3;

  const handleSubmit = () => {
    if (!isValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUsername(sanitized);
    addSampleTasks();
    onComplete();
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={[styles.screen, styles.centerContent]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[
          styles.usernameContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          <Text style={[styles.usernameHeading, { color: colors.text }]}>pick a username</Text>
          <Text style={[styles.usernameSubtext, { color: colors.textTertiary }]}>this is how you'll be known</Text>

          <TextInput
            style={[styles.input, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            }]}
            value={input}
            onChangeText={setInput}
            placeholder="username"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            selectionColor={colors.accent}
            returnKeyType="done"
            onSubmitEditing={isValid ? handleSubmit : undefined}
          />

          {input.length > 0 && sanitized !== input && (
            <Text style={[styles.sanitizedHint, { color: colors.textTertiary }]}>{sanitized}</Text>
          )}

          {input.length > 0 && sanitized.length > 0 && sanitized.length < 3 && (
            <Text style={[styles.sanitizedHint, { color: colors.textTertiary }]}>at least 3 characters</Text>
          )}

          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.accent }, !isValid && { opacity: 0.3 }]}
            onPress={handleSubmit}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.continueButtonText, { color: colors.background }]}>Let's go</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// --- Page Indicator Dots ---
function PageDots({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pageDot,
            { backgroundColor: colors.border },
            i === current && { backgroundColor: colors.text, width: 24 },
          ]}
        />
      ))}
    </View>
  );
}

// --- Main Onboarding ---
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const goToPage = useCallback((page: number) => {
    flatListRef.current?.scrollToIndex({ index: page, animated: true });
    setCurrentPage(page);
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentPage(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleComplete = () => {
    router.replace('/(tabs)');
  };

  const screens = [
    { key: 'brand' },
    { key: 'features' },
    { key: 'username' },
  ];

  const renderScreen = ({ item, index }: { item: typeof screens[0]; index: number }) => {
    switch (item.key) {
      case 'brand': return <BrandScreen />;
      case 'features': return <FeaturesScreen />;
      case 'username': return <UsernameScreen onComplete={handleComplete} />;
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={screens}
        renderItem={renderScreen}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEnabled={true}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <PageDots current={currentPage} total={3} />

        {currentPage < 2 && (
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => goToPage(2)}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.accent }]}
              onPress={() => goToPage(currentPage + 1)}
              activeOpacity={0.8}
            >
              <Text style={[styles.nextText, { color: colors.background }]}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Brand screen
  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 90,
    gap: 12,
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  decorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logo: {
    fontFamily: Fonts.accentItalic,
    fontSize: 80,
    letterSpacing: -2,
  },
  tagline: {
    fontFamily: Fonts.accentItalic,
    fontSize: 19,
    marginTop: Spacing.md,
    letterSpacing: 0.5,
  },

  // Features screen
  featuresHeading: {
    fontFamily: Fonts.accentItalic,
    fontSize: 40,
    marginBottom: Spacing.xxl + 8,
  },
  featuresList: {
    width: '100%',
    gap: Spacing.xl + 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  featureIcon: {
    fontSize: 34,
    width: 52,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 19,
    marginBottom: 5,
  },
  featureDesc: {
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },

  // Username screen
  usernameContainer: {
    width: '100%',
    alignItems: 'center',
  },
  usernameHeading: {
    fontFamily: Fonts.accentItalic,
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  usernameSubtext: {
    fontFamily: Fonts.body,
    fontSize: 16,
    marginBottom: Spacing.xxl + 4,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 20,
    fontFamily: Fonts.body,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sanitizedHint: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  continueButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  continueButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 18,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 54,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  nextButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 36,
  },
  nextText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
});
