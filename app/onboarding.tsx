import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Dimensions, Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../lib/theme';
import { useUserStore } from '../engines/user/store';
import { useTodoStore } from '../engines/todo/store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [step, setStep] = useState<'splash' | 'username'>('splash');
  const [input, setInput] = useState('');
  const setUsername = useUserStore(s => s.setUsername);
  const addSampleTasks = useTodoStore(s => s.addSampleTasks);
  const router = useRouter();

  // Splash animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(20)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;

  // Username screen animations
  const usernameOpacity = useRef(new Animated.Value(0)).current;
  const usernameTranslateY = useRef(new Animated.Value(40)).current;

  // Splash exit animation
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Staggered entrance: logo -> tagline -> decorative dots -> button
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(logoTranslateY, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const sanitized = input.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');

  const goToUsername = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Animate splash out, username in
    Animated.parallel([
      Animated.timing(splashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(splashScale, { toValue: 0.95, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setStep('username');
      Animated.parallel([
        Animated.timing(usernameOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(usernameTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleSubmit = () => {
    if (!sanitized || sanitized.length < 3) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUsername(sanitized);
    addSampleTasks();
    router.replace('/(tabs)');
  };

  const isValid = sanitized.length >= 3;

  if (step === 'username') {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View style={[
            styles.content,
            { opacity: usernameOpacity, transform: [{ translateY: usernameTranslateY }] },
          ]}>
            <Text style={styles.usernameHeading}>pick a username</Text>
            <Text style={styles.usernameSubtext}>this is how you'll be known</Text>

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
              selectionColor={Colors.dark.accent}
              returnKeyType="done"
              onSubmitEditing={isValid ? handleSubmit : undefined}
            />

            {input.length > 0 && sanitized !== input && (
              <Text style={styles.sanitizedHint}>{sanitized}</Text>
            )}

            {input.length > 0 && sanitized.length > 0 && sanitized.length < 3 && (
              <Text style={styles.sanitizedHint}>at least 3 characters</Text>
            )}

            <TouchableOpacity
              style={[styles.continueButton, !isValid && { opacity: 0.3 }]}
              onPress={handleSubmit}
              disabled={!isValid}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>Let's go</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.splashContent,
        {
          opacity: splashOpacity,
          transform: [{ scale: splashScale }],
        },
      ]}>
        {/* Decorative dot grid */}
        <Animated.View style={[styles.dotGrid, { opacity: dotOpacity }]}>
          {Array.from({ length: 15 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.decorDot,
                i < 5 && { backgroundColor: Colors.dark.textTertiary },
                i >= 5 && i < 10 && { backgroundColor: Colors.dark.border },
                i >= 10 && { backgroundColor: '#1C1C1C' },
              ]}
            />
          ))}
        </Animated.View>

        {/* Logo */}
        <Animated.Text style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] },
        ]}>
          untodo
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Do less. Mean more.
        </Animated.Text>

        {/* Get Started */}
        <Animated.View style={[
          styles.getStartedContainer,
          { opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] },
        ]}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={goToUsername}
            activeOpacity={0.8}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  // Splash screen
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  dotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 90,
    gap: 12,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  decorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.border,
  },
  logo: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 72,
    letterSpacing: -1,
  },
  tagline: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 18,
    marginTop: Spacing.sm,
  },
  getStartedContainer: {
    position: 'absolute',
    bottom: 80,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  getStartedButton: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  getStartedText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
  },
  // Username screen
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  usernameHeading: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  usernameSubtext: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 15,
    marginBottom: Spacing.xxl,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sanitizedHint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  continueButton: {
    width: '100%',
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  continueButtonText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
  },
});
