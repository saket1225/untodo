import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo, Priority, Category, Subtask, SyncStatus, Recurrence, TimeTracking } from './types';
import { getLogicalDate, getLogicalYesterday, getLogicalDayOfWeek } from '../../lib/date-utils';
import { useUserStore } from '../user/store';
import {
  syncTodoToFirestore,
  syncDeleteTodoFromFirestore,
  fetchAllTodosFromFirestore,
  mergeTodos,
  bulkSyncTodosToFirestore,
  flushOfflineQueue,
  isSyncFromFirestoreInProgress,
  setSyncFromFirestoreInProgress,
} from '../../lib/firebase-sync';
import { refreshNotifications } from '../notifications/service';

// ---- Safety limits ----
const MAX_TODOS = 5000; // Hard cap to prevent memory issues
const MAX_TODOS_PER_DAY = 500; // Sanity check per day

interface TodoStore {
  todos: Todo[];
  addTodo: (title: string, priority?: Priority, category?: Category, date?: string, recurrence?: Recurrence) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  reorderTodos: (ids: string[]) => void;
  getTodayTodos: () => Todo[];
  getTodosForDate: (date: string) => Todo[];
  carryOverTodos: () => void;
  autoCarryOldTodos: () => number;
  logPomodoroMinutes: (id: string, minutes: number) => void;
  addSubtask: (todoId: string, title: string) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;
  syncFromFirestore: () => Promise<void>;
  startTimeTracking: (id: string) => void;
  stopTimeTracking: (id: string) => void;
  addSampleTasks: () => void;
  restoreTodo: (todo: Todo) => void;
  spawnRecurringTasks: () => void;
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
    const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return (a.order || 0) - (b.order || 0);
  });
}

