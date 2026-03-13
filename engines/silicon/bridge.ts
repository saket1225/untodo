import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SiliconCommand, SiliconConnection } from './types';
import { useTodoStore } from '../todo/store';
import { useProgressStore } from '../progress/store';
import { useWallpaperStore } from '../wallpaper/store';
import { getLogicalDate } from '../../lib/date-utils';

const SILICON_KEY = 'untodo-silicon-connection';

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

async function processCommand(command: SiliconCommand, username: string): Promise<void> {
  let result: Record<string, any> = {};
  let status: 'success' | 'error' = 'success';
  const cmdRef = doc(db, 'users', username, 'silicon_commands', command.id);

  try {
    // Mark as processing
    await updateDoc(cmdRef, { status: 'processing' });

    switch (command.type) {
      case 'add_task': {
        const title = command.payload.title || command.payload.text;
        if (title) {
          useTodoStore.getState().addTodo(title);
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
        result = { message: 'Nudge received (notifications coming soon)' };
        break;
      }
      case 'get_progress': {
        const summaries = useProgressStore.getState().daySummaries;
        const reviews = useProgressStore.getState().weeklyReviews;
        result = { summaries, reviews };
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
