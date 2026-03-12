import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo, Priority, Category, Subtask, SyncStatus, Recurrence } from './types';
import { getLogicalDate } from '../../lib/date-utils';
import { useUserStore } from '../user/store';
import {
  syncTodoToFirestore,
  syncDeleteTodoFromFirestore,
  fetchAllTodosFromFirestore,
  mergeTodos,
  bulkSyncTodosToFirestore,
} from '../../lib/firebase-sync';

interface TodoStore {
  todos: Todo[];
  addTodo: (title: string, priority?: Priority, category?: Category, date?: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  reorderTodos: (ids: string[]) => void;
  getTodayTodos: () => Todo[];
  getTodosForDate: (date: string) => Todo[];
  carryOverTodos: () => void;
  logPomodoroMinutes: (id: string, minutes: number) => void;
  addSubtask: (todoId: string, title: string) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;
  syncFromFirestore: () => Promise<void>;
  addSampleTasks: () => void;
  spawnRecurringTasks: () => void;
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pa = a.priority ? { high: 0, medium: 1, low: 2 }[a.priority] : 3;
    const pb = b.priority ? { high: 0, medium: 1, low: 2 }[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return a.order - b.order;
  });
}

function getUsername(): string | null {
  return useUserStore.getState().username;
}

function nowISO(): string {
  return new Date().toISOString();
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

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],

      addTodo: (title: string, priority?: Priority, category?: Category, date?: string) => {
        const logicalDate = date || getLogicalDate();
        const todayTodos = get().todos.filter(t => t.logicalDate === logicalDate);
        const now = nowISO();
        const newTodo: Todo = {
          id: makeId(),
          title,
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
        };
        set(state => ({ todos: [...state.todos, newTodo] }));
        debouncedSyncTodo(newTodo);
      },

      toggleTodo: (id: string) => {
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedToggleSync(todo);
      },

      deleteTodo: (id: string) => {
        set(state => ({
          todos: state.todos.filter(t => t.id !== id),
        }));
        const username = getUsername();
        if (username) syncDeleteTodoFromFirestore(username, id).catch(() => {});
      },

      updateTodo: (id: string, updates: Partial<Todo>) => {
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
        const logicalDate = getLogicalDate();
        return sortTodos(
          get().todos.filter(t => t.logicalDate === logicalDate)
        );
      },

      getTodosForDate: (date: string) => {
        return sortTodos(
          get().todos.filter(t => t.logicalDate === date)
        );
      },

      carryOverTodos: () => {
        const logicalDate = getLogicalDate();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const now = nowISO();

        set(state => {
          const incomplete = state.todos.filter(
            t => t.logicalDate === yesterdayStr && !t.completed
          );
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

        const username = getUsername();
        if (username) {
          const carried = get().todos.filter(
            t => t.logicalDate === logicalDate && t.carriedOverFrom
          );
          bulkSyncTodosToFirestore(username, carried).catch(() => {});
        }
      },

      logPomodoroMinutes: (id: string, minutes: number) => {
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, pomodoroMinutesLogged: (t.pomodoroMinutesLogged || 0) + minutes, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) debouncedSyncTodo(todo);
      },

      addSubtask: (todoId: string, title: string) => {
        const now = nowISO();
        const subtask: Subtask = {
          id: makeId(),
          title,
          completed: false,
        };
        set(state => ({
          todos: state.todos.map(t =>
            t.id === todoId
              ? { ...t, subtasks: [...(t.subtasks || []), subtask], updatedAt: now, syncStatus: 'pending' as SyncStatus }
              : t
          ),
        }));
        const todo = get().todos.find(t => t.id === todoId);
        if (todo) debouncedSyncTodo(todo);
      },

      toggleSubtask: (todoId: string, subtaskId: string) => {
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

      spawnRecurringTasks: () => {
        const logicalDate = getLogicalDate();
        const state = get();
        // Find all tasks with recurrence set (these are templates)
        const recurringTemplates = state.todos.filter(t => t.recurrence);
        const todayTodos = state.todos.filter(t => t.logicalDate === logicalDate);
        const now = nowISO();
        const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...6=Sat

        const newTodos: Todo[] = [];
        for (const template of recurringTemplates) {
          if (!template.recurrence) continue;
          // Check if already spawned for today
          const alreadyExists = todayTodos.some(
            t => t.recurringParentId === template.id
          );
          if (alreadyExists) continue;
          // Also skip if the template itself is for today (don't duplicate)
          if (template.logicalDate === logicalDate && !template.recurringParentId) continue;

          let shouldSpawn = false;
          if (template.recurrence.type === 'daily') {
            shouldSpawn = true;
          } else if (template.recurrence.type === 'weekly') {
            shouldSpawn = (template.recurrence.days || []).includes(dayOfWeek);
          } else if (template.recurrence.type === 'custom') {
            shouldSpawn = (template.recurrence.days || []).includes(dayOfWeek);
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
          const username = getUsername();
          if (username) {
            bulkSyncTodosToFirestore(username, newTodos).catch(() => {});
          }
        }
      },

      addSampleTasks: () => {
        const logicalDate = getLogicalDate();
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
        try {
          const remote = await fetchAllTodosFromFirestore(username);
          if (remote.length === 0) {
            const local = get().todos;
            if (local.length > 0) {
              bulkSyncTodosToFirestore(username, local).catch(() => {});
            }
            return;
          }
          const local = get().todos;
          const merged = mergeTodos(local, remote);
          set({ todos: merged });
          const remoteIds = new Set(remote.map(t => t.id));
          const localOnly = merged.filter(t => !remoteIds.has(t.id));
          if (localOnly.length > 0) {
            bulkSyncTodosToFirestore(username, localOnly).catch(() => {});
          }
        } catch {
          // Fail silently — data stays local
        }
      },
    }),
    {
      name: 'untodo-todos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
