import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert, Animated as RNAnimated, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts, Spacing, type ColorPalette, type ThemeMode } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import {
  generatePairingCode,
  getSiliconConnection,
  disconnectSilicon,
} from '../../engines/silicon/bridge';
import { SiliconConnection } from '../../engines/silicon/types';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../engines/user/store';
import { useNotificationStore } from '../../engines/notifications/store';
import { useTodoStore } from '../../engines/todo/store';
import { useWallpaperStore } from '../../engines/wallpaper/store';
import { useProgressStore } from '../../engines/progress/store';
import { useAchievementStore } from '../../engines/achievements/store';
import { useMilestoneStore } from '../../engines/milestones/store';
import { setupDefaultNotifications } from '../../engines/notifications/service';
import ErrorBoundary from '../../components/ErrorBoundary';
import Constants from 'expo-constants';

function SectionCard({ children, style, colors }: { children: React.ReactNode; style?: any; colors: ColorPalette }) {
  return (
    <View style={[{
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
      overflow: 'hidden' as const,
    }, style]}>
      {children}
    </View>
  );
}

// Pulsing dot animation for "listening" state
function PulsingDot({ size = 8, colors }: { size?: number; colors: ColorPalette }) {
  const pulse = useRef(new RNAnimated.Value(0.4)).current;

  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <RNAnimated.View style={[{ backgroundColor: colors.success }, { opacity: pulse, width: size, height: size, borderRadius: size / 2 }]} />
  );
}

