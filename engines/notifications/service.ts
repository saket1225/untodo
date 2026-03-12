import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from './store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleTaskReminder(
  title: string,
  bodyText: string,
  triggerSeconds: number
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body: bodyText, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  title: string,
  body: string,
  identifier: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (e) {
    console.warn('[Notifications] Failed to schedule daily reminder:', e);
  }
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setupDefaultNotifications(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  const store = useNotificationStore.getState();

  // Cancel all existing to avoid duplicates
  await cancelAll();

  if (store.preferences.morningReminder) {
    await scheduleDailyReminder(
      10, 0,
      'Time to crush it',
      'Open untodo and set your tasks.',
      'morning-reminder'
    );
  }

  if (store.preferences.afternoonCheck) {
    await scheduleDailyReminder(
      15, 0,
      'How are your tasks going?',
      'Check in on your progress.',
      'afternoon-check'
    );
  }

  if (store.preferences.eveningReminder) {
    await scheduleDailyReminder(
      21, 0,
      'Wind down soon',
      'How did today go?',
      'evening-reminder'
    );
  }

  store.setInitialized();
}

export async function sendPomodoroEndNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pomodoro Complete',
        body: 'Time for a break!',
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch {}
}
