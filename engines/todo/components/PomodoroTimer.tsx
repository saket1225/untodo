import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../types';

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
}

export default function PomodoroTimer({ todo, visible, onClose }: Props) {
  const workMinutes = todo.pomodoroWork || 25;
  const breakMinutes = todo.pomodoroBreak || 5;

  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => s - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsRunning(false);
      if (!isBreak) {
        setIsBreak(true);
        setSecondsLeft(breakMinutes * 60);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, secondsLeft, isBreak]);

  const reset = () => {
    setIsRunning(false);
    setIsBreak(false);
    setSecondsLeft(workMinutes * 60);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.taskTitle} numberOfLines={1}>{todo.title}</Text>
          <Text style={styles.phase}>{isBreak ? 'Break' : 'Focus'}</Text>
          <Text style={styles.timer}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.button} onPress={() => setIsRunning(!isRunning)}>
              <Text style={styles.buttonText}>{isRunning ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={reset}>
              <Text style={styles.buttonSecondaryText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '85%',
  },
  taskTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  phase: {
    color: Colors.dark.timer,
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  timer: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: Colors.dark.surfaceHover,
  },
  buttonSecondaryText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  closeButton: {
    paddingVertical: Spacing.sm,
  },
  closeText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
});
