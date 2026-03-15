import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '../../lib/firebase';
import { SiliconCommand, SiliconConnection } from './types';
import { useTodoStore } from '../todo/store';
import { useProgressStore } from '../progress/store';
import { useWallpaperStore } from '../wallpaper/store';
import { getLogicalDate } from '../../lib/date-utils';

const SILICON_KEY = 'untodo-silicon-connection';

// Track focus state for set_focus command
let _focusCallback: ((taskId: string | null) => void) | null = null;

export function onSiliconFocus(cb: (taskId: string | null) => void) {
  _focusCallback = cb;
  return () => { _focusCallback = null; };
}

export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function saveSiliconConnection(code: string): Promise<void> {
  await AsyncStorage.setItem(SILICON_KEY, JSON.stringify({
    connected: true,
    pairingCode: code,
    lastSync: Date.now(),
  }));
}

export async function getSiliconConnection(): Promise<SiliconConnection | null> {
  try {
    const data = await AsyncStorage.getItem(SILICON_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // Corrupted data — clear it
    await AsyncStorage.removeItem(SILICON_KEY).catch(() => {});
  }
  return null;
}

export async function disconnectSilicon(): Promise<void> {
  await AsyncStorage.removeItem(SILICON_KEY);
}

function calculateStreak(): { streak: number; bestStreak: number } {
  const todos = useTodoStore.getState().todos;
  let streak = 0;
  let bestStreak = 0;
  const today = getLogicalDate();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    if (dayTodos.length === 0) {
      if (i === 0) continue; // Today might not have tasks yet
      break;
    }
    const completed = dayTodos.filter(t => t.completed).length;
    if (completed / dayTodos.length >= 0.5) {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      if (i === 0) continue; // Today is still in progress
      break;
    }
  }

  return { streak, bestStreak };
}

