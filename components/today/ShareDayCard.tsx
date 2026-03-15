import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Fonts, Spacing } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { getDailyScore } from './DailyScore';

export function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function ShareDayCard({ completed, total, streak }: { completed: number; total: number; streak: number }) {
  const { colors } = useTheme();
  const viewShotRef = useRef<ViewShot>(null);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const { grade, color } = getDailyScore(completed, total, streak);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your day',
        });
      }
    } catch {
      // Share cancelled
    }
  };

  if (total === 0) return null;

  return (
    <View style={shareCardStyles.wrapper}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={[shareCardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[shareCardStyles.date, { color: colors.textSecondary }]}>{dateStr}</Text>
          <View style={shareCardStyles.statsRow}>
            <View style={shareCardStyles.statItem}>
              <Text style={[shareCardStyles.statValue, { color }]}>{grade}</Text>
              <Text style={[shareCardStyles.statLabel, { color: colors.textTertiary }]}>score</Text>
            </View>
            <View style={[shareCardStyles.divider, { backgroundColor: colors.border }]} />
            <View style={shareCardStyles.statItem}>
              <Text style={[shareCardStyles.statValue, { color: colors.text }]}>{completed}/{total}</Text>
              <Text style={[shareCardStyles.statLabel, { color: colors.textTertiary }]}>tasks</Text>
            </View>
            <View style={[shareCardStyles.divider, { backgroundColor: colors.border }]} />
            <View style={shareCardStyles.statItem}>
              <Text style={[shareCardStyles.statValue, { color: colors.text }]}>{pct}%</Text>
              <Text style={[shareCardStyles.statLabel, { color: colors.textTertiary }]}>done</Text>
            </View>
            {streak > 0 && (
              <>
                <View style={[shareCardStyles.divider, { backgroundColor: colors.border }]} />
                <View style={shareCardStyles.statItem}>
                  <Text style={[shareCardStyles.statValue, { color: colors.timer }]}>{streak}</Text>
                  <Text style={[shareCardStyles.statLabel, { color: colors.textTertiary }]}>streak</Text>
                </View>
              </>
            )}
          </View>
          <Text style={[shareCardStyles.watermark, { color: colors.textTertiary }]}>untodo</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={[shareCardStyles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleShare} activeOpacity={0.7}>
        <Text style={[shareCardStyles.btnText, { color: colors.textSecondary }]}>Share your day</Text>
      </TouchableOpacity>
    </View>
  );
}

const shareCardStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  date: {
    fontFamily: Fonts.accentItalic,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.accent,
    fontSize: 24,
    lineHeight: 28,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
  },
  watermark: {
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    opacity: 0.4,
    marginTop: Spacing.md,
  },
  btn: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
