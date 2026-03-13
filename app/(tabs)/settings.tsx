import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert, Animated as RNAnimated, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import {
  generatePairingCode,
  getSiliconConnection,
  disconnectSilicon,
} from '../../engines/silicon/bridge';
import { SiliconConnection } from '../../engines/silicon/types';
import { useUserStore } from '../../engines/user/store';
import { useNotificationStore } from '../../engines/notifications/store';
import { setupDefaultNotifications } from '../../engines/notifications/service';
import ErrorBoundary from '../../components/ErrorBoundary';
import Constants from 'expo-constants';

function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.sectionCard, style]}>
      {children}
    </View>
  );
}

// Pulsing dot animation for "listening" state
function PulsingDot({ size = 8 }: { size?: number }) {
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
    <RNAnimated.View style={[styles.pulsingDot, { opacity: pulse, width: size, height: size, borderRadius: size / 2 }]} />
  );
}

// Pulsing ring animation for listening state
function PulsingRing() {
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
        borderColor: Colors.dark.success,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

function SettingsScreenContent() {
  const [resetHour, setResetHour] = useState(5);
  const [silicon, setSilicon] = useState<SiliconConnection | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const username = useUserStore(s => s.username);
  const notifPrefs = useNotificationStore(s => s.preferences);
  const updateNotifPref = useNotificationStore(s => s.updatePreference);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    getSiliconConnection().then(conn => {
      if (conn) {
        setSilicon(conn);
        setPairingCode(conn.pairingCode);
      }
    });
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
            setPairingCode(null);
            setShowCode(false);
          },
        },
      ]
    );
  };

  const handleNotifToggle = async (key: 'morningReminder' | 'afternoonCheck' | 'eveningReminder', value: boolean) => {
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

  const isConnected = silicon?.connected;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">Settings</Text>

        {/* Account */}
        <Text style={styles.sectionHeaderText}>ACCOUNT</Text>
        <SectionCard>
          <View style={styles.cardRow}>
            <Text style={styles.cardRowLabel}>Username</Text>
            <Text style={styles.usernameValue} accessibilityLabel={`Username: ${username}`}>@{username}</Text>
          </View>
        </SectionCard>

        {/* Preferences */}
        <Text style={styles.sectionHeaderText}>PREFERENCES</Text>
        <SectionCard>
          <View style={styles.cardRow}>
            <Text style={styles.cardRowLabel}>Day resets at</Text>
            <View style={styles.resetTimeRow}>
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setResetHour(h => Math.max(0, h - 1));
                }}
                accessibilityLabel="Decrease reset hour"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.ctrlBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.timeValue} accessibilityLabel={`Reset time: ${String(resetHour).padStart(2, '0')}:00`}>{String(resetHour).padStart(2, '0')}:00</Text>
              <TouchableOpacity
                style={styles.ctrlBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setResetHour(h => Math.min(12, h + 1));
                }}
                accessibilityLabel="Increase reset hour"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.ctrlBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRow}>
            <Text style={styles.cardRowLabel}>Theme</Text>
            <Text style={styles.cardRowValue}>Dark</Text>
          </View>
        </SectionCard>

        {/* Notifications */}
        <Text style={styles.sectionHeaderText}>NOTIFICATIONS</Text>
        <SectionCard>
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Text style={styles.notifLabel}>Morning motivation</Text>
              <Text style={styles.notifTime}>10:00 AM</Text>
            </View>
            <Switch
              value={notifPrefs.morningReminder}
              onValueChange={v => handleNotifToggle('morningReminder', v)}
              trackColor={{ false: Colors.dark.surface, true: Colors.dark.textSecondary }}
              thumbColor={notifPrefs.morningReminder ? Colors.dark.accent : Colors.dark.textTertiary}
              accessibilityLabel="Morning motivation notification"
              accessibilityRole="switch"
            />
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Text style={styles.notifLabel}>Afternoon check</Text>
              <Text style={styles.notifTime}>3:00 PM</Text>
            </View>
            <Switch
              value={notifPrefs.afternoonCheck}
              onValueChange={v => handleNotifToggle('afternoonCheck', v)}
              trackColor={{ false: Colors.dark.surface, true: Colors.dark.textSecondary }}
              thumbColor={notifPrefs.afternoonCheck ? Colors.dark.accent : Colors.dark.textTertiary}
              accessibilityLabel="Afternoon check notification"
              accessibilityRole="switch"
            />
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.notifRow}>
            <View style={styles.notifInfo}>
              <Text style={styles.notifLabel}>Evening reminder</Text>
              <Text style={styles.notifTime}>9:00 PM</Text>
            </View>
            <Switch
              value={notifPrefs.eveningReminder}
              onValueChange={v => handleNotifToggle('eveningReminder', v)}
              trackColor={{ false: Colors.dark.surface, true: Colors.dark.textSecondary }}
              thumbColor={notifPrefs.eveningReminder ? Colors.dark.accent : Colors.dark.textTertiary}
              accessibilityLabel="Evening reminder notification"
              accessibilityRole="switch"
            />
          </View>
        </SectionCard>

        {/* Silicon Connection - New Flow */}
        <Text style={styles.sectionHeaderText}>SILICON</Text>
        <SectionCard style={styles.siliconCard}>
          {isConnected ? (
            <>
              {/* Connected state */}
              <View style={styles.connectedHeader}>
                <View style={styles.connectedIconContainer}>
                  <View style={styles.connectedIcon}>
                    <Text style={styles.connectedCheckmark}>✓</Text>
                  </View>
                </View>
                <View style={styles.connectedInfo}>
                  <Text style={styles.connectedTitle}>Silicon Connected</Text>
                  <Text style={styles.connectedDesc}>Syncing in real-time</Text>
                </View>
              </View>

              {silicon.lastSync && (
                <Text style={styles.hint}>
                  Last activity: {new Date(silicon.lastSync).toLocaleString()}
                </Text>
              )}

              {/* Tucked away code display */}
              <TouchableOpacity
                style={styles.showCodeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCode(!showCode);
                }}
              >
                <Text style={styles.showCodeBtnText}>{showCode ? 'Hide code' : 'Show pairing code'}</Text>
              </TouchableOpacity>

              {showCode && pairingCode && (
                <TouchableOpacity style={styles.codeInline} onPress={handleCopyCode} activeOpacity={0.7}>
                  <Text style={styles.codeInlineValue}>{pairingCode}</Text>
                  <Text style={styles.codeInlineCopy}>{copied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleDisconnect();
                }}
                accessibilityLabel="Disconnect Silicon"
                accessibilityRole="button"
              >
                <Text style={styles.dangerBtnText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Step 1: Read the docs */}
              <View style={styles.flowStep}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Read the docs</Text>
                  <Text style={styles.stepDesc}>Send Silicon to the untodo docs</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.docsLink}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL('https://untodo-docs.vercel.app/');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.docsLinkUrl}>untodo-docs.vercel.app</Text>
                <Text style={styles.docsLinkArrow}>↗</Text>
              </TouchableOpacity>
              <View style={styles.messageHint}>
                <Text style={styles.messageHintText}>
                  Tell Silicon: "Connect to my untodo app. Read the docs at untodo-docs.vercel.app"
                </Text>
              </View>

              {/* Step 2: Share the code when asked */}
              <View style={[styles.flowStep, { marginTop: Spacing.lg }]}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Share your code</Text>
                  <Text style={styles.stepDesc}>Silicon will ask for it after reading the docs</Text>
                </View>
              </View>

              {/* Tucked away code - not shown by default */}
              <TouchableOpacity
                style={styles.revealCodeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCode(!showCode);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.revealCodeBtnText}>
                  {showCode ? 'Hide code' : 'Tap to reveal code'}
                </Text>
              </TouchableOpacity>

              {showCode && pairingCode && (
                <View style={styles.codeRevealContainer}>
                  <Text style={styles.codeRevealLabel}>Your pairing code</Text>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <Text style={styles.codeRevealValue}>{pairingCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.codeCopyBtn} onPress={handleCopyCode}>
                    <Text style={styles.codeCopyBtnText}>{copied ? 'Copied!' : 'Copy code'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.codeRevealHint}>
                    Username: @{username}
                  </Text>
                </View>
              )}

              {/* Step 3: Listening */}
              <View style={[styles.flowStep, { marginTop: Spacing.lg }]}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <View style={styles.listeningRow}>
                    <View style={styles.listeningDotContainer}>
                      <PulsingRing />
                      <PulsingDot size={12} />
                    </View>
                    <Text style={styles.listeningText}>Listening for Silicon...</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </SectionCard>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeaderText, { color: Colors.dark.error }]}>DANGER ZONE</Text>
        <SectionCard>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              handleResetAllData();
            }}
            accessibilityLabel="Reset all data"
            accessibilityRole="button"
            accessibilityHint="Permanently deletes all tasks, progress, and settings"
          >
            <Text style={styles.dangerRowText}>Reset All Data</Text>
            <Text style={styles.dangerRowArrow}>→</Text>
          </TouchableOpacity>
        </SectionCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>untodo v{appVersion}</Text>
        </View>

        <View style={{ height: 120 }} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
  },
  heading: {
    color: Colors.dark.text,
    fontFamily: Fonts.accentItalic,
    fontSize: 36,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeaderText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  siliconCard: {
    borderColor: Colors.dark.textTertiary + '44',
    padding: Spacing.lg,
    overflow: 'visible',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  cardRowLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  cardRowValue: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginLeft: Spacing.md,
  },
  resetTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ctrlBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlBtnText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontFamily: Fonts.body,
  },
  timeValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 20,
    minWidth: 56,
    textAlign: 'center',
  },
  usernameValue: {
    color: Colors.dark.accent,
    fontFamily: Fonts.accent,
    fontSize: 20,
  },
  hint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  // Notifications
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  notifInfo: {
    flex: 1,
  },
  notifLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 15,
  },
  notifTime: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  // Silicon - Connected state
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  connectedIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedCheckmark: {
    color: Colors.dark.background,
    fontSize: 20,
    fontWeight: '700',
  },
  connectedInfo: {
    flex: 1,
  },
  connectedTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
  },
  connectedDesc: {
    color: Colors.dark.success,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  showCodeBtn: {
    paddingVertical: Spacing.sm,
  },
  showCodeBtnText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  codeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  codeInlineValue: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accent,
    fontSize: 22,
    letterSpacing: 4,
  },
  codeInlineCopy: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
  },

  // Silicon - Disconnected flow
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  stepDesc: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  docsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.sm,
  },
  docsLinkUrl: {
    color: Colors.dark.accent,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  docsLinkArrow: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
  },
  messageHint: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  messageHintText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.accentItalic,
    fontSize: 13,
    lineHeight: 20,
  },
  revealCodeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  revealCodeBtnText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  codeRevealContainer: {
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  codeRevealLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  codeRevealValue: {
    color: Colors.dark.accent,
    fontFamily: Fonts.accent,
    fontSize: 44,
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  codeCopyBtn: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
  },
  codeCopyBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  codeRevealHint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: Spacing.xs,
  },

  // Listening state
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  listeningDotContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  pulsingDot: {
    backgroundColor: Colors.dark.success,
  },

  // Danger
  dangerBtn: {
    borderWidth: 1,
    borderColor: Colors.dark.error,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  dangerBtnText: {
    color: Colors.dark.error,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
  dangerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  dangerRowText: {
    color: Colors.dark.error,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },
  dangerRowArrow: {
    color: Colors.dark.error,
    fontSize: 16,
    opacity: 0.5,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
});
