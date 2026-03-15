import { useEffect, useCallback } from 'react';
import { Stack, Redirect, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useUserStore } from '../engines/user/store';
import { setupDefaultNotifications } from '../engines/notifications/service';
import { useNotificationStore } from '../engines/notifications/store';
import ErrorBoundary from '../components/ErrorBoundary';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const router = useRouter();
  const username = useUserStore(s => s.username);
  const hydrated = useUserStore(s => s._hydrated);
  const notifInitialized = useNotificationStore(s => s.initialized);
  const { colors, isDark } = useTheme();

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

  // Deep link: handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const id = response.notification.request.identifier;
      // Route based on notification type
      if (id === 'weekly-summary') {
        router.push('/(tabs)/progress');
      }
      // All other notifications → Today screen (default tab)
    });
    return () => subscription.remove();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && hydrated) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) {
    return null; // Keep native splash screen visible
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
      <ErrorBoundary>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        {!username && <Redirect href="/onboarding" />}
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
