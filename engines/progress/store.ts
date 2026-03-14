import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DaySummary, WeeklyReview, HabitEntry } from './types';
import { useTodoStore } from '../todo/store';
import { useUserStore } from '../user/store';
import {
  syncDaySummaryToFirestore,
  syncWeeklyReviewToFirestore,
} from '../../lib/firebase-sync';

interface ProgressStore {
  daySummaries: DaySummary[];
  weeklyReviews: WeeklyReview[];
  habits: HabitEntry[];
  addDaySummary: (summary: DaySummary) => void;
  addWeeklyReview: (review: WeeklyReview) => void;
  addHabit: (name: string) => void;
  logHabit: (id: string) => void;
  getStreaks: () => HabitEntry[];
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function getWeekStats() {
  const todos = useTodoStore.getState().todos;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const weekDays: DaySummary[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatDate(current);
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const total = dayTodos.length;
    const completed = dayTodos.filter(t => t.completed).length;
    weekDays.push({
      date: dateStr,
      completedTasks: completed,
      totalTasks: total,
      completionRate: total > 0 ? completed / total : 0,
      pomodoroMinutes: 0,
    });
    current.setDate(current.getDate() + 1);
  }

  const totalCompleted = weekDays.reduce((s, d) => s + d.completedTasks, 0);
  const totalTasks = weekDays.reduce((s, d) => s + d.totalTasks, 0);
  const completionRate = totalTasks > 0 ? totalCompleted / totalTasks : 0;

  return { weekDays, totalCompleted, totalTasks, completionRate };
}

export function getRecentDays(count: number = 14): DaySummary[] {
  const todos = useTodoStore.getState().todos;
  const days: DaySummary[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = formatDate(d);
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const total = dayTodos.length;
    const completed = dayTodos.filter(t => t.completed).length;
    days.push({
      date: dateStr,
      completedTasks: completed,
      totalTasks: total,
      completionRate: total > 0 ? completed / total : 0,
      pomodoroMinutes: 0,
    });
  }
  return days;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      daySummaries: [],
      weeklyReviews: [],
      habits: [],

      addDaySummary: (summary: DaySummary) => {
        set(state => ({
          daySummaries: [
            ...state.daySummaries.filter(s => s.date !== summary.date),
            summary,
          ],
        }));
        const username = useUserStore.getState().username;
        if (username) syncDaySummaryToFirestore(username, summary).catch(() => {});
      },

      addWeeklyReview: (review: WeeklyReview) => {
        set(state => ({
          weeklyReviews: [
            ...state.weeklyReviews.filter(r => r.weekStart !== review.weekStart),
            review,
          ],
        }));
        const username = useUserStore.getState().username;
        if (username) syncWeeklyReviewToFirestore(username, review).catch(() => {});
      },

      addHabit: (name: string) => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        set(state => ({
          habits: [...state.habits, { id, name, streak: 0, lastCompleted: '', history: [] }],
        }));
      },

      logHabit: (id: string) => {
        const today = formatDate(new Date());
        set(state => ({
          habits: state.habits.map(h => {
            if (h.id !== id) return h;
            if (h.history.includes(today)) return h;
            const yesterday = formatDate(new Date(Date.now() - 86400000));
            const newStreak = h.lastCompleted === yesterday ? h.streak + 1 : 1;
            return {
              ...h,
              streak: newStreak,
              lastCompleted: today,
              history: [...h.history, today],
            };
          }),
        }));
      },

      getStreaks: () => {
        return get().habits.filter(h => h.streak > 0);
      },
    }),
    {
      name: 'untodo-progress',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted: any, version: number) => {
        try {
          const state = (persisted || {}) as { daySummaries?: any[]; weeklyReviews?: any[]; habits?: any[] };
          return {
            ...state,
            daySummaries: Array.isArray(state.daySummaries) ? state.daySummaries.filter((s: any) => s && typeof s.date === 'string') : [],
            weeklyReviews: Array.isArray(state.weeklyReviews) ? state.weeklyReviews.filter((r: any) => r && typeof r.weekStart === 'string') : [],
            habits: Array.isArray(state.habits) ? state.habits.filter((h: any) => h && h.id).map((h: any) => ({
              ...h,
              streak: typeof h.streak === 'number' ? h.streak : 0,
              lastCompleted: typeof h.lastCompleted === 'string' ? h.lastCompleted : '',
              history: Array.isArray(h.history) ? h.history : [],
            })) : [],
          };
        } catch {
          return { daySummaries: [], weeklyReviews: [], habits: [] };
        }
      },
    }
  )
);
