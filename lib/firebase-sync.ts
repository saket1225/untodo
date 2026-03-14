import { doc, setDoc, getDocs, collection, query, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Todo } from '../engines/todo/types';
import { DaySummary, WeeklyReview } from '../engines/progress/types';
import { WallpaperConfig } from '../engines/wallpaper/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---- Sync state ----

let _syncing = false;
let _syncListeners: ((syncing: boolean) => void)[] = [];

export function onSyncStateChange(listener: (syncing: boolean) => void) {
  _syncListeners.push(listener);
  return () => { _syncListeners = _syncListeners.filter(l => l !== listener); };
}

function setSyncing(v: boolean) {
  _syncing = v;
  _syncListeners.forEach(l => { try { l(v); } catch {} });
}

export function isSyncing() { return _syncing; }

// ---- Retry logic ----

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000]; // Exponential-ish backoff

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      // Don't retry on permission errors or invalid arguments
      const code = e?.code || '';
      if (code === 'permission-denied' || code === 'invalid-argument' || code === 'unauthenticated') {
        throw e;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  console.warn(`[firebase-sync] ${label} failed after ${MAX_RETRIES + 1} attempts:`, lastError);
  throw lastError;
}

// ---- Rate limiting ----
// Prevent more than 30 writes per minute

let _writeTimestamps: number[] = [];
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;

function checkRateLimit(): boolean {
  const now = Date.now();
  _writeTimestamps = _writeTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (_writeTimestamps.length >= RATE_LIMIT_MAX) {
    console.warn('[firebase-sync] Rate limit reached, skipping write');
    return false;
  }
  _writeTimestamps.push(now);
  return true;
}

// ---- Offline queue ----
// Queue failed writes for retry when back online

const OFFLINE_QUEUE_KEY = 'untodo-offline-queue';

interface QueuedWrite {
  type: 'upsert' | 'delete';
  path: string;
  data?: any;
  timestamp: number;
}

let _offlineQueue: QueuedWrite[] = [];
let _flushingQueue = false;

async function loadOfflineQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _offlineQueue = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    _offlineQueue = [];
  }
}

async function saveOfflineQueue(): Promise<void> {
  try {
    // Cap queue size to prevent AsyncStorage bloat
    if (_offlineQueue.length > 200) {
      _offlineQueue = _offlineQueue.slice(-200);
    }
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(_offlineQueue));
  } catch {}
}

function enqueueWrite(write: QueuedWrite) {
  // Deduplicate: remove older writes to same path
  _offlineQueue = _offlineQueue.filter(w => w.path !== write.path);
  _offlineQueue.push(write);
  saveOfflineQueue();
}

export async function flushOfflineQueue(): Promise<void> {
  if (_flushingQueue || _offlineQueue.length === 0) return;
  _flushingQueue = true;
  try {
    const queue = [..._offlineQueue];
    const succeeded: string[] = [];
    for (const item of queue) {
      try {
        if (item.type === 'upsert' && item.data) {
          const ref = doc(db, item.path);
          await setDoc(ref, item.data);
        } else if (item.type === 'delete') {
          const ref = doc(db, item.path);
          await deleteDoc(ref);
        }
        succeeded.push(item.path);
      } catch {
        // Stop flushing on first failure (probably still offline)
        break;
      }
    }
    if (succeeded.length > 0) {
      _offlineQueue = _offlineQueue.filter(w => !succeeded.includes(w.path));
      await saveOfflineQueue();
    }
  } finally {
    _flushingQueue = false;
  }
}

// Initialize offline queue on module load
loadOfflineQueue();

// ---- Todo sync ----

export async function syncTodoToFirestore(username: string, todo: Todo): Promise<void> {
  if (!username || !todo?.id) return;
  if (!checkRateLimit()) return;
  const path = `users/${username}/todos/${todo.id}`;
  const { syncStatus, ...data } = todo;
  try {
    setSyncing(true);
    await withRetry(() => {
      const ref = doc(db, path);
      return setDoc(ref, data);
    }, 'syncTodo');
  } catch (e) {
    console.warn('Firestore todo sync failed, queuing:', e);
    enqueueWrite({ type: 'upsert', path, data, timestamp: Date.now() });
  } finally {
    setSyncing(false);
  }
}

export async function syncDeleteTodoFromFirestore(username: string, todoId: string): Promise<void> {
  if (!username || !todoId) return;
  if (!checkRateLimit()) return;
  const path = `users/${username}/todos/${todoId}`;
  try {
    setSyncing(true);
    await withRetry(() => {
      const ref = doc(db, path);
      return deleteDoc(ref);
    }, 'syncDeleteTodo');
  } catch (e) {
    console.warn('Firestore todo delete sync failed, queuing:', e);
    enqueueWrite({ type: 'delete', path, timestamp: Date.now() });
  } finally {
    setSyncing(false);
  }
}

export async function fetchAllTodosFromFirestore(username: string): Promise<Todo[]> {
  if (!username) return [];
  try {
    setSyncing(true);
    return await withRetry(async () => {
      const q = query(collection(db, `users/${username}/todos`));
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return sanitizeTodo({
          ...data,
          id: data.id || d.id,
          syncStatus: 'synced' as const,
        });
      }) as Todo[];
    }, 'fetchTodos');
  } catch (e) {
    console.warn('Firestore fetch todos failed:', e);
    return [];
  } finally {
    setSyncing(false);
  }
}