// Pulsing ring animation for listening state
function PulsingRing({ colors }: { colors: ColorPalette }) {
  const scale = useRef(new RNAnimated.Value(1)).current;
  const opacity = useRef(new RNAnimated.Value(0.6)).current;

  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.timing(scale, { toValue: 1.8, duration: 1500, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <RNAnimated.View
      style={{
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: colors.success,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function ThemeDropdown({ mode, setTheme, colors }: { mode: ThemeMode; setTheme: (m: ThemeMode) => void; colors: ColorPalette }) {
  const [expanded, setExpanded] = useState(false);
  const currentLabel = THEME_OPTIONS.find(o => o.value === mode)?.label ?? 'System';

  return (
    <View style={{ zIndex: 1000 }}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(e => !e);
        }}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{
          fontFamily: Fonts.body,
          fontSize: 15,
          color: colors.textSecondary,
        }}>{currentLabel}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{
          position: 'absolute',
          top: 32,
          right: 0,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 20,
          zIndex: 1000,
          minWidth: 120,
          overflow: 'hidden' as const,
        }}>
          {THEME_OPTIONS.map((opt, i) => {
            const isActive = mode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTheme(opt.value);
                  setExpanded(false);
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: isActive ? colors.background : 'transparent',
                  borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: colors.border,
                }}
                activeOpacity={0.7}
              >
                <Text style={{
                  fontFamily: isActive ? Fonts.bodyMedium : Fonts.body,
                  fontSize: 14,
                  color: isActive ? colors.text : colors.textSecondary,
                }}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SettingsScreenContent() {
  const router = useRouter();
  const { colors, isDark, mode, setTheme } = useTheme();
  const [resetHour, setResetHour] = useState(5);

  // Staggered section entrance animations
  const NUM_SECTIONS = 6;
  const sectionAnims = useRef(
    Array.from({ length: NUM_SECTIONS }, () => ({
      opacity: new RNAnimated.Value(0),
      translateY: new RNAnimated.Value(12),
    }))
  ).current;
  useEffect(() => {
    sectionAnims.forEach((anim, i) => {
      setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(anim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(anim.translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }, i * 60);
    });
  }, []);
  const [silicon, setSilicon] = useState<SiliconConnection | null>(null);
  const [siliconLoading, setSiliconLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const username = useUserStore(s => s.username);
  const notifPrefs = useNotificationStore(s => s.preferences);
  const updateNotifPref = useNotificationStore(s => s.updatePreference);
  const allTodos = useTodoStore(s => s.todos);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const totalCompleted = useMemo(() => allTodos.filter(t => t.completed).length, [allTodos]);
  const totalTasks = allTodos.length;

  useEffect(() => {
    const checkConnection = () => {
      getSiliconConnection().then(conn => {
        if (conn) {
          setSilicon(conn);
          setPairingCode(conn.pairingCode);
        }
        setSiliconLoading(false);
      });
    };
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!silicon?.connected && !pairingCode) {
      setPairingCode(generatePairingCode());
    }
  }, [silicon]);

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await Clipboard.setStringAsync(pairingCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Silicon?',
      'Silicon will no longer be able to sync with your tasks. You\'ll need to pair again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await disconnectSilicon();
            setSilicon(null);
            const newCode = generatePairingCode();
            setPairingCode(newCode);
            setShowCode(false);
          },
        },
      ]
    );
  };

  const handleNotifToggle = async (key: keyof typeof notifPrefs, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateNotifPref(key, value);
    setTimeout(() => setupDefaultNotifications(), 100);
  };

  const handleResetAllData = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete all your tasks, progress, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'untodo-todos',
                'untodo-progress',
                'untodo-wallpaper',
                'untodo-notifications',
                'untodo-user',
                'untodo-silicon-connection',
              ]);
              Alert.alert('Data cleared', 'Restart the app for changes to take effect.');
            } catch {
              Alert.alert('Error', 'Failed to clear data.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      'This will remove all your data and start fresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await AsyncStorage.clear();
              // Reset all zustand stores to initial state
              useUserStore.setState({ username: null, _hydrated: true });
              useTodoStore.persist.clearStorage();
              useWallpaperStore.persist.clearStorage();
              useProgressStore.persist.clearStorage();
              useNotificationStore.persist.clearStorage();
              useAchievementStore.persist.clearStorage();
              useMilestoneStore.persist.clearStorage();
              router.replace('/onboarding');
            } catch {
              Alert.alert('Error', 'Failed to log out.');
            }
          },
        },
      ]
    );
  };

  const handleCopyMessage = async () => {
    try {
      await Clipboard.setStringAsync(`Connect to my untodo app. My username is @${username}. Read the docs at untodo-docs.vercel.app/docs.html`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch {}
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let data: string;
      if (format === 'json') {
        data = JSON.stringify(allTodos, null, 2);
      } else {
        const header = 'Date,Title,Completed,Priority,Category,Created\n';
        const rows = allTodos.map(t =>
          `"${t.logicalDate}","${t.title.replace(/"/g, '""')}",${t.completed},"${t.priority || ''}","${t.category || ''}","${t.createdAt}"`
        ).join('\n');
        data = header + rows;
      }
      await Share.share({ message: data, title: `untodo-export.${format}` });
    } catch {
      // User cancelled share
    }
  };

  const isConnected = silicon?.connected;

  const switchTrackColor = { false: colors.background, true: colors.textSecondary };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <RNAnimated.View style={{ opacity: sectionAnims[0].opacity, transform: [{ translateY: sectionAnims[0].translateY }] }}>
        <Text style={{
          color: colors.text,
          fontFamily: Fonts.accentItalic,
          fontSize: 36,
          paddingTop: Spacing.lg,
          marginBottom: Spacing.lg,
          letterSpacing: -0.5,
        }} accessibilityRole="header">Settings</Text>

        {/* Account */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>ACCOUNT</Text>
        <SectionCard colors={colors}>
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Username</Text>
            <Text style={{ color: colors.accent, fontFamily: Fonts.accent, fontSize: 20 }} accessibilityLabel={`Username: ${username}`}>@{username}</Text>
          </View>
        </SectionCard>
        </RNAnimated.View>

        <RNAnimated.View style={{ opacity: sectionAnims[1].opacity, transform: [{ translateY: sectionAnims[1].translateY }], zIndex: 1000 }}>
        {/* Preferences */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>PREFERENCES</Text>
        <SectionCard colors={colors} style={{ overflow: 'visible' as const, zIndex: 1000 }}>
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Day resets at</Text>
            <View style={s.resetTimeRow}>
              <TouchableOpacity
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: colors.background,
                  justifyContent: 'center' as const, alignItems: 'center' as const,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setResetHour(h => Math.max(0, h - 1));
                }}
                accessibilityLabel="Decrease reset hour"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: colors.text, fontSize: 18, fontFamily: Fonts.body }}>-</Text>
              </TouchableOpacity>
              <Text style={{
                color: colors.text, fontFamily: Fonts.accent, fontSize: 20,
                minWidth: 56, textAlign: 'center' as const,
              }} accessibilityLabel={`Reset time: ${String(resetHour).padStart(2, '0')}:00`}>{String(resetHour).padStart(2, '0')}:00</Text>
              <TouchableOpacity
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: colors.background,
                  justifyContent: 'center' as const, alignItems: 'center' as const,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setResetHour(h => Math.min(12, h + 1));
                }}
                accessibilityLabel="Increase reset hour"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ color: colors.text, fontSize: 18, fontFamily: Fonts.body }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Theme</Text>
            <ThemeDropdown mode={mode} setTheme={setTheme} colors={colors} />
          </View>
        </SectionCard>
        </RNAnimated.View>

        <RNAnimated.View style={{ opacity: sectionAnims[2].opacity, transform: [{ translateY: sectionAnims[2].translateY }] }}>
        {/* Notifications */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>NOTIFICATIONS</Text>
        <SectionCard colors={colors}>
          {([
            { key: 'morningReminder' as const, label: 'Morning motivation', time: '10:00 AM' },
            { key: 'afternoonCheck' as const, label: 'Afternoon check', time: '3:00 PM' },
            { key: 'eveningReminder' as const, label: 'Evening reminder', time: '9:00 PM' },
            { key: 'progressNotification' as const, label: 'Progress summary', time: 'Persistent · updates live' },
            { key: 'weeklySummary' as const, label: 'Weekly summary', time: 'Sunday · 7:00 PM' },
          ] as const).map((item, i, arr) => (
            <View key={item.key}>
              <View style={s.notifRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>{item.label}</Text>
                  <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 12, marginTop: 2 }}>{item.time}</Text>
                </View>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={v => handleNotifToggle(item.key, v)}
                  trackColor={switchTrackColor}
                  thumbColor={notifPrefs[item.key] ? colors.accent : colors.textTertiary}
                  accessibilityLabel={`${item.label} notification`}
                  accessibilityRole="switch"
                />
              </View>
              {i < arr.length - 1 && (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
              )}
            </View>
          ))}
        </SectionCard>
        </RNAnimated.View>

        <RNAnimated.View style={{ opacity: sectionAnims[3].opacity, transform: [{ translateY: sectionAnims[3].translateY }] }}>
        {/* Silicon Connection */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>SILICON</Text>
        <SectionCard colors={colors} style={{
          borderColor: colors.textTertiary + '44',
          padding: Spacing.lg,
          overflow: 'visible' as const,
        }}>
          {siliconLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
              <RNAnimated.View style={{ opacity: 0.5 }}>
                <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 14 }}>Checking connection...</Text>
              </RNAnimated.View>
            </View>
          ) : isConnected ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md }}>
                <View style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: colors.success,
                    justifyContent: 'center' as const, alignItems: 'center' as const,
                  }}>
                    <Text style={{ color: colors.background, fontSize: 20, fontWeight: '700' }}>✓</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 17 }}>Silicon Connected</Text>
                  <Text style={{ color: colors.success, fontFamily: Fonts.body, fontSize: 13, marginTop: 2 }}>Syncing in real-time</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleDisconnect();
                }}
                accessibilityLabel="Disconnect Silicon"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.error, fontFamily: Fonts.body, fontSize: 14, opacity: 0.8, marginTop: Spacing.xs }}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Step 1 */}
              <View style={s.flowStep}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                  justifyContent: 'center' as const, alignItems: 'center' as const,
                }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 12 }}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15 }}>Read the docs</Text>
                  <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 12, marginTop: 2 }}>Send Silicon to the untodo docs</Text>
                </View>
              </View>
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: colors.background, borderRadius: 12,
                  paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
                  borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.sm,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL('https://untodo-docs.vercel.app/docs.html');
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.accent, fontFamily: Fonts.bodyMedium, fontSize: 15 }}>untodo-docs.vercel.app</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 16 }}>↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: colors.background, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.xs }}
                onPress={handleCopyMessage}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSecondary, fontFamily: Fonts.accentItalic, fontSize: 13, lineHeight: 20 }}>
                  {messageCopied ? 'Copied!' : `Tell Silicon: "Connect to my untodo app. My username is @${username}. Read the docs at untodo-docs.vercel.app/docs.html"`}
                </Text>
              </TouchableOpacity>

              {/* Step 2 */}
              <View style={[s.flowStep, { marginTop: Spacing.lg }]}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                  justifyContent: 'center' as const, alignItems: 'center' as const,
                }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 12 }}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15 }}>Share your code</Text>
                  <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 12, marginTop: 2 }}>Silicon will ask for it after reading the docs</Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  alignSelf: 'flex-start' as const,
                  paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
                  backgroundColor: colors.background, borderRadius: 8,
                  borderWidth: 1, borderColor: colors.border,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCode(!showCode);
                }}
                activeOpacity={0.7}
                accessibilityLabel={showCode ? 'Hide pairing code' : 'Reveal pairing code'}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 13 }}>
                  {showCode ? 'Hide code' : 'Tap to reveal code'}
                </Text>
              </TouchableOpacity>

              {showCode && pairingCode && (
                <View style={{
                  alignItems: 'center' as const,
                  backgroundColor: colors.background, borderRadius: 16,
                  paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, marginTop: Spacing.md,
                }}>
                  <Text style={{
                    color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 11,
                    textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: Spacing.sm,
                  }}>Your pairing code</Text>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <Text style={{ color: colors.accent, fontFamily: Fonts.accent, fontSize: 44, letterSpacing: 8, marginBottom: Spacing.md }}>{pairingCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{
                    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                    borderRadius: 8, paddingHorizontal: Spacing.lg, paddingVertical: 8, marginBottom: Spacing.sm,
                  }} onPress={handleCopyCode}>
                    <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 13 }}>{copied ? 'Copied!' : 'Copy code'}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: colors.textTertiary, fontFamily: Fonts.body, fontSize: 12, marginTop: Spacing.xs }}>
                    Username: @{username}
                  </Text>
                </View>
              )}

              {/* Step 3 */}
              <View style={[s.flowStep, { marginTop: Spacing.lg }]}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
                  justifyContent: 'center' as const, alignItems: 'center' as const,
                }}>
                  <Text style={{ color: colors.text, fontFamily: Fonts.bodyMedium, fontSize: 12 }}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
                      <PulsingRing colors={colors} />
                      <PulsingDot size={12} colors={colors} />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontFamily: Fonts.body, fontSize: 14 }}>Listening for Silicon...</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </SectionCard>
        </RNAnimated.View>

        <RNAnimated.View style={{ opacity: sectionAnims[4].opacity, transform: [{ translateY: sectionAnims[4].translateY }] }}>
        {/* About */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>ABOUT</Text>
        <SectionCard colors={colors}>
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Version</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: Fonts.body, fontSize: 15 }}>{appVersion}</Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Tasks completed</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: Fonts.body, fontSize: 15 }}>{totalCompleted} / {totalTasks}</Text>
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
          <View style={s.cardRow}>
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Made with</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: Fonts.accentItalic, fontSize: 15 }}>Silicon</Text>
          </View>
        </SectionCard>
        </RNAnimated.View>

        <RNAnimated.View style={{ opacity: sectionAnims[5].opacity, transform: [{ translateY: sectionAnims[5].translateY }] }}>
        {/* Data */}
        <Text style={{
          color: colors.textSecondary,
          fontFamily: Fonts.headingMedium,
          fontSize: 13,
          letterSpacing: 1,
          marginBottom: Spacing.sm,
          marginTop: Spacing.md,
          paddingHorizontal: Spacing.xs,
        }}>DATA</Text>
        <SectionCard colors={colors}>
          <TouchableOpacity
            style={s.cardRow}
            onPress={() => handleExportData('json')}
            accessibilityLabel="Export as JSON"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Export as JSON</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 16 }}>↗</Text>
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
          <TouchableOpacity
            style={s.cardRow}
            onPress={() => handleExportData('csv')}
            accessibilityLabel="Export as CSV"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.text, fontFamily: Fonts.body, fontSize: 15 }}>Export as CSV</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 16 }}>↗</Text>
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: Spacing.md }} />
          <TouchableOpacity
            style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: Spacing.md, paddingVertical: 14,
            }}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              handleResetAllData();
            }}
            accessibilityLabel="Reset all data"
            accessibilityRole="button"
            accessibilityHint="Permanently deletes all tasks, progress, and settings"
          >
            <Text style={{ color: colors.error, fontFamily: Fonts.bodyMedium, fontSize: 15 }}>Reset All Data</Text>
            <Text style={{ color: colors.error, fontSize: 16, opacity: 0.5 }}>→</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Log Out */}
        <TouchableOpacity
          style={{ alignItems: 'center' as const, paddingVertical: Spacing.md, marginTop: Spacing.lg }}
          onPress={handleLogout}
          accessibilityLabel="Log out"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.error, fontFamily: Fonts.body, fontSize: 15 }}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
        </RNAnimated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SettingsScreen() {
  return (
    <ErrorBoundary>
      <SettingsScreenContent />
    </ErrorBoundary>
  );
}

// Static layout-only styles (no colors)
const s = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  resetTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
});
