import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Vibration } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { Todo } from '../types';

interface Preset {
  name: string;
  label: string;
  work: number;
  shortBreak: number;
  longBreak: number;
  sessionsBeforeLong: number;
  isFlowtime?: boolean;
}

const PRESETS: Preset[] = [
  { name: 'spark', label: 'Spark', work: 15, shortBreak: 5, longBreak: 20, sessionsBeforeLong: 4 },
  { name: 'classic', label: 'Classic', work: 25, shortBreak: 5, longBreak: 20, sessionsBeforeLong: 4 },
  { name: 'coder', label: 'Coder 50', work: 50, shortBreak: 10, longBreak: 25, sessionsBeforeLong: 3 },
  { name: 'desktime', label: 'DeskTime', work: 52, shortBreak: 17, longBreak: 30, sessionsBeforeLong: 3 },
  { name: 'deep', label: 'Deep Block', work: 90, shortBreak: 25, longBreak: 30, sessionsBeforeLong: 2 },
  { name: 'flowtime', label: 'Flowtime', work: 0, shortBreak: 0, longBreak: 0, sessionsBeforeLong: 0, isFlowtime: true },
  { name: 'custom', label: 'Custom', work: 25, shortBreak: 5, longBreak: 20, sessionsBeforeLong: 4 },
];

const BREAK_SUGGESTIONS = [
  'Go for a short walk',
  'Drink some water',
  'Stretch your body',
  'Look away from screen - 20/20/20 rule',
  'Do 10 pushups',
  'Step outside for fresh air',
  'Close your eyes and breathe',
  'Splash water on your face',
];

function getFlowBreak(workedMinutes: number): number {
  if (workedMinutes < 25) return 5;
  if (workedMinutes <= 50) return 10;
  if (workedMinutes <= 90) return 15;
  return 25;
}

function randomSuggestion(): string {
  return BREAK_SUGGESTIONS[Math.floor(Math.random() * BREAK_SUGGESTIONS.length)];
}

interface Props {
  todo: Todo;
  visible: boolean;
  onClose: () => void;
}

type Phase = 'work' | 'short-break' | 'long-break';

