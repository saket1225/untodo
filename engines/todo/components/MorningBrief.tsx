import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated as RNAnimated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { useTodoStore } from '../store';
import { getLogicalDate } from '../../../lib/date-utils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MORNING_BRIEF_KEY = 'untodo-morning-brief-last-shown';

export default function MorningBrief({ onDismiss }: { onDismiss: () => void }) {
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

    // Calculate streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = allTodos.filter(t => t.logicalDate === dateStr);
      if (dayTodos.some(t => t.completed)) {
        streak++;
      } else if (dayTodos.length > 0) {
        break;
      }
    }

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

  if (!visible) return null;

  return (
    <RNAnimated.View style={[styles.overlay, { opacity }]}>
      <RNAnimated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] }]}>
        <Text style={styles.greeting}>Good morning.</Text>
        <Text style={styles.subtitle}>Here's your day:</Text>

        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Text style={styles.statNumber}>{briefData.total}</Text>
            <Text style={styles.statLabel}>
              task{briefData.total !== 1 ? 's' : ''} today
              {briefData.carriedOver > 0 && (
                <Text style={styles.carriedOver}> ({briefData.carriedOver} carried over)</Text>
              )}
            </Text>
          </View>

          {briefData.streak > 0 && (
            <View style={styles.statRow}>
              <Text style={styles.streakIcon}>🔥</Text>
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

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 32,
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 15,
    marginBottom: Spacing.xl,
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
  statNumber: {
    color: Colors.dark.text,
    fontFamily: Fonts.heading,
    fontSize: 28,
    minWidth: 36,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
    flex: 1,
  },
  carriedOver: {
    color: Colors.dark.timer,
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  streakIcon: {
    fontSize: 22,
    minWidth: 36,
    textAlign: 'center',
  },
  topPriorityContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.dark.border,
  },
  topPriorityLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  topPriorityTask: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
});
