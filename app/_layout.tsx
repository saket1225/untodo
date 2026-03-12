import { Stack, Redirect } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUserStore } from '../engines/user/store';

export default function RootLayout() {
  const username = useUserStore(s => s.username);

  const [fontsLoaded] = useFonts({
    'ApfelGrotezk-Bold': require('../assets/fonts/ApfelGrotezk-Bold.ttf'),
    'ApfelGrotezk-Medium': require('../assets/fonts/ApfelGrotezk-Medium.ttf'),
    'ApfelGrotezk-Regular': require('../assets/fonts/ApfelGrotezk-Regular.ttf'),
    'InstrumentSerif-Regular': require('../assets/fonts/InstrumentSerif-Regular.ttf'),
    'InstrumentSerif-Italic': require('../assets/fonts/InstrumentSerif-Italic.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {!username && <Redirect href="/onboarding" />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
