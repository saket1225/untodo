import * as Notifications from 'expo-notifications';
import { useNotificationStore } from './store';
import { useTodoStore } from '../todo/store';
import { getLogicalDate } from '../../lib/date-utils';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
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

function getTaskStats() {
  const todos = useTodoStore.getState().todos;
  const today = getLogicalDate();
  const todayTodos = todos.filter(t => t.logicalDate === today);
  const total = todayTodos.length;
  const completed = todayTodos.filter(t => t.completed).length;
  const remaining = total - completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate streak
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 1; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const dayTotal = dayTodos.length;
    const dayCompleted = dayTodos.filter(t => t.completed).length;
    if (dayTotal > 0 && dayCompleted / dayTotal >= 0.5) streak++;
    else if (dayTotal > 0) break;
  }

  return { total, completed, remaining, pct, streak };
}

export async function setupDefaultNotifications(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  const store = useNotificationStore.getState();
  const { total, completed, remaining, pct, streak } = getTaskStats();

  await cancelAll();

  if (store.preferences.morningReminder) {
    const dayOfMonth = new Date().getDate();
    const morningMessages = [
      {
        title: 'Rise and conquer',
        body: total > 0
          ? `${total} task${total !== 1 ? 's' : ''} lined up for today.`
          : 'Start your day — add your first task.',
      },
      {
        title: streak > 2 ? `${streak}-day streak` : 'New day, fresh start',
        body: streak > 2
          ? `Don't break the chain. What's the plan today?`
          : 'What will you accomplish today?',
      },
      {
        title: 'Time to focus',
        body: total > 0
          ? `You've got ${total} task${total !== 1 ? 's' : ''} waiting.`
          : 'Open untodo and set your intentions.',
      },
    ];
    const msg = morningMessages[dayOfMonth % morningMessages.length];
    await scheduleDailyReminder(8, 0, msg.title, msg.body, 'morning-reminder');
  }

  if (store.preferences.afternoonCheck) {
    let title: string, body: string;
    if (total === 0) {
      title = 'Afternoon check';
      body = 'No tasks set yet. Still time to add some.';
    } else if (pct >= 100) {
      title = 'All done!';
      body = 'You crushed it. Enjoy the rest of your day.';
    } else if (pct >= 50) {
      title = `${pct}% done — keep going`;
      body = `${remaining} task${remaining !== 1 ? 's' : ''} left. You're on track.`;
    } else {
      title = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
      body = `${pct}% done so far. Quick push to catch up?`;
    }
    await scheduleDailyReminder(15, 0, title, body, 'afternoon-check');
  }

  if (store.preferences.eveningReminder) {
    let title: string, body: string;
    if (total === 0) {
      title = 'Day in review';
      body = 'No tasks today. Tomorrow is a fresh start.';
    } else if (completed === total) {
      title = 'Perfect day!';
      body = streak > 0
        ? `${streak + 1}-day streak! Rest well, you earned it.`
        : 'Every task done. You earned a good rest.';
    } else if (remaining <= 2) {
      title = `Almost there — ${remaining} left`;
      body = 'Quick finish before bed?';
    } else {
      title = `${remaining} task${remaining !== 1 ? 's' : ''} unfinished`;
      body = 'Finish what you can, carry over the rest.';
    }
    await scheduleDailyReminder(21, 0, title, body, 'evening-reminder');
  }

  store.setInitialized();
}

export async function refreshNotifications(): Promise<void> {
  const store = useNotificationStore.getState();
  if (!store.initialized) return;
  await setupDefaultNotifications();
}

export async function sendPomodoroEndNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Pomodoro Complete',
        body: 'Time for a break!',
        sound: true,
      },
      trigger: null,
    });
  } catch {}
}
