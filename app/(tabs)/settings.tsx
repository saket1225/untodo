import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import {
  generatePairingCode,
  saveSiliconConnection,
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

function SettingsScreenContent() {
  const [resetHour, setResetHour] = useState(5);
  const [silicon, setSilicon] = useState<SiliconConnection | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleCopyMessage = async () => {
    if (!pairingCode || !username) return;
    const msg = `Connect to my untodo app. Username: ${username}, Pairing code: ${pairingCode}. Docs: https://untodo-docs.vercel.app/`;
    try {
      await Clipboard.setStringAsync(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleConnect = async () => {
    const code = pairingCode || generatePairingCode();
    await saveSiliconConnection(code);
    const conn = await getSiliconConnection();
    setSilicon(conn);
    setPairingCode(code);
  };

  const handleDisconnect = async () => {
    await disconnectSilicon();
    setSilicon(null);
    setPairingCode(null);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading} accessibilityRole="header">Settings</Text>

        {/* Account */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <SectionCard>
          <View style={styles.cardRow}>
            <Text style={styles.cardRowLabel}>Username</Text>
            <Text style={styles.usernameValue} accessibilityLabel={`Username: ${username}`}>@{username}</Text>
          </View>
        </SectionCard>

        {/* Preferences */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
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
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
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

        {/* Silicon Connection */}
        <Text style={styles.sectionHeader}>SILICON</Text>
        <SectionCard style={styles.siliconCard}>
          {silicon?.connected ? (
            <>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected (real-time)</Text>
              </View>
              {silicon.lastSync && (
                <Text style={styles.hint}>
                  Last activity: {new Date(silicon.lastSync).toLocaleString()}
                </Text>
              )}

              {pairingCode && (
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Pairing Code</Text>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <Text style={styles.codeValue}>{pairingCode}</Text>
                  </TouchableOpacity>
                </View>
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
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.dark.textTertiary }]} />
                <Text style={styles.statusText}>Not connected</Text>
              </View>

              {pairingCode && (
                <View style={styles.codeContainer}>
                  <Text style={styles.codeLabel}>Pairing Code</Text>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <Text style={styles.codeValue}>{pairingCode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
                    <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy Code'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.instructionBlock}>
                <Text style={styles.instructionText}>
                  Send this to your Silicon instance:
                </Text>
                <TouchableOpacity style={styles.messageBlock} onPress={handleCopyMessage} activeOpacity={0.7}>
                  <Text style={styles.messageText}>
                    Connect to my untodo app. Username: {username}, Pairing code: {pairingCode}. Docs: https://untodo-docs.vercel.app/
                  </Text>
                  <Text style={styles.tapToCopy}>Tap to copy</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.capabilitiesBlock}>
                <Text style={styles.capabilitiesTitle}>What Silicon can do</Text>
                <Text style={styles.capabilityItem}>  Add and manage your tasks remotely</Text>
                <Text style={styles.capabilityItem}>  Write daily summaries and weekly reviews</Text>
                <Text style={styles.capabilityItem}>  Track your progress and send nudges</Text>
                <Text style={styles.capabilityItem}>  Control app settings</Text>
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleConnect();
                }}
                accessibilityLabel="Connect to Silicon"
                accessibilityRole="button"
              >
                <Text style={styles.actionBtnText}>Connect</Text>
              </TouchableOpacity>
            </>
          )}
        </SectionCard>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { color: Colors.dark.error }]}>DANGER ZONE</Text>
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
  sectionHeader: {
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
    fontSize: 13,
    marginTop: Spacing.sm,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  statusText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  codeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
  },
  codeLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  codeValue: {
    color: Colors.dark.accent,
    fontFamily: Fonts.accent,
    fontSize: 48,
    letterSpacing: 8,
    marginBottom: Spacing.md,
  },
  copyBtn: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  copyBtnText: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  instructionBlock: {
    marginBottom: Spacing.lg,
  },
  instructionText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  messageBlock: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: Spacing.md,
  },
  messageText: {
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  tapToCopy: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  capabilitiesBlock: {
    marginBottom: Spacing.lg,
  },
  capabilitiesTitle: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  capabilityItem: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 22,
  },
  actionBtn: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: Colors.dark.background,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
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
