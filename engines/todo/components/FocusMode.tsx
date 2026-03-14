import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions,
  Animated, StatusBar, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Extra celebration messages for focus mode completion
const FOCUS_CELEBRATIONS = [
  'Deep work pays off.',
  'Locked in. Shipped.',
  'That focus was surgical.',
  'Distractions: 0. You: 1.',
  'Flow state activated.',
  'One task, full attention. Respect.',
  'Focused and done. Beautiful.',
  'No multitasking. Just mastery.',
];

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

// Focus mode completion celebration
function FocusCelebration({ visible, message, focusTime }: { visible: boolean; message: string; focusTime: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(0);
    ringScale.setValue(0.5);
    ringOpacity.setValue(0.8);

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 3, duration: 1200, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]).start();

    // Celebration haptic pattern
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 500);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[celebStyles.container, { opacity }]}>
      {/* Expanding ring */}
      <Animated.View style={[celebStyles.ring, {
        transform: [{ scale: ringScale }],
        opacity: ringOpacity,
      }]} />
      <Animated.View style={[celebStyles.content, { transform: [{ scale }] }]}>
        <Text style={celebStyles.checkmark}>✓</Text>
        <Text style={celebStyles.title}>Focused & Done</Text>
        <Text style={celebStyles.message}>{message}</Text>
        {focusTime > 0 && (
          <Text style={celebStyles.time}>{formatTime(focusTime)} of deep focus</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const celebStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    zIndex: 10,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.dark.success,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  checkmark: {
    fontSize: 64,
    color: Colors.dark.success,
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 32,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  time: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    marginTop: Spacing.lg,
  },
});

export default function FocusMode({ todo, visible, onClose, onComplete }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebMessage, setCelebMessage] = useState('');
  const startTimeRef = useRef(Date.now());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const taskScale = useRef(new Animated.Value(0.95)).current;
  const breatheAnim = useRef(new Animated.Value(0.3)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Swipe down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 20 && Math.abs(gs.dx) < 30,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start(() => {
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    })
  ).current;

  // Timer
  useEffect(() => {
    if (!visible || showCelebration) return;
    startTimeRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, showCelebration]);

  // Entry animation
  useEffect(() => {
    if (!visible) return;
    fadeAnim.setValue(0);
    taskScale.setValue(0.95);
    translateY.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(taskScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    // Subtle breathing animation on the dot
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [visible]);

  const handleComplete = useCallback(() => {
    const msg = FOCUS_CELEBRATIONS[Math.floor(Math.random() * FOCUS_CELEBRATIONS.length)];
    setCelebMessage(msg);
    setShowCelebration(true);

    // Auto-dismiss after 2.5s
    setTimeout(() => {
      onComplete();
      onClose();
    }, 2500);
  }, [onComplete, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <Animated.View
        style={[styles.container, {
          opacity: fadeAnim,
          transform: [{ translateY }],
        }]}
        {...panResponder.panHandlers}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Swipe indicator */}
        <View style={styles.swipeIndicator} />

        {/* Main content - vertically centered */}
        <View style={styles.centerContent}>
          {/* Breathing dot */}
          <Animated.View style={[styles.breatheDot, { opacity: breatheAnim }]} />

          {/* Task name */}
          <Animated.Text
            style={[styles.taskTitle, { transform: [{ scale: taskScale }] }]}
            numberOfLines={3}
          >
            {todo.title}
          </Animated.Text>

          {/* Timer */}
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>

          {/* Subtle label */}
          <Text style={styles.focusLabel}>focused</Text>
        </View>

        {/* Done button at bottom */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={handleComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>

        {/* Focus celebration overlay */}
        <FocusCelebration
          visible={showCelebration}
          message={celebMessage}
          focusTime={elapsed}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
  },
  swipeIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.textTertiary,
    opacity: 0.3,
    marginTop: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  breatheDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.text,
    marginBottom: Spacing.xxl,
  },
  taskTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 40,
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  timer: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 48,
    marginTop: Spacing.xxl,
    letterSpacing: 2,
  },
  focusLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: Spacing.sm,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.4,
  },
  doneBtn: {
    width: SCREEN_WIDTH * 0.85,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Colors.dark.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  doneBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
    letterSpacing: 1,
  },
});