function getUsername(): string | null {
  try {
    return useUserStore.getState().username;
  } catch {
    return null;
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

// Validate a date string is in YYYY-MM-DD format
function isValidDate(dateStr: string): boolean {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// Safe getLogicalDate that never throws
function safeLogicalDate(): string {
  try {
    return getLogicalDate();
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// Debounced sync: batch sync calls within 500ms
let _syncTimeout: ReturnType<typeof setTimeout> | null = null;
let _pendingSyncTodos: Map<string, Todo> = new Map();

function debouncedSyncTodo(todo: Todo) {
  const username = getUsername();
  if (!username) return;
  _pendingSyncTodos.set(todo.id, todo);
  if (_syncTimeout) clearTimeout(_syncTimeout);
  _syncTimeout = setTimeout(() => {
    const todos = Array.from(_pendingSyncTodos.values());
    _pendingSyncTodos.clear();
    _syncTimeout = null;
    if (todos.length === 1) {
      syncTodoToFirestore(username, todos[0]).catch(() => {});
    } else if (todos.length > 1) {
      bulkSyncTodosToFirestore(username, todos).catch(() => {});
    }
  }, 500);
}

// Debounced notification refresh
let _notifRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedNotifRefresh() {
  if (_notifRefreshTimeout) clearTimeout(_notifRefreshTimeout);
  _notifRefreshTimeout = setTimeout(() => {
    _notifRefreshTimeout = null;
    try { refreshNotifications().catch(() => {}); } catch {}
  }, 2000);
}

// Debounced toggle: prevent rapid-fire toggles
let _toggleTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

function debouncedToggleSync(todo: Todo) {
  const existing = _toggleTimeouts.get(todo.id);
  if (existing) clearTimeout(existing);
  _toggleTimeouts.set(todo.id, setTimeout(() => {
    _toggleTimeouts.delete(todo.id);
    debouncedSyncTodo(todo);
  }, 300));
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Sanitize a todo to ensure all required fields exist
function ensureTodoShape(t: any): Todo {
  return {
    id: typeof t.id === 'string' ? t.id : makeId(),
    title: typeof t.title === 'string' ? t.title : '',
    completed: typeof t.completed === 'boolean' ? t.completed : false,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : nowISO(),
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : (t.createdAt || nowISO()),
    logicalDate: isValidDate(t.logicalDate) ? t.logicalDate : safeLogicalDate(),
    order: typeof t.order === 'number' && isFinite(t.order) ? t.order : 0,
    type: t.type === 'audio' ? 'audio' : 'task',
    priority: ['high', 'medium', 'low', null].includes(t.priority) ? t.priority : null,
    category: ['work', 'personal', 'health', 'learning', 'finance', 'creative', null].includes(t.category) ? t.category : null,
    pomodoroMinutesLogged: typeof t.pomodoroMinutesLogged === 'number' ? t.pomodoroMinutesLogged : 0,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    notes: typeof t.notes === 'string' ? t.notes : '',
    syncStatus: (t.syncStatus || 'pending') as SyncStatus,
    ...(t.carriedOverFrom ? { carriedOverFrom: t.carriedOverFrom } : {}),
    ...(t.recurrence ? { recurrence: t.recurrence } : {}),
    ...(t.recurringParentId ? { recurringParentId: t.recurringParentId } : {}),
    ...(t.timeTracking ? { timeTracking: t.timeTracking } : {}),
    ...(t.audioUri ? { audioUri: t.audioUri } : {}),
    ...(t.audioDuration ? { audioDuration: t.audioDuration } : {}),
    ...(t.estimatedMinutes != null ? { estimatedMinutes: t.estimatedMinutes } : {}),
    ...(t.pomodoroWork != null ? { pomodoroWork: t.pomodoroWork } : {}),
    ...(t.pomodoroBreak != null ? { pomodoroBreak: t.pomodoroBreak } : {}),
    ...(t.pomodoroPreset ? { pomodoroPreset: t.pomodoroPreset } : {}),
  };
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],

      addTodo: (title: string, priority?: Priority, category?: Category, date?: string, recurrence?: Recurrence) => {
        const trimmedTitle = (title || '').trim();
        if (!trimmedTitle) return;
        // Safety: cap title length
        const safeTitle = trimmedTitle.slice(0, 500);

        const logicalDate = (date && isValidDate(date)) ? date : safeLogicalDate();
        const currentTodos = get().todos;

        // Safety: prevent exceeding total limit
        if (currentTodos.length >= MAX_TODOS) {
          console.warn('[store] Todo limit reached, cannot add more');
          return;
        }

        // Safety: prevent too many tasks per day
        const todayTodos = currentTodos.filter(t => t.logicalDate === logicalDate);
        if (todayTodos.length >= MAX_TODOS_PER_DAY) {
          console.warn('[store] Daily todo limit reached');
          return;
        }

        const now = nowISO();
        const newTodo: Todo = {
          id: makeId(),
          title: safeTitle,
          completed: false,
          createdAt: now,
          updatedAt: now,
          logicalDate,
          order: todayTodos.length,
          type: 'task',
          priority: priority ?? null,
          category: category ?? null,
          pomodoroMinutesLogged: 0,
          subtasks: [],
          notes: '',
          syncStatus: 'pending',
          ...(recurrence ? { recurrence } : {}),
        };
        set(state => ({ todos: [...state.todos, newTodo] }));
        debouncedSyncTodo(newTodo);
        debouncedNotifRefresh();
      },

      toggleTodo: (id: string) => {
        if (!id) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedToggleSync(todo);
        debouncedNotifRefresh();
      },

      deleteTodo: (id: string) => {
        if (!id) return;
        set(state => ({
          todos: state.todos.filter(t => t.id !== id),
        }));
        const username = getUsername();
        if (username) syncDeleteTodoFromFirestore(username, id).catch(() => {});
      },

      restoreTodo: (todo: Todo) => {
        if (!todo?.id) return;
        const safeTodo = ensureTodoShape(todo);
        set(state => ({ todos: [...state.todos, safeTodo] }));
        debouncedSyncTodo(safeTodo);
      },

      updateTodo: (id: string, updates: Partial<Todo>) => {
        if (!id) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, ...updates, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedSyncTodo(todo);
      },

      reorderTodos: (ids: string[]) => {
        if (!Array.isArray(ids) || ids.length === 0) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t => {
            const idx = ids.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t;
          }),
        }));
        const username = getUsername();
        if (username) {
          const reordered = get().todos.filter(t => ids.includes(t.id));
          bulkSyncTodosToFirestore(username, reordered).catch(() => {});
        }
      },

      getTodayTodos: () => {
        const logicalDate = safeLogicalDate();
        return sortTodos(
          get().todos.filter(t => t.logicalDate === logicalDate)
        );
      },

      getTodosForDate: (date: string) => {
        if (!isValidDate(date)) return [];
        return sortTodos(
          get().todos.filter(t => t.logicalDate === date)
        );
      },

      carryOverTodos: () => {
        const logicalDate = safeLogicalDate();
        const yesterdayStr = getLogicalYesterday();
        const now = nowISO();

        set(state => {
          const incomplete = state.todos.filter(
            t => t.logicalDate === yesterdayStr && !t.completed
          );
          if (incomplete.length === 0) return state;
          const carried = incomplete.map((t, i) => ({
            ...t,
            id: makeId(),
            logicalDate,
            carriedOverFrom: t.logicalDate,
            order: i,
            createdAt: now,
            updatedAt: now,
            syncStatus: 'pending' as SyncStatus,
          }));
          return { todos: [...state.todos, ...carried] };
        });

        try {
          const username = getUsername();
          if (username) {
            const carried = get().todos.filter(
              t => t.logicalDate === logicalDate && t.carriedOverFrom
            );
            if (carried.length > 0) {
              bulkSyncTodosToFirestore(username, carried).catch(() => {});
            }
          }
        } catch {
          // Fail silently — carry-over data stays local
        }
      },

      autoCarryOldTodos: () => {
        const logicalDate = safeLogicalDate();
        const now = nowISO();

        // Find all incomplete tasks from 2+ days ago that haven't been carried over to today
        const todayTodos = get().todos.filter(t => t.logicalDate === logicalDate);
        const alreadyCarriedTitles = new Set(
          todayTodos.filter(t => t.carriedOverFrom).map(t => t.title)
        );

        // Use logical date for 2-days-ago calculation (respects 5am boundary)
        const logicalToday = new Date(logicalDate + 'T12:00:00');
        const twoDaysAgo = new Date(logicalToday);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

        const oldIncomplete = get().todos.filter(
          t => t.logicalDate && t.logicalDate <= twoDaysAgoStr && !t.completed && !alreadyCarriedTitles.has(t.title)
        );

        if (oldIncomplete.length === 0) return 0;

        // Safety: don't carry over more than 50 at once
        const toCarry = oldIncomplete.slice(0, 50);

        const carried = toCarry.map((t, i) => ({
          ...t,
          id: makeId(),
          logicalDate,
          carriedOverFrom: t.logicalDate,
          order: todayTodos.length + i,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending' as SyncStatus,
        }));

        set(state => ({ todos: [...state.todos, ...carried] }));

        try {
          const username = getUsername();
          if (username) {
            bulkSyncTodosToFirestore(username, carried).catch(() => {});
          }
        } catch {
          // Fail silently
        }

        return carried.length;
      },

      logPomodoroMinutes: (id: string, minutes: number) => {
        if (!id || typeof minutes !== 'number' || minutes <= 0 || !isFinite(minutes)) return;
        const now = nowISO();
        // Cap at 600 minutes (10 hours) per single log to prevent corrupt data
        const safeMinutes = Math.min(minutes, 600);
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, pomodoroMinutesLogged: (t.pomodoroMinutesLogged || 0) + safeMinutes, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedSyncTodo(todo);
      },

      addSubtask: (todoId: string, title: string) => {
        if (!todoId || !title?.trim()) return;
        const now = nowISO();
        const subtask: Subtask = {
          id: makeId(),
          title: title.trim().slice(0, 500),
          completed: false,
        };
        set(state => ({
          todos: state.todos.map(t => {
            if (t.id !== todoId) return t;
            // Safety: cap subtasks at 100
            const existing = Array.isArray(t.subtasks) ? t.subtasks : [];
            if (existing.length >= 100) return t;
            return { ...t, subtasks: [...existing, subtask], updatedAt: now, syncStatus: 'pending' as SyncStatus };
          }),
        }));
        const todo = get().todos.find(t => t.id === todoId);
        if (todo) debouncedSyncTodo(todo);
      },

      toggleSubtask: (todoId: string, subtaskId: string) => {
        if (!todoId || !subtaskId) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === todoId
              ? {
                  ...t,
                  subtasks: (t.subtasks || []).map(s =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                  ),
                  updatedAt: now,
                  syncStatus: 'pending' as SyncStatus,
                }
              : t
          ),
        }));
        const todo = get().todos.find(t => t.id === todoId);
        if (todo) debouncedSyncTodo(todo);
      },

      deleteSubtask: (todoId: string, subtaskId: string) => {
        if (!todoId || !subtaskId) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === todoId
              ? {
                  ...t,
                  subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId),
                  updatedAt: now,
                  syncStatus: 'pending' as SyncStatus,
                }
              : t
          ),
        }));
        const todo = get().todos.find(t => t.id === todoId);
        if (todo) debouncedSyncTodo(todo);
      },

      startTimeTracking: (id: string) => {
        if (!id) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? {
              ...t,
              timeTracking: {
                startedAt: new Date().toISOString(),
                totalSeconds: t.timeTracking?.totalSeconds || 0,
              },
              updatedAt: now,
              syncStatus: 'pending' as SyncStatus,
            } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedSyncTodo(todo);
      },

      stopTimeTracking: (id: string) => {
        if (!id) return;
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t => {
            if (t.id !== id || !t.timeTracking?.startedAt) return t;
            const startTime = new Date(t.timeTracking.startedAt).getTime();
            // Safety: if startTime is invalid or in the future, don't add elapsed
            if (isNaN(startTime) || startTime > Date.now()) {
              return {
                ...t,
                timeTracking: { totalSeconds: t.timeTracking.totalSeconds || 0, startedAt: undefined },
                updatedAt: now,
                syncStatus: 'pending' as SyncStatus,
              };
            }
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            // Cap at 24 hours to prevent corrupt data from bad timestamps
            const safeElapsed = Math.min(elapsed, 86400);
            return {
              ...t,
              timeTracking: {
                totalSeconds: (t.timeTracking.totalSeconds || 0) + safeElapsed,
                startedAt: undefined,
              },
              updatedAt: now,
              syncStatus: 'pending' as SyncStatus,
            };
          }),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedSyncTodo(todo);
      },

      spawnRecurringTasks: () => {
        try {
          const logicalDate = safeLogicalDate();
          const state = get();
          const recurringTemplates = state.todos.filter(t => t.recurrence);
          const todayTodos = state.todos.filter(t => t.logicalDate === logicalDate);
          const now = nowISO();
          const dayOfWeek = getLogicalDayOfWeek();

          const newTodos: Todo[] = [];
          for (const template of recurringTemplates) {
            if (!template.recurrence) continue;
            const alreadyExists = todayTodos.some(
              t => t.recurringParentId === template.id
            );
            if (alreadyExists) continue;
            if (template.logicalDate === logicalDate && !template.recurringParentId) continue;

            let shouldSpawn = false;
            if (template.recurrence.type === 'daily') {
              shouldSpawn = true;
            } else if (template.recurrence.type === 'weekly' || template.recurrence.type === 'custom') {
              shouldSpawn = Array.isArray(template.recurrence.days) && template.recurrence.days.includes(dayOfWeek);
            }

            if (shouldSpawn) {
              newTodos.push({
                id: makeId(),
                title: template.title,
                completed: false,
                createdAt: now,
                updatedAt: now,
                logicalDate,
                order: todayTodos.length + newTodos.length,
                type: 'task',
                priority: template.priority,
                category: template.category,
                pomodoroMinutesLogged: 0,
                subtasks: [],
                notes: '',
                syncStatus: 'pending',
                recurrence: template.recurrence,
                recurringParentId: template.id,
              });
            }
          }

          if (newTodos.length > 0) {
            set(state => ({ todos: [...state.todos, ...newTodos] }));
            try {
              const username = getUsername();
              if (username) {
                bulkSyncTodosToFirestore(username, newTodos).catch(() => {});
              }
            } catch {}
          }
        } catch (e) {
          console.warn('[store] spawnRecurringTasks error:', e);
        }
      },

      addSampleTasks: () => {
        const logicalDate = safeLogicalDate();
        const now = nowISO();
        const samples = [
          { title: 'Welcome to untodo — tap to start a pomodoro', order: 0 },
          { title: 'Long press me for quick actions', order: 1 },
          { title: 'Swipe left or use quick actions to delete', order: 2 },
        ];
        const newTodos: Todo[] = samples.map(s => ({
          id: makeId(),
          title: s.title,
          completed: false,
          createdAt: now,
          updatedAt: now,
          logicalDate,
          order: s.order,
          type: 'task' as const,
          priority: null,
          category: null,
          pomodoroMinutesLogged: 0,
          subtasks: [],
          notes: '',
          syncStatus: 'pending' as SyncStatus,
        }));
        set(state => ({ todos: [...state.todos, ...newTodos] }));
        const username = getUsername();
        if (username) {
          bulkSyncTodosToFirestore(username, newTodos).catch(() => {});
        }
      },

      syncFromFirestore: async () => {
        const username = getUsername();
        if (!username) return;
        // Guard against concurrent sync calls (e.g. pull-to-refresh + auto-sync)
        if (isSyncFromFirestoreInProgress()) return;
        setSyncFromFirestoreInProgress(true);
        try {
          // Also flush any queued offline writes
          await flushOfflineQueue().catch(() => {});

          const remote = await fetchAllTodosFromFirestore(username);
          if (remote.length === 0) {
            const local = get().todos;
            if (local.length > 0) {
              bulkSyncTodosToFirestore(username, local).catch(() => {});
            }
            return;
          }
          // Re-read local AFTER flush to get the freshest state
          const local = get().todos;
          const merged = mergeTodos(local, remote);

          // Safety: deduplicate by ID (shouldn't happen but just in case)
          const seen = new Set<string>();
          const deduped = merged.filter(t => {
            if (!t.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });

          set({ todos: deduped });
          const remoteIds = new Set(remote.map(t => t.id));
          const localOnly = deduped.filter(t => !remoteIds.has(t.id));
          if (localOnly.length > 0) {
            bulkSyncTodosToFirestore(username, localOnly).catch(() => {});
          }
        } catch {
          // Fail silently — data stays local
        } finally {
          setSyncFromFirestoreInProgress(false);
        }
      },
    }),
    {
      name: 'untodo-todos',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted: any, version: number) => {
        try {
          const state = persisted as { todos?: any[] };
          let todos = Array.isArray(state.todos) ? state.todos : [];

          // v0 -> v1: Add missing fields
          if (version === 0 || !version || version === 1) {
            todos = todos.map((t: any) => {
              if (!t || typeof t !== 'object') return null;
              return ensureTodoShape(t);
            }).filter(Boolean);
          }

          // Deduplicate by ID
          const seen = new Set<string>();
          todos = todos.filter((t: any) => {
            if (!t?.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });

          // Remove todos with empty titles (corrupted data)
          todos = todos.filter((t: any) => t.title && t.title.trim().length > 0);

          return { ...state, todos };
        } catch (e) {
          console.warn('[store] Migration failed, starting with safe defaults:', e);
          return { todos: [] };
        }
      },
    }
  )
);
