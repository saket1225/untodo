import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo, Priority, Category, Subtask, SyncStatus } from './types';
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
  addTodo: (title: string, priority?: Priority, category?: Category) => void;
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

// Fire-and-forget sync helper
function syncTodo(todo: Todo) {
  const username = getUsername();
  if (username) {
    syncTodoToFirestore(username, todo).catch(() => {});
  }
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],

      addTodo: (title: string, priority?: Priority, category?: Category) => {
        const logicalDate = getLogicalDate();
        const todayTodos = get().todos.filter(t => t.logicalDate === logicalDate);
        const now = nowISO();
        const newTodo: Todo = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
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
        syncTodo(newTodo);
      },

      toggleTodo: (id: string) => {
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t
          ),
        }));
        const todo = get().todos.find(t => t.id === id);
        if (todo) syncTodo(todo);
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
        if (todo) syncTodo(todo);
      },

      reorderTodos: (ids: string[]) => {
        const now = nowISO();
        set(state => ({
          todos: state.todos.map(t => {
            const idx = ids.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx, updatedAt: now, syncStatus: 'pending' as SyncStatus } : t;
          }),
        }));
        // Bulk sync reordered todos
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
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            logicalDate,
            carriedOverFrom: t.logicalDate,
            order: i,
            createdAt: now,
            updatedAt: now,
            syncStatus: 'pending' as SyncStatus,
          }));
          return { todos: [...state.todos, ...carried] };
        });

        // Sync carried todos
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
        if (todo) syncTodo(todo);
      },

      addSubtask: (todoId: string, title: string) => {
        const now = nowISO();
        const subtask: Subtask = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
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
        if (todo) syncTodo(todo);
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
        if (todo) syncTodo(todo);
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
        if (todo) syncTodo(todo);
      },

      syncFromFirestore: async () => {
        const username = getUsername();
        if (!username) return;
        const remote = await fetchAllTodosFromFirestore(username);
        if (remote.length === 0) {
          // Nothing remote — push all local
          const local = get().todos;
          if (local.length > 0) {
            bulkSyncTodosToFirestore(username, local).catch(() => {});
          }
          return;
        }
        const local = get().todos;
        const merged = mergeTodos(local, remote);
        set({ todos: merged });
        // Push any local-only todos
        const remoteIds = new Set(remote.map(t => t.id));
        const localOnly = merged.filter(t => !remoteIds.has(t.id));
        if (localOnly.length > 0) {
          bulkSyncTodosToFirestore(username, localOnly).catch(() => {});
        }
      },
    }),
    {
      name: 'untodo-todos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