export default function PomodoroTimer({ todo, visible, onClose }: Props) {
  const initialPresetName = todo.pomodoroPreset || 'classic';
  const initialPreset = PRESETS.find(p => p.name === initialPresetName) || PRESETS[1];

  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [customWork, setCustomWork] = useState(String(initialPreset.work));
  const [customBreak, setCustomBreak] = useState(String(initialPreset.shortBreak));
  const [customLongBreak, setCustomLongBreak] = useState(String(initialPreset.longBreak));

  // Timer state
  const [seconds, setSeconds] = useState(initialPreset.isFlowtime ? 0 : initialPreset.work * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('work');
  const [session, setSession] = useState(1);
  const [breakSuggestion, setBreakSuggestion] = useState(randomSuggestion());

  // Flowtime
  const [flowStartTime, setFlowStartTime] = useState<number | null>(null);
  const [flowElapsed, setFlowElapsed] = useState(0);

  // Session log
  const [showLog, setShowLog] = useState(false);
  const [sessionLog, setSessionLog] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown timer for non-flowtime
  useEffect(() => {
    if (preset.isFlowtime) return;
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (isRunning && seconds === 0) {
      setIsRunning(false);
      clearTimer();
      Vibration.vibrate([0, 500, 200, 500]);
      if (phase === 'work') {
        setShowLog(true);
      } else {
        startWork();
      }
    }
    return clearTimer;
  }, [isRunning, seconds, phase, preset.isFlowtime]);

  // Flowtime count-up
  useEffect(() => {
    if (!preset.isFlowtime) return;
    if (isRunning && phase === 'work') {
      intervalRef.current = setInterval(() => {
        setFlowElapsed(s => s + 1);
      }, 1000);
    } else if (isRunning && phase !== 'work' && seconds > 0) {
      // Break countdown in flowtime
      intervalRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (isRunning && phase !== 'work' && seconds === 0) {
      setIsRunning(false);
      clearTimer();
      Vibration.vibrate([0, 500, 200, 500]);
      startWork();
    }
    return clearTimer;
  }, [isRunning, phase, seconds, preset.isFlowtime, flowElapsed]);

  const startWork = () => {
    setPhase('work');
    if (preset.isFlowtime) {
      setFlowElapsed(0);
      setFlowStartTime(Date.now());
    } else {
      setSeconds(preset.name === 'custom' ? parseInt(customWork) * 60 : preset.work * 60);
    }
    setIsRunning(true);
    setSessionLog('');
  };

  const endFlowSession = () => {
    clearTimer();
    setIsRunning(false);
    const workedMinutes = Math.floor(flowElapsed / 60);
    const breakMins = getFlowBreak(workedMinutes);
    setShowLog(true);
    setSeconds(breakMins * 60);
    setBreakSuggestion(randomSuggestion());
  };

  const startBreak = () => {
    setShowLog(false);
    const isLong = !preset.isFlowtime && session % preset.sessionsBeforeLong === 0;
    setPhase(isLong ? 'long-break' : 'short-break');
    if (!preset.isFlowtime) {
      const breakTime = isLong
        ? (preset.name === 'custom' ? parseInt(customLongBreak) : preset.longBreak)
        : (preset.name === 'custom' ? parseInt(customBreak) : preset.shortBreak);
      setSeconds(breakTime * 60);
    }
    setBreakSuggestion(randomSuggestion());
    setSession(s => s + 1);
    setIsRunning(true);
  };

  const selectPreset = (p: Preset) => {
    clearTimer();
    setIsRunning(false);
    setPreset(p);
    setPhase('work');
    setSession(1);
    setFlowElapsed(0);
    if (p.isFlowtime) {
      setSeconds(0);
    } else if (p.name === 'custom') {
      setSeconds(parseInt(customWork) * 60 || 25 * 60);
    } else {
      setSeconds(p.work * 60);
    }
  };

  const reset = () => {
    clearTimer();
    setIsRunning(false);
    setPhase('work');
    setSession(1);
    setShowLog(false);
    setFlowElapsed(0);
    if (preset.isFlowtime) {
      setSeconds(0);
    } else if (preset.name === 'custom') {
      setSeconds(parseInt(customWork) * 60 || 25 * 60);
    } else {
      setSeconds(preset.work * 60);
    }
  };

  const displayTime = preset.isFlowtime && phase === 'work' ? flowElapsed : seconds;
  const mins = Math.floor(displayTime / 60);
  const secs = displayTime % 60;

  const phaseLabel = phase === 'work'
    ? (preset.isFlowtime ? 'Flow' : 'Focus')
    : phase === 'long-break' ? 'Long Break' : 'Break';

  const phaseColor = phase === 'work' ? Colors.dark.text : Colors.dark.timer;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Task title */}
        <Text style={styles.taskTitle} numberOfLines={2}>{todo.title}</Text>

        {/* Preset selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={styles.presetContainer}
        >
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.name}
              style={[styles.presetChip, preset.name === p.name && styles.presetChipActive]}
              onPress={() => selectPreset(p)}
            >
              <Text style={[styles.presetChipText, preset.name === p.name && styles.presetChipTextActive]}>
                {p.label}
              </Text>
              {!p.isFlowtime && p.name !== 'custom' && (
                <Text style={[styles.presetChipSub, preset.name === p.name && styles.presetChipSubActive]}>
                  {p.work}/{p.shortBreak}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom time inputs */}
        {preset.name === 'custom' && !isRunning && phase === 'work' && (
          <View style={styles.customInputs}>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Work</Text>
              <TextInput
                style={styles.customInput}
                value={customWork}
                onChangeText={v => {
                  setCustomWork(v);
                  const n = parseInt(v);
                  if (n > 0) setSeconds(n * 60);
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.customUnit}>min</Text>
            </View>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Break</Text>
              <TextInput
                style={styles.customInput}
                value={customBreak}
                onChangeText={setCustomBreak}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.customUnit}>min</Text>
            </View>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Long</Text>
              <TextInput
                style={styles.customInput}
                value={customLongBreak}
                onChangeText={setCustomLongBreak}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={styles.customUnit}>min</Text>
            </View>
          </View>
        )}

        {/* Phase label */}
        <Text style={[styles.phase, { color: phaseColor }]}>{phaseLabel}</Text>

        {/* Timer display */}
        <Text style={styles.timer}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </Text>

        {/* Session counter */}
        {!preset.isFlowtime && (
          <Text style={styles.sessionCount}>
            Session {session}{preset.sessionsBeforeLong > 0 ? ` of ${preset.sessionsBeforeLong}` : ''}
          </Text>
        )}

        {/* Break suggestion */}
        {phase !== 'work' && (
          <Text style={styles.breakSuggestion}>{breakSuggestion}</Text>
        )}

        {/* Session log prompt */}
        {showLog && (
          <View style={styles.logContainer}>
            <Text style={styles.logPrompt}>What did you accomplish?</Text>
            <TextInput
              style={styles.logInput}
              value={sessionLog}
              onChangeText={setSessionLog}
              placeholder="One sentence..."
              placeholderTextColor={Colors.dark.textTertiary}
              returnKeyType="done"
              onSubmitEditing={startBreak}
            />
            <TouchableOpacity style={styles.logButton} onPress={startBreak}>
              <Text style={styles.logButtonText}>Start Break</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls */}
        {!showLog && (
          <View style={styles.controls}>
            {preset.isFlowtime && phase === 'work' && isRunning ? (
              <TouchableOpacity style={styles.button} onPress={endFlowSession}>
                <Text style={styles.buttonText}>I lost focus</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={() => setIsRunning(!isRunning)}>
                <Text style={styles.buttonText}>{isRunning ? 'Pause' : 'Start'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={reset}>
              <Text style={styles.buttonSecondaryText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Close */}
        <TouchableOpacity style={styles.closeButton} onPress={() => { clearTimer(); onClose(); }}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  taskTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  presetScroll: {
    maxHeight: 64,
    marginBottom: Spacing.lg,
  },
  presetContainer: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  presetChipText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  presetChipTextActive: {
    color: Colors.dark.background,
  },
  presetChipSub: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  presetChipSubActive: {
    color: Colors.dark.surfaceHover,
  },
  customInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  customField: {
    alignItems: 'center',
  },
  customLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginBottom: 4,
  },
  customInput: {
    backgroundColor: Colors.dark.surface,
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 18,
    width: 56,
    height: 44,
    borderRadius: 10,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  customUnit: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  phase: {
    fontFamily: Fonts.headingMedium,
    fontSize: 18,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  timer: {
    color: Colors.dark.text,
    fontFamily: Fonts.heading,
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  sessionCount: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  breakSuggestion: {
    color: Colors.dark.timer,
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  logContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logPrompt: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.headingMedium,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  logInput: {
    backgroundColor: Colors.dark.surface,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    width: '100%',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
  },
  logButton: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: 12,
  },
  logButtonText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  buttonSecondaryText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  closeText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
});