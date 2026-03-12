import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Spacing } from '../../lib/theme';

export default function SettingsScreen() {
  const [resetHour, setResetHour] = useState(5);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Day Reset Time</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setResetHour(h => Math.max(0, h - 1))}
          >
            <Text style={styles.timeButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.timeValue}>{String(resetHour).padStart(2, '0')}:00</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setResetHour(h => Math.min(12, h + 1))}
          >
            <Text style={styles.timeButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          New day starts at {String(resetHour).padStart(2, '0')}:00 AM
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <Text style={styles.hint}>Dark mode only (for now)</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>untodo v1.0.0</Text>
      </View>
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
  timeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timeButtonText: {
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
  footer: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
  },
  footerText: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 12,
  },
});
