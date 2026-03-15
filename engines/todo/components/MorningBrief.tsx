import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated as RNAnimated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
import { useTodoStore } from '../store';
import { getLogicalDate } from '../../../lib/date-utils';
import { calculateStreak } from '../../../lib/streak';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MORNING_BRIEF_KEY = 'untodo-morning-brief-last-shown';

export default function MorningBrief({ onDismiss }: { onDismiss: () => void }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const cardTranslate = useRef(new RNAnimated.Value(40)).current;
  const cardOpacity = useRef(new RNAnimated.Value(0)).current;

  const allTodos = useTodoStore(s => s.todos);
  const logicalDate = getLogicalDate();

  const briefData = useMemo(() => {
    const todayTodos = allTodos.filter(t => t.logicalDate === logicalDate);
    const total = todayTodos.length;
    const carriedOver = todayTodos.filter(t => t.carriedOverFrom).length;
    const topPriority = todayTodos
      .filter(t => !t.completed)
      .sort((a, b) => {
        const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
        const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
        return pa - pb;
      })[0];

    const streak = calculateStreak(allTodos);

    return { total, carriedOver, streak, topPriority };
  }, [allTodos, logicalDate]);

  useEffect(() => {
    let mounted = true;

    // Only show between 5am-12pm
    const hour = new Date().getHours();
    if (hour < 5 || hour >= 12) return;

    // Only show once per day
    AsyncStorage.getItem(MORNING_BRIEF_KEY).then(lastShown => {
      if (!mounted) return;
      if (lastShown === logicalDate) return;

      // Only show if there are tasks
      if (briefData.total === 0) return;

      setVisible(true);
      AsyncStorage.setItem(MORNING_BRIEF_KEY, logicalDate);

      // Animate in
      RNAnimated.parallel([
        RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.sequence([
          RNAnimated.delay(150),
          RNAnimated.parallel([
            RNAnimated.spring(cardTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
            RNAnimated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });

    return () => { mounted = false; };
  }, [logicalDate, briefData.total]);

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      RNAnimated.timing(cardTranslate, { toValue: -30, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      onDismiss();
    });
  };

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      marginHorizontal: Spacing.xl,
      width: '85%',
      maxWidth: 360,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.6,
      shadowRadius: 32,
      elevation: 32,
    },
    greeting: {
      color: colors.text,
      fontFamily: Fonts.accentItalic,
      fontSize: 32,
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 15,
      marginBottom: Spacing.xl,
    },
    statNumber: {
      color: colors.text,
      fontFamily: Fonts.heading,
      fontSize: 28,
      minWidth: 36,
    },
    statLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 15,
      flex: 1,
    },
    carriedOver: {
      color: colors.timer,
      fontFamily: Fonts.body,
      fontSize: 13,
    },
    topPriorityContainer: {
      marginTop: Spacing.sm,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    topPriorityLabel: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    topPriorityTask: {
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 16,
      lineHeight: 22,
    },
    button: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    buttonText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 16,
    },
  }), [colors]);

  if (!visible) return null;

  return (
    <RNAnimated.View style={[staticStyles.overlay, { opacity }]}>
      <RNAnimated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
        <Text style={styles.greeting}>Good morning.</Text>
        <Text style={styles.subtitle}>Here's your day:</Text>

        <View style={staticStyles.statsContainer}>
          <View style={staticStyles.statRow}>
            <Text style={styles.statNumber}>{briefData.total}</Text>
            <Text style={styles.statLabel}>
              task{briefData.total !== 1 ? 's' : ''} today
              {briefData.carriedOver > 0 && (
                <Text style={styles.carriedOver}> ({briefData.carriedOver} carried over)</Text>
              )}
            </Text>
          </View>

          {briefData.streak > 0 && (
            <View style={staticStyles.statRow}>
              <Text style={staticStyles.streakIcon}>🔥</Text>
              <Text style={styles.statLabel}>
                {briefData.streak} day streak
              </Text>
            </View>
          )}

          {briefData.topPriority && (
            <View style={styles.topPriorityContainer}>
              <Text style={styles.topPriorityLabel}>Top priority</Text>
              <Text style={styles.topPriorityTask} numberOfLines={2}>
                {briefData.topPriority.title}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={dismiss} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Let's go</Text>
        </TouchableOpacity>
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakIcon: {
    fontSize: 22,
    minWidth: 36,
    textAlign: 'center',
  },
});
