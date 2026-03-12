import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing } from '../lib/theme';
import { useUserStore } from '../engines/user/store';

export default function OnboardingScreen() {
  const [input, setInput] = useState('');
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
    setUsername(sanitized);
    router.replace('/(tabs)');
  };

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
          <Text style={styles.buttonText}>Get Started</Text>
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