// Sanitize a raw Firestore doc into a valid Todo shape
function sanitizeTodo(data: any): Todo {
  return {
    id: typeof data.id === 'string' ? data.id : String(data.id || Date.now().toString(36)),
    title: typeof data.title === 'string' ? data.title : '',
    completed: typeof data.completed === 'boolean' ? data.completed : false,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : (data.createdAt || new Date().toISOString()),
    logicalDate: typeof data.logicalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.logicalDate)
      ? data.logicalDate : new Date().toISOString().split('T')[0],
    order: typeof data.order === 'number' && isFinite(data.order) ? data.order : 0,
    type: data.type === 'audio' ? 'audio' : 'task',
    priority: ['high', 'medium', 'low', null].includes(data.priority) ? data.priority : null,
    category: ['work', 'personal', 'health', 'learning', 'finance', 'creative', null].includes(data.category) ? data.category : null,
    pomodoroMinutesLogged: typeof data.pomodoroMinutesLogged === 'number' ? data.pomodoroMinutesLogged : 0,
    subtasks: Array.isArray(data.subtasks) ? data.subtasks.filter((s: any) => s && typeof s.id === 'string') : [],
    notes: typeof data.notes === 'string' ? data.notes : '',
    syncStatus: data.syncStatus || 'synced',
    ...(data.carriedOverFrom ? { carriedOverFrom: data.carriedOverFrom } : {}),
    ...(data.recurrence ? { recurrence: data.recurrence } : {}),
    ...(data.recurringParentId ? { recurringParentId: data.recurringParentId } : {}),
    ...(data.timeTracking ? { timeTracking: data.timeTracking } : {}),
    ...(data.audioUri ? { audioUri: data.audioUri } : {}),
    ...(data.audioDuration ? { audioDuration: data.audioDuration } : {}),
    ...(data.estimatedMinutes != null ? { estimatedMinutes: data.estimatedMinutes } : {}),
    ...(data.pomodoroWork != null ? { pomodoroWork: data.pomodoroWork } : {}),
    ...(data.pomodoroBreak != null ? { pomodoroBreak: data.pomodoroBreak } : {}),
    ...(data.pomodoroPreset ? { pomodoroPreset: data.pomodoroPreset } : {}),
  };
}

export function mergeTodos(local: Todo[], remote: Todo[]): Todo[] {
  const merged = new Map<string, Todo>();

  // Start with local
  for (const t of local) {
    if (t && t.id) merged.set(t.id, t);
  }

  // Remote wins on conflicts (by updatedAt) — but only if remote data is valid
  for (const t of remote) {
    if (!t || !t.id) continue;
    const existing = merged.get(t.id);
    if (!existing) {
      merged.set(t.id, { ...t, syncStatus: 'synced' });
    } else {
      const remoteTime = safeParseDate(t.updatedAt || t.createdAt);
      const localTime = safeParseDate(existing.updatedAt || existing.createdAt);
      if (remoteTime >= localTime) {
        merged.set(t.id, { ...t, syncStatus: 'synced' });
      }
    }
  }

  return Array.from(merged.values());
}

function safeParseDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return isNaN(ts) ? 0 : ts;
}

// ---- Progress sync ----

export async function syncDaySummaryToFirestore(username: string, summary: DaySummary): Promise<void> {
  if (!username || !summary?.date) return;
  if (!checkRateLimit()) return;
  try {
    const ref = doc(db, `users/${username}/progress/day_${summary.date}`);
    await setDoc(ref, summary);
  } catch (e) {
    console.warn('Firestore day summary sync failed:', e);
  }
}

export async function syncWeeklyReviewToFirestore(username: string, review: WeeklyReview): Promise<void> {
  if (!username || !review?.weekStart) return;
  if (!checkRateLimit()) return;
  try {
    const ref = doc(db, `users/${username}/progress/week_${review.weekStart}`);
    await setDoc(ref, review);
  } catch (e) {
    console.warn('Firestore weekly review sync failed:', e);
  }
}

// ---- Wallpaper config sync ----

export async function syncWallpaperConfigToFirestore(username: string, config: WallpaperConfig): Promise<void> {
  if (!username) return;
  if (!checkRateLimit()) return;
  try {
    const ref = doc(db, `users/${username}/config/wallpaper`);
    await setDoc(ref, config);
  } catch (e) {
    console.warn('Firestore wallpaper config sync failed:', e);
  }
}

// ---- Bulk sync (push all local todos to Firestore) ----

export async function bulkSyncTodosToFirestore(username: string, todos: Todo[]): Promise<void> {
  if (!username || !Array.isArray(todos) || todos.length === 0) return;
  const BATCH_LIMIT = 500;
  try {
    setSyncing(true);
    for (let i = 0; i < todos.length; i += BATCH_LIMIT) {
      const chunk = todos.slice(i, i + BATCH_LIMIT);
      await withRetry(async () => {
        const batch = writeBatch(db);
        for (const todo of chunk) {
          if (!todo?.id) continue;
          const ref = doc(db, `users/${username}/todos/${todo.id}`);
          const { syncStatus, ...data } = todo;
          batch.set(ref, data);
        }
        await batch.commit();
      }, 'bulkSync');
    }
  } catch (e) {
    console.warn('Firestore bulk sync failed:', e);
    // Queue individual items on bulk failure
    for (const todo of todos) {
      if (!todo?.id) continue;
      const { syncStatus, ...data } = todo;
      enqueueWrite({
        type: 'upsert',
        path: `users/${username}/todos/${todo.id}`,
        data,
        timestamp: Date.now(),
      });
    }
  } finally {
    setSyncing(false);
  }
}
