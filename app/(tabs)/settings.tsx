import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '../../lib/theme';
import {
  generatePairingCode,
  saveSiliconConnection,
  getSiliconConnection,
  disconnectSilicon,
} from '../../engines/silicon/bridge';
import { SiliconConnection } from '../../engines/silicon/types';

export default function SettingsScreen() {
  const [resetHour, setResetHour] = useState(5);
  const [silicon, setSilicon] = useState<SiliconConnection | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [pollInterval, setPollInterval] = useState(5);

  useEffect(() => {
    getSiliconConnection().then(conn => {
      if (conn) {
        setSilicon(conn);
        setPollInterval(conn.pollInterval || 5);
      }
    });
  }, []);

  const handleGenerateCode = () => {
    const code = generatePairingCode();
    setPairingCode(code);
  };

  const handleConnect = async () => {
    if (!serverUrl.trim()) return;
    const code = pairingCode || generatePairingCode();
    await saveSiliconConnection(serverUrl.trim(), code);
    const conn = await getSiliconConnection();
    setSilicon(conn);
    setPairingCode(null);
  };

  const handleDisconnect = async () => {
    await disconnectSilicon();
    setSilicon(null);
    setPairingCode(null);
    setServerUrl('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Settings</Text>

        {/* Day Reset Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Day Reset Time</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => setResetHour(h => Math.max(0, h - 1))}
            >
              <Text style={styles.ctrlBtnText}>−</Text>
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
                <Text style={styles.statusText}>Connected</Text>
              </View>
              <Text style={styles.hint}>
                {silicon.serverUrl}
              </Text>
              {silicon.lastSync && (
                <Text style={styles.hint}>
                  Last sync: {new Date(silicon.lastSync).toLocaleString()}
                </Text>
              )}

              <View style={[styles.row, { marginTop: Spacing.md }]}>
                <Text style={styles.controlLabel}>Poll interval</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => setPollInterval(v => Math.max(1, v - 1))}
                  >
                    <Text style={styles.ctrlBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.pollValue}>{pollInterval}m</Text>
                  <TouchableOpacity
                    style={styles.ctrlBtn}
                    onPress={() => setPollInterval(v => Math.min(30, v + 1))}
                  >
                    <Text style={styles.ctrlBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

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
                  <Text style={styles.codeValue}>{pairingCode}</Text>
                  <Text style={styles.hint}>Give this code to your Silicon instance</Text>
                </View>
              )}

              {!pairingCode && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleGenerateCode}>
                  <Text style={styles.actionBtnText}>Generate Pairing Code</Text>
                </TouchableOpacity>
              )}

              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="Server URL (e.g. http://192.168.1.10:9876)"
                placeholderTextColor={Colors.dark.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.actionBtn, !serverUrl.trim() && { opacity: 0.4 }]}
                onPress={handleConnect}
                disabled={!serverUrl.trim()}
              >
                <Text style={styles.actionBtnText}>Connect</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>untodo v1.0.0</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
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
  hint: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  controlLabel: {
    color: Colors.dark.text,
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    flex: 1,
  },
  pollValue: {
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 20,
    minWidth: 36,
    textAlign: 'center',
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
    marginBottom: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginBottom: Spacing.md,
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
    marginTop: Spacing.lg,
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
