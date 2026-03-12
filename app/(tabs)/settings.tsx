import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
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
    updateNotifPref(key, value);
    // Re-schedule all notifications with updated preferences
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
        <Text style={styles.heading}>Settings</Text>

        {/* Username */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.usernameValue}>@{username}</Text>
        </View>

        {/* Day Reset Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Day Reset Time</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => setResetHour(h => Math.max(0, h - 1))}
            >
              <Text style={styles.ctrlBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.timeValue}>{String(resetHour).padStart(2, '0')}:00</Text>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => setResetHour(h => Math.min(12, h + 1))}
            >
              <Text style={styles.ctrlBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            New day starts at {String(resetHour).padStart(2, '0')}:00 AM
          </Text>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
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
            />
          </View>
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
            />
          </View>
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
            />
          </View>
        </View>

        {/* Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <Text style={styles.hint}>Dark mode only (for now)</Text>
        </View>

        {/* Silicon Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Silicon</Text>

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
                <View style={[styles.codeContainer, { marginTop: Spacing.md }]}>
                  <Text style={styles.codeLabel}>Pairing Code</Text>
                  <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <Text style={styles.codeValue}>{pairingCode}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.dangerBtn} onPress={handleDisconnect}>
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
                onPress={handleConnect}
              >
                <Text style={styles.actionBtnText}>Connect</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleResetAllData}>
            <Text style={styles.dangerBtnText}>Reset All Data</Text>
          </TouchableOpacity>
        </View>

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
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  ctrlBtnText: {
    color: Colors.dark.text,
    fontSize: 20,
    fontFamily: Fonts.body,
  },
  timeValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 32,
    minWidth: 80,
    textAlign: 'center',
  },
  usernameValue: {
    color: Colors.dark.accent,
    fontFamily: Fonts.accent,
    fontSize: 24,
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
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  notifInfo: {
    flex: 1,
  },
  notifLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  codeLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.body,
    fontSize: 12,
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
    backgroundColor: Colors.dark.background,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  actionBtnText: {
    color: Colors.dark.text,
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
  footer: {
    marginTop: Spacing.xl,
  },
  footerText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
});