async function processCommand(command: SiliconCommand, username: string): Promise<void> {
  let result: Record<string, any> = {};
  let status: 'success' | 'error' = 'success';
  const cmdRef = doc(db, 'users', username, 'silicon_commands', command.id);

  try {
    // Check if Silicon is still connected
    const connection = await getSiliconConnection();
    if (!connection?.connected) {
      status = 'error';
      result = { message: 'Silicon is disconnected. Pair again to send commands.' };
      const responseRef = doc(db, 'users', username, 'silicon_responses', command.id);
      await setDoc(responseRef, { commandId: command.id, result, status, completedAt: Date.now() });
      await updateDoc(cmdRef, { status: 'rejected' });
      return;
    }

    // Mark as processing
    await updateDoc(cmdRef, { status: 'processing' });

    switch (command.type) {
      case 'add_task': {
        const title = command.payload.title || command.payload.text;
        if (title) {
          const priority = command.payload.priority || null;
          const category = command.payload.category || null;
          const date = command.payload.date || undefined;
          useTodoStore.getState().addTodo(title, priority, category, date);
          result = { message: `Task added: ${title}` };
        } else {
          status = 'error';
          result = { message: 'No title provided' };
        }
        break;
      }
      case 'complete_task': {
        const id = command.payload.id;
        if (id) {
          useTodoStore.getState().toggleTodo(id);
          result = { message: `Task toggled: ${id}` };
        } else {
          status = 'error';
          result = { message: 'No task id provided' };
        }
        break;
      }
      case 'delete_task': {
        const id = command.payload.id;
        if (id) {
          useTodoStore.getState().deleteTodo(id);
          result = { message: `Task deleted: ${id}` };
        } else {
          status = 'error';
          result = { message: 'No task id provided' };
        }
        break;
      }
      case 'get_tasks': {
        const date = command.payload.date || getLogicalDate();
        const todos = useTodoStore.getState().getTodosForDate(date);
        result = { tasks: todos, date };
        break;
      }
      case 'write_daily_summary': {
        const summary = command.payload as {
          date: string; completedTasks: number; totalTasks: number;
          completionRate: number; pomodoroMinutes: number; note?: string;
        };
        if (!summary.date) { status = 'error'; result = { message: 'Missing date field' }; break; }
        useProgressStore.getState().addDaySummary({
          date: summary.date,
          completedTasks: summary.completedTasks ?? 0,
          totalTasks: summary.totalTasks ?? 0,
          completionRate: summary.completionRate ?? 0,
          pomodoroMinutes: summary.pomodoroMinutes ?? 0,
          note: summary.note,
        });
        result = { message: `Daily summary saved for ${summary.date}` };
        break;
      }
      case 'write_weekly_review': {
        const review = command.payload as {
          weekStart: string; weekEnd: string; completionRate: number;
          totalCompleted: number; totalTasks: number; pomodoroMinutes: number;
          topStreak: number; review: string;
        };
        if (!review.weekStart) { status = 'error'; result = { message: 'Missing weekStart field' }; break; }
        useProgressStore.getState().addWeeklyReview({
          weekStart: review.weekStart,
          weekEnd: review.weekEnd ?? '',
          completionRate: review.completionRate ?? 0,
          totalCompleted: review.totalCompleted ?? 0,
          totalTasks: review.totalTasks ?? 0,
          pomodoroMinutes: review.pomodoroMinutes ?? 0,
          topStreak: review.topStreak ?? 0,
          review: review.review ?? '',
        });
        result = { message: `Weekly review saved for ${review.weekStart}` };
        break;
      }
      case 'update_wallpaper_config': {
        useWallpaperStore.getState().updateConfig(command.payload);
        result = { message: 'Wallpaper config updated' };
        break;
      }
      case 'nudge': {
        const message = command.payload.message || command.payload.text || 'Silicon says: Time to focus!';
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Silicon',
              body: String(message),
              sound: true,
            },
            trigger: null, // Immediate
          });
          result = { message: `Nudge sent: ${message}` };
        } catch (e: any) {
          result = { message: `Nudge displayed (notification failed: ${e?.message})` };
        }
        break;
      }
      case 'get_progress': {
        const summaries = useProgressStore.getState().daySummaries;
        const reviews = useProgressStore.getState().weeklyReviews;
        result = { summaries, reviews };
        break;
      }
      case 'get_habits': {
        const habits = useProgressStore.getState().habits || [];
        // Also find recurring tasks as "habits"
        const recurringTasks = useTodoStore.getState().todos.filter(t => t.recurrence && !t.recurringParentId);
        const recurringHabits = recurringTasks.map(t => {
          // Count how many spawned instances were completed
          const allSpawned = useTodoStore.getState().todos.filter(
            st => st.recurringParentId === t.id
          );
          const completedCount = allSpawned.filter(st => st.completed).length;
          return {
            id: t.id,
            name: t.title,
            recurrence: t.recurrence,
            totalSpawned: allSpawned.length,
            totalCompleted: completedCount,
            completionRate: allSpawned.length > 0 ? Math.round((completedCount / allSpawned.length) * 100) : 0,
          };
        });
        result = { habits, recurringHabits };
        break;
      }
      case 'get_streak': {
        const { streak, bestStreak } = calculateStreak();
        const todayDate = getLogicalDate();
        const todayTodos = useTodoStore.getState().getTodosForDate(todayDate);
        const completed = todayTodos.filter(t => t.completed).length;
        result = {
          currentStreak: streak,
          bestStreak,
          todayProgress: {
            completed,
            total: todayTodos.length,
            completionRate: todayTodos.length > 0 ? Math.round((completed / todayTodos.length) * 100) : 0,
          },
        };
        break;
      }
      case 'set_focus': {
        const taskId = command.payload.taskId || command.payload.id;
        if (!taskId) {
          status = 'error';
          result = { message: 'No taskId provided' };
          break;
        }
        const task = useTodoStore.getState().todos.find(t => t.id === taskId);
        if (!task) {
          status = 'error';
          result = { message: `Task not found: ${taskId}` };
          break;
        }
        // Trigger focus mode via callback
        if (_focusCallback) {
          _focusCallback(taskId);
          result = { message: `Focus mode activated for: ${task.title}` };
        } else {
          result = { message: `Focus requested for: ${task.title} (app must be in foreground)` };
        }
        break;
      }
      default:
        status = 'error';
        result = { message: `Unknown command type: ${command.type}` };
    }
  } catch (err: any) {
    status = 'error';
    result = { message: err?.message || 'Unknown error' };
  }

  // Write response and mark done — wrap in try/catch to avoid crashing
  try {
    const responseRef = doc(db, 'users', username, 'silicon_responses', command.id);
    await setDoc(responseRef, {
      commandId: command.id,
      result,
      status,
      completedAt: Date.now(),
    });
    await updateDoc(cmdRef, { status: 'done' });
    await saveSiliconConnection((await getSiliconConnection())?.pairingCode || '');
  } catch (e) {
    console.warn('[Silicon] Failed to write response:', e);
  }
}

export function startSiliconListener(username: string): () => void {
  const commandsRef = collection(db, 'users', username, 'silicon_commands');
  const q = query(commandsRef, where('status', '==', 'pending'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const command: SiliconCommand = {
          id: change.doc.id,
          type: data.type,
          payload: data.payload || {},
          status: data.status,
          createdAt: data.createdAt,
        };
        if (command.status === 'pending') {
          processCommand(command, username);
        }
      }
    });
  }, (error) => {
    console.error('[Silicon] Firestore listener error:', error);
  });

  return unsubscribe;
}
