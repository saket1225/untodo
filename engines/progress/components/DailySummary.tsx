import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../../lib/theme';

export default function DailySummary() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Daily summary coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  text: { color: Colors.dark.textSecondary, fontFamily: Fonts.body, fontSize: 16 },
});
