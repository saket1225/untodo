import { doc, setDoc, getDocs, collection, query, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Todo } from '../engines/todo/types';
import { DaySummary, WeeklyReview } from '../engines/progress/types';
import { WallpaperConfig } from '../engines/wallpaper/types';

let _syncing = false;
let _syncListeners: ((syncing: boolean) => void)[] = [];

export function onSyncStateChange(listener: (syncing: boolean) => void) {
  _syncListeners.push(listener);
  return () => { _syncListeners = _syncListeners.filter(l => l !== listener); };
}

function setSyncing(v: boolean) {
  _syncing = v;
  _syncListeners.forEach(l => l(v));
}

export function isSyncing() { return _syncing; }

// ---- Todo sync ----

export async function syncTodoToFirestore(username: string, todo: Todo): Promise<void> {
  if (!username) return;
  try {
    setSyncing(true);
    const ref = doc(db, `users/${username}/todos/${todo.id}`);
    const { syncStatus, ...data } = todo;
    await setDoc(ref, data);
  } catch (e) {
    console.warn('Firestore todo sync failed:', e);
  } finally {
    setSyncing(false);
  }
}

export async function syncDeleteTodoFromFirestore(username: string, todoId: string): Promise<void> {
  if (!username) return;
  try {
    setSyncing(true);
    const { deleteDoc } = await import('firebase/firestore');
    const ref = doc(db, `users/${username}/todos/${todoId}`);
    await deleteDoc(ref);
  } catch (e) {
    console.warn('Firestore todo delete sync failed:', e);
  } finally {
    setSyncing(false);
  }
}

export async function fetchAllTodosFromFirestore(username: string): Promise<Todo[]> {
  if (!username) return [];
  try {
    setSyncing(true);
    const q = query(collection(db, `users/${username}/todos`));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: data.id || d.id,
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
        priority: data.priority !== undefined ? data.priority : null,
        category: data.category !== undefined ? data.category : null,
        pomodoroMinutesLogged: data.pomodoroMinutesLogged ?? 0,
        subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
        notes: data.notes ?? '',
        syncStatus: 'synced' as const,
      };
    }) as Todo[];
  } catch (e) {
    console.warn('Firestore fetch todos failed:', e);
    return [];
  } finally {
    setSyncing(false);
  }
}

export function mergeTodos(local: Todo[], remote: Todo[]): Todo[] {
  const merged = new Map<string, Todo>();

  // Start with local
  for (const t of local) {
    merged.set(t.id, t);
  }

  // Remote wins on conflicts (by updatedAt)
  for (const t of remote) {
    const existing = merged.get(t.id);
    if (!existing) {
      merged.set(t.id, { ...t, syncStatus: 'synced' });
    } else {
      const remoteTime = new Date(t.updatedAt || t.createdAt).getTime();
      const localTime = new Date(existing.updatedAt || existing.createdAt).getTime();
      if (remoteTime >= localTime) {
        merged.set(t.id, { ...t, syncStatus: 'synced' });
      }
    }
  }

  return Array.from(merged.values());
}

// ---- Progress sync ----

export async function syncDaySummaryToFirestore(username: string, summary: DaySummary): Promise<void> {
  if (!username) return;
  try {
    const ref = doc(db, `users/${username}/progress/day_${summary.date}`);
    await setDoc(ref, summary);
  } catch (e) {
    console.warn('Firestore day summary sync failed:', e);
  }
}

export async function syncWeeklyReviewToFirestore(username: string, review: WeeklyReview): Promise<void> {
  if (!username) return;
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
  try {
    const ref = doc(db, `users/${username}/config/wallpaper`);
    await setDoc(ref, config);
  } catch (e) {
    console.warn('Firestore wallpaper config sync failed:', e);
  }
}

// ---- Bulk sync (push all local todos to Firestore) ----

export async function bulkSyncTodosToFirestore(username: string, todos: Todo[]): Promise<void> {
  if (!username || todos.length === 0) return;
  const BATCH_LIMIT = 500;
  try {
    setSyncing(true);
    for (let i = 0; i < todos.length; i += BATCH_LIMIT) {
      const chunk = todos.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const todo of chunk) {
        const ref = doc(db, `users/${username}/todos/${todo.id}`);
        const { syncStatus, ...data } = todo;
        batch.set(ref, data);
      }
      await batch.commit();
    }
  } catch (e) {
    console.warn('Firestore bulk sync failed:', e);
  } finally {
    setSyncing(false);
  }
}
