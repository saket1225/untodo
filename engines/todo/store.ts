import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo } from './types';
import { getLogicalDate } from '../../lib/date-utils';

interface TodoStore {
  todos: Todo[];
  addTodo: (title: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  reorderTodos: (ids: string[]) => void;
  getTodayTodos: () => Todo[];
  getTodosForDate: (date: string) => Todo[];
  carryOverTodos: () => void;
}

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      todos: [],

      addTodo: (title: string) => {
        const logicalDate = getLogicalDate();
        const todayTodos = get().todos.filter(t => t.logicalDate === logicalDate);
        const newTodo: Todo = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          logicalDate,
          order: todayTodos.length,
          type: 'task',
        };
        set(state => ({ todos: [...state.todos, newTodo] }));
      },

      toggleTodo: (id: string) => {
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        }));
      },

      deleteTodo: (id: string) => {
        set(state => ({
          todos: state.todos.filter(t => t.id !== id),
        }));
      },

      updateTodo: (id: string, updates: Partial<Todo>) => {
        set(state => ({
          todos: state.todos.map(t =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      reorderTodos: (ids: string[]) => {
        set(state => ({
          todos: state.todos.map(t => {
            const idx = ids.indexOf(t.id);
            return idx >= 0 ? { ...t, order: idx } : t;
          }),
        }));
      },

      getTodayTodos: () => {
        const logicalDate = getLogicalDate();
        return get().todos
          .filter(t => t.logicalDate === logicalDate)
          .sort((a, b) => a.order - b.order);
      },

      getTodosForDate: (date: string) => {
        return get().todos
          .filter(t => t.logicalDate === date)
          .sort((a, b) => a.order - b.order);
      },

      carryOverTodos: () => {
        const logicalDate = getLogicalDate();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

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
            createdAt: new Date().toISOString(),
          }));
          return { todos: [...state.todos, ...carried] };
        });
      },
    }),
    {
      name: 'untodo-todos',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
