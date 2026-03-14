import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Colors, Fonts, Spacing } from '../../../lib/theme';
import { getDailyScore } from './DailyScore';

export function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function ShareDayCard({ completed, total, streak }: { completed: number; total: number; streak: number }) {
  const viewShotRef = useRef<ViewShot>(null);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const { grade, color } = getDailyScore(completed, total, streak);

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          message: `${dateStr}: ${completed}/${total} tasks done (${pct}%) | ${streak} day streak | untodo`,
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
        <View style={shareCardStyles.card}>
          <Text style={shareCardStyles.date}>{dateStr}</Text>
          <View style={shareCardStyles.statsRow}>
            <View style={shareCardStyles.statItem}>
              <Text style={[shareCardStyles.statValue, { color }]}>{grade}</Text>
              <Text style={shareCardStyles.statLabel}>score</Text>
            </View>
            <View style={shareCardStyles.divider} />
            <View style={shareCardStyles.statItem}>
              <Text style={shareCardStyles.statValue}>{completed}/{total}</Text>
              <Text style={shareCardStyles.statLabel}>tasks</Text>
            </View>
            <View style={shareCardStyles.divider} />
            <View style={shareCardStyles.statItem}>
              <Text style={shareCardStyles.statValue}>{pct}%</Text>
              <Text style={shareCardStyles.statLabel}>done</Text>
            </View>
            {streak > 0 && (
              <>
                <View style={shareCardStyles.divider} />
                <View style={shareCardStyles.statItem}>
                  <Text style={[shareCardStyles.statValue, { color: Colors.dark.timer }]}>{streak}</Text>
                  <Text style={shareCardStyles.statLabel}>streak</Text>
                </View>
              </>
            )}
          </View>
          <Text style={shareCardStyles.watermark}>untodo</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={shareCardStyles.btn} onPress={handleShare} activeOpacity={0.7}>
        <Text style={shareCardStyles.btnText}>Share your day</Text>
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
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  date: {
    color: Colors.dark.textSecondary,
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
    color: Colors.dark.text,
    fontFamily: Fonts.accent,
    fontSize: 24,
    lineHeight: 28,
  },
  statLabel: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.dark.border,
  },
  watermark: {
    color: Colors.dark.textTertiary,
    fontFamily: Fonts.accentItalic,
    fontSize: 11,
    opacity: 0.4,
    marginTop: Spacing.md,
  },
  btn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
