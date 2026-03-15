import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Vibration, StatusBar, Dimensions } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { useTheme } from '../../../lib/ThemeContext';
import { Todo } from '../types';
import { sendPomodoroEndNotification } from '../../notifications/service';
import { useTodoStore } from '../store';
import { usePomodoroState } from '../pomodoroState';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// Immersive mode always uses dark colors
const darkColors = Colors.dark;

export default function PomodoroTimer({ todo, visible, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const initialPresetName = todo.pomodoroPreset || 'classic';
  const initialPreset = PRESETS.find(p => p.name === initialPresetName) || PRESETS[1];

  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [customWork, setCustomWork] = useState(String(initialPreset.work));
  const [customBreak, setCustomBreak] = useState(String(initialPreset.shortBreak));
  const [customLongBreak, setCustomLongBreak] = useState(String(initialPreset.longBreak));
  const [totalSessions, setTotalSessions] = useState(initialPreset.sessionsBeforeLong);
  const [customSessions, setCustomSessions] = useState(String(initialPreset.sessionsBeforeLong));

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
  const logPomodoroMinutes = useTodoStore(s => s.logPomodoroMinutes);
  const pomSetActive = usePomodoroState(s => s.setActive);
  const pomUpdateTimer = usePomodoroState(s => s.updateTimer);
  const pomClear = usePomodoroState(s => s.clear);
  const sessionStartRef = useRef<number>(Date.now());

  // Is the timer in active/immersive mode (running or paused mid-session)
  const isActive = isRunning || (session > 1 && phase === 'work') || phase !== 'work';

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
      sendPomodoroEndNotification();
      if (phase === 'work') {
        const worked = Math.round((Date.now() - sessionStartRef.current) / 60000);
        if (worked > 0) logPomodoroMinutes(todo.id, worked);
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
      intervalRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (isRunning && phase !== 'work' && seconds === 0) {
      setIsRunning(false);
      clearTimer();
      Vibration.vibrate([0, 500, 200, 500]);
      sendPomodoroEndNotification();
      startWork();
    }
    return clearTimer;
  }, [isRunning, phase, seconds, preset.isFlowtime, flowElapsed]);

  const startWork = () => {
    sessionStartRef.current = Date.now();
    setPhase('work');
    if (preset.isFlowtime) {
      setFlowElapsed(0);
      setFlowStartTime(Date.now());
    } else {
      setSeconds(preset.name === 'custom' ? (parseInt(customWork) || 25) * 60 : preset.work * 60);
    }
    setIsRunning(true);
    setSessionLog('');
  };

  const endFlowSession = () => {
    clearTimer();
    setIsRunning(false);
    const workedMinutes = Math.floor(flowElapsed / 60);
    if (workedMinutes > 0) logPomodoroMinutes(todo.id, workedMinutes);
    const breakMins = getFlowBreak(workedMinutes);
    setShowLog(true);
    setSeconds(breakMins * 60);
    setBreakSuggestion(randomSuggestion());
  };

  const startBreak = () => {
    setShowLog(false);
    const isLong = !preset.isFlowtime && session >= totalSessions;
    setPhase(isLong ? 'long-break' : 'short-break');
    if (!preset.isFlowtime) {
      const breakTime = isLong
        ? (preset.name === 'custom' ? (parseInt(customLongBreak) || 20) : preset.longBreak)
        : (preset.name === 'custom' ? (parseInt(customBreak) || 5) : preset.shortBreak);
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
    setTotalSessions(p.sessionsBeforeLong);
    setCustomSessions(String(p.sessionsBeforeLong));
    if (p.isFlowtime) {
      setSeconds(0);
    } else if (p.name === 'custom') {
      setSeconds((parseInt(customWork) || 25) * 60);
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
      setSeconds((parseInt(customWork) || 25) * 60);
    } else {
      setSeconds(preset.work * 60);
    }
  };

  const updateSessions = (val: string) => {
    setCustomSessions(val);
    const n = parseInt(val) || 0;
    if (n > 0 && n <= 20) setTotalSessions(n);
  };

  // Editable timer state
  const [editingTime, setEditingTime] = useState(false);
  const [editMins, setEditMins] = useState('');
  const [editSecs, setEditSecs] = useState('');

  const displayTime = preset.isFlowtime && phase === 'work' ? flowElapsed : seconds;
  const mins = Math.floor(displayTime / 60);
  const secs = displayTime % 60;

  const handleTimerTap = () => {
    if (isRunning || preset.isFlowtime) return;
    setEditMins(String(mins));
    setEditSecs(String(secs).padStart(2, '0'));
    setEditingTime(true);
  };

  const applyEditedTime = () => {
    const m = parseInt(editMins) || 0;
    const s = parseInt(editSecs) || 0;
    const total = Math.max(0, m * 60 + s);
    setSeconds(total);
    setEditingTime(false);
  };

  // Sync timer state to global store for header indicator
  useEffect(() => {
    if (isRunning || isActive) {
      pomSetActive(true, todo.title, todo.id);
      pomUpdateTimer(displayTime, phase, preset.isFlowtime);
    } else if (!visible) {
      pomClear();
    }
  }, [isRunning, isActive, displayTime, phase, visible]);

  // Clear global state on unmount
  useEffect(() => {
    return () => { pomClear(); };
  }, []);

  const phaseLabel = phase === 'work'
    ? (preset.isFlowtime ? 'Flow' : 'Focus')
    : phase === 'long-break' ? 'Long Break' : 'Break';

  const phaseColor = phase === 'work' ? darkColors.text : darkColors.timer;

  // Setup screen styles (themed)
  const setupStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    taskTitle: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 16,
      textAlign: 'center',
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
    presetChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    presetChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    presetChipText: {
      color: colors.textSecondary,
      fontFamily: Fonts.bodyMedium,
      fontSize: 13,
    },
    presetChipTextActive: {
      color: colors.background,
    },
    presetChipSub: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 10,
      marginTop: 2,
    },
    presetChipSubActive: {
      color: colors.surfaceHover,
    },
    sessionsLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 14,
      marginRight: Spacing.sm,
    },
    sessionsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sessionsBtnText: {
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 18,
    },
    sessionsInput: {
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 18,
      width: 48,
      height: 36,
      borderRadius: 12,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    customLabel: {
      color: colors.textSecondary,
      fontFamily: Fonts.body,
      fontSize: 11,
      marginBottom: 4,
    },
    customInput: {
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: Fonts.bodyMedium,
      fontSize: 18,
      width: 56,
      height: 44,
      borderRadius: 12,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    customUnit: {
      color: colors.textTertiary,
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
      color: colors.text,
      fontFamily: Fonts.heading,
      fontSize: 72,
      marginBottom: Spacing.md,
      textAlign: 'center',
      includeFontPadding: false,
    },
    timerEditInput: {
      color: colors.text,
      fontFamily: Fonts.heading,
      fontSize: 60,
      textAlign: 'center',
      width: 100,
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
      paddingVertical: 4,
      includeFontPadding: false,
    },
    timerEditColon: {
      color: colors.text,
      fontFamily: Fonts.heading,
      fontSize: 60,
      includeFontPadding: false,
    },
    timerEditDone: {
      marginLeft: 12,
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    timerEditDoneText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 15,
    },
    sessionCount: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 13,
      marginBottom: Spacing.sm,
    },
    logPrompt: {
      color: colors.textSecondary,
      fontFamily: Fonts.headingMedium,
      fontSize: 16,
      marginBottom: Spacing.sm,
    },
    logInput: {
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: Fonts.body,
      fontSize: 15,
      width: '100%',
      height: 48,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    logButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: 12,
    },
    logButtonText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 14,
    },
    buttonText: {
      color: colors.background,
      fontFamily: Fonts.bodyMedium,
      fontSize: 16,
    },
    closeText: {
      color: colors.textTertiary,
      fontFamily: Fonts.body,
      fontSize: 15,
    },
  }), [colors]);

  // Fullscreen immersive view when timer is active (always dark)
  if (isActive && !showLog) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
        <StatusBar hidden />
        <TouchableOpacity
          style={immersiveStyles.container}
          activeOpacity={1}
          onPress={() => { if (isRunning) setIsRunning(false); }}
        >
          {/* Phase label */}
          <Text style={[immersiveStyles.phase, { color: phaseColor }]}>{phaseLabel}</Text>

          {/* Giant timer */}
          <Text style={immersiveStyles.timer}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>

          {/* Task title */}
          <Text style={immersiveStyles.task} numberOfLines={1}>{todo.title}</Text>

          {/* Session counter */}
          {!preset.isFlowtime && (
            <Text style={immersiveStyles.session}>
              {session} / {totalSessions}
            </Text>
          )}

          {/* Break suggestion */}
          {phase !== 'work' && (
            <Text style={immersiveStyles.breakSuggestion}>{breakSuggestion}</Text>
          )}

          {/* Controls - show when paused */}
          {!isRunning && (
            <View style={immersiveStyles.controls}>
              <TouchableOpacity style={immersiveStyles.button} onPress={() => setIsRunning(true)}>
                <Text style={immersiveStyles.buttonText}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[immersiveStyles.button, immersiveStyles.buttonSecondary]} onPress={reset}>
                <Text style={immersiveStyles.buttonSecondaryText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[immersiveStyles.button, immersiveStyles.buttonSecondary]} onPress={() => { clearTimer(); onClose(); }}>
                <Text style={immersiveStyles.buttonSecondaryText}>Exit</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Flowtime: I lost focus button */}
          {preset.isFlowtime && phase === 'work' && isRunning && (
            <TouchableOpacity style={immersiveStyles.lostFocusButton} onPress={endFlowSession}>
              <Text style={immersiveStyles.lostFocusText}>I lost focus</Text>
            </TouchableOpacity>
          )}

          {/* Tap to pause hint */}
          {isRunning && !preset.isFlowtime && (
            <Text style={immersiveStyles.hint}>tap to pause</Text>
          )}
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <StatusBar hidden={false} barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={setupStyles.container}>
        {/* Task title */}
        <Text style={setupStyles.taskTitle} numberOfLines={2}>{todo.title}</Text>

        {/* Preset selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={staticStyles.presetScroll}
          contentContainerStyle={staticStyles.presetContainer}
        >
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.name}
              style={[setupStyles.presetChip, preset.name === p.name && setupStyles.presetChipActive]}
              onPress={() => selectPreset(p)}
            >
              <Text style={[setupStyles.presetChipText, preset.name === p.name && setupStyles.presetChipTextActive]}>
                {p.label}
              </Text>
              {!p.isFlowtime && p.name !== 'custom' && (
                <Text style={[setupStyles.presetChipSub, preset.name === p.name && setupStyles.presetChipSubActive]}>
                  {p.work}/{p.shortBreak}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sessions editor */}
        {!preset.isFlowtime && (
          <View style={staticStyles.sessionsRow}>
            <Text style={setupStyles.sessionsLabel}>Sessions</Text>
            <TouchableOpacity
              style={setupStyles.sessionsBtn}
              onPress={() => { const n = Math.max(1, totalSessions - 1); setTotalSessions(n); setCustomSessions(String(n)); }}
            >
              <Text style={setupStyles.sessionsBtnText}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={setupStyles.sessionsInput}
              value={customSessions}
              onChangeText={updateSessions}
              keyboardType="number-pad"
              maxLength={2}
            />
            <TouchableOpacity
              style={setupStyles.sessionsBtn}
              onPress={() => { const n = totalSessions + 1; setTotalSessions(n); setCustomSessions(String(n)); }}
            >
              <Text style={setupStyles.sessionsBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Custom time inputs */}
        {preset.name === 'custom' && (
          <View style={staticStyles.customInputs}>
            <View style={staticStyles.customField}>
              <Text style={setupStyles.customLabel}>Work</Text>
              <TextInput
                style={setupStyles.customInput}
                value={customWork}
                onChangeText={v => {
                  setCustomWork(v);
                  const n = parseInt(v) || 0;
                  if (n > 0) setSeconds(n * 60);
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={setupStyles.customUnit}>min</Text>
            </View>
            <View style={staticStyles.customField}>
              <Text style={setupStyles.customLabel}>Break</Text>
              <TextInput
                style={setupStyles.customInput}
                value={customBreak}
                onChangeText={setCustomBreak}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={setupStyles.customUnit}>min</Text>
            </View>
            <View style={staticStyles.customField}>
              <Text style={setupStyles.customLabel}>Long</Text>
              <TextInput
                style={setupStyles.customInput}
                value={customLongBreak}
                onChangeText={setCustomLongBreak}
                keyboardType="number-pad"
                maxLength={3}
              />
              <Text style={setupStyles.customUnit}>min</Text>
            </View>
          </View>
        )}

        {/* Phase label */}
        <Text style={[setupStyles.phase, { color: phase === 'work' ? colors.text : colors.timer }]}>{phaseLabel}</Text>

        {/* Timer display - tap to edit */}
        {editingTime ? (
          <View style={staticStyles.timerEditRow}>
            <TextInput
              style={setupStyles.timerEditInput}
              value={editMins}
              onChangeText={setEditMins}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              selectTextOnFocus
            />
            <Text style={setupStyles.timerEditColon}>:</Text>
            <TextInput
              style={setupStyles.timerEditInput}
              value={editSecs}
              onChangeText={setEditSecs}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
              onSubmitEditing={applyEditedTime}
            />
            <TouchableOpacity style={setupStyles.timerEditDone} onPress={applyEditedTime}>
              <Text style={setupStyles.timerEditDoneText}>Set</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleTimerTap} activeOpacity={0.7}>
            <Text style={setupStyles.timer}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Session counter */}
        {!preset.isFlowtime && (
          <Text style={setupStyles.sessionCount}>
            Session {session} of {totalSessions}
          </Text>
        )}

        {/* Session log prompt */}
        {showLog && (
          <View style={staticStyles.logContainer}>
            <Text style={setupStyles.logPrompt}>What did you accomplish?</Text>
            <TextInput
              style={setupStyles.logInput}
              value={sessionLog}
              onChangeText={setSessionLog}
              placeholder="One sentence..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={startBreak}
            />
            <TouchableOpacity style={setupStyles.logButton} onPress={startBreak}>
              <Text style={setupStyles.logButtonText}>Start Break</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Controls */}
        {!showLog && (
          <View style={staticStyles.controls}>
            <TouchableOpacity style={setupStyles.button} onPress={() => setIsRunning(true)}>
              <Text style={setupStyles.buttonText}>Start</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Close */}
        <TouchableOpacity style={staticStyles.closeButton} onPress={() => { clearTimer(); onClose(); }}>
          <Text style={setupStyles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Static styles that don't depend on theme
const staticStyles = StyleSheet.create({
  presetScroll: {
    maxHeight: 64,
    marginBottom: Spacing.md,
  },
  presetContainer: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  sessionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  customInputs: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  customField: {
    alignItems: 'center',
  },
  timerEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  logContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});

// Immersive styles are always dark
const immersiveStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phase: {
    fontFamily: Fonts.headingMedium,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: Spacing.lg,
  },
  timer: {
    color: darkColors.text,
    fontFamily: Fonts.heading,
    fontSize: 96,
    marginBottom: Spacing.md,
    textAlign: 'center',
    includeFontPadding: false,
  },
  task: {
    color: darkColors.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  session: {
    color: darkColors.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  breakSuggestion: {
    color: darkColors.timer,
    fontFamily: Fonts.accentItalic,
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    backgroundColor: darkColors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: darkColors.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: darkColors.surface,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  buttonSecondaryText: {
    color: darkColors.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
  },
  hint: {
    position: 'absolute',
    bottom: 60,
    color: darkColors.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    opacity: 0.5,
  },
  lostFocusButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: 28,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  lostFocusText: {
    color: darkColors.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
});
