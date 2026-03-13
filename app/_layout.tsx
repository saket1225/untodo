import { useEffect, useCallback } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useUserStore } from '../engines/user/store';
import { setupDefaultNotifications } from '../engines/notifications/service';
import { useNotificationStore } from '../engines/notifications/store';
import ErrorBoundary from '../components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const username = useUserStore(s => s.username);
  const notifInitialized = useNotificationStore(s => s.initialized);

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

  // Setup notifications on first load
  useEffect(() => {
    if (username && !notifInitialized) {
      setupDefaultNotifications();
    }
  }, [username, notifInitialized]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0A' }} onLayout={onLayoutRootView}>
      <ErrorBoundary>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        {!username && <Redirect href="/onboarding" />}
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
