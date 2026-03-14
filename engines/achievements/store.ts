import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTodoStore } from '../todo/store';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

interface AchievementStore {
  achievements: Achievement[];
  lastChecked: string;
  newlyUnlocked: string[]; // IDs of achievements unlocked but not yet celebrated
  checkAchievements: () => string[]; // returns newly unlocked IDs
  dismissCelebration: (id: string) => void;
  dismissAllCelebrations: () => void;
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first_task', title: 'First Task', description: 'Add your first task', icon: '◉' },
  { id: 'getting_started', title: 'Getting Started', description: 'Complete 5 tasks', icon: '◎' },
  { id: 'on_a_roll', title: 'On a Roll', description: '3 day streak', icon: '◈' },
  { id: 'week_warrior', title: 'Week Warrior', description: '7 day streak', icon: '◇' },
  { id: 'centurion', title: 'Centurion', description: 'Complete 100 tasks', icon: '◆' },
  { id: 'focus_master', title: 'Focus Master', description: '5 hours total focus time', icon: '◧' },
  { id: 'night_owl', title: 'Night Owl', description: 'Complete a task after midnight', icon: '◑' },
  { id: 'early_bird', title: 'Early Bird', description: 'Complete a task before 7am', icon: '◐' },
  { id: 'perfect_day', title: 'Perfect Day', description: 'Complete all tasks in a day', icon: '●' },
  { id: 'perfect_week', title: 'Perfect Week', description: 'All tasks done for 7 days straight', icon: '◉' },
];

function computeUnlocks(): Set<string> {
  const todos = useTodoStore.getState().todos;
  const unlocked = new Set<string>();

  if (todos.length === 0) return unlocked;

  // First Task: any task exists
  if (todos.length > 0) unlocked.add('first_task');

  // Getting Started: 5 completed
  const completedTodos = todos.filter(t => t.completed);
  if (completedTodos.length >= 5) unlocked.add('getting_started');

  // Centurion: 100 completed
  if (completedTodos.length >= 100) unlocked.add('centurion');

  // Focus Master: 5 hours total focus
  let totalFocusMins = 0;
  todos.forEach(t => {
    totalFocusMins += t.pomodoroMinutesLogged || 0;
    if (t.timeTracking?.totalSeconds) totalFocusMins += Math.floor(t.timeTracking.totalSeconds / 60);
  });
  if (totalFocusMins >= 300) unlocked.add('focus_master');

  // Night Owl: completed task after midnight (0-5am)
  const nightOwl = completedTodos.some(t => {
    if (!t.updatedAt) return false;
    const hour = new Date(t.updatedAt).getHours();
    return hour >= 0 && hour < 5;
  });
  if (nightOwl) unlocked.add('night_owl');

  // Early Bird: completed before 7am (5-7am)
  const earlyBird = completedTodos.some(t => {
    if (!t.updatedAt) return false;
    const hour = new Date(t.updatedAt).getHours();
    return hour >= 5 && hour < 7;
  });
  if (earlyBird) unlocked.add('early_bird');

  // Streak-based achievements
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build daily completion map
  const dayMap = new Map<string, { completed: number; total: number }>();
  todos.forEach(t => {
    if (!t.logicalDate) return;
    const entry = dayMap.get(t.logicalDate) || { completed: 0, total: 0 };
    entry.total++;
    if (t.completed) entry.completed++;
    dayMap.set(t.logicalDate, entry);
  });

  // Perfect Day: all tasks done in any single day (min 1 task)
  for (const [, entry] of dayMap) {
    if (entry.total > 0 && entry.completed === entry.total) {
      unlocked.add('perfect_day');
      break;
    }
  }

  // Calculate streak and perfect week
  const sortedDates = [...dayMap.keys()].sort();
  if (sortedDates.length > 0) {
    const firstDate = new Date(sortedDates[0] + 'T12:00:00');
    const lastDate = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00');
    let currentStreak = 0;
    let longestStreak = 0;
    let perfectDayStreak = 0;
    let longestPerfectStreak = 0;

    const d = new Date(firstDate);
    while (d <= lastDate) {
      const dateStr = d.toISOString().split('T')[0];
      const entry = dayMap.get(dateStr);
      if (entry && entry.total > 0) {
        if (entry.completed / entry.total >= 0.5) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
        if (entry.completed === entry.total) {
          perfectDayStreak++;
          longestPerfectStreak = Math.max(longestPerfectStreak, perfectDayStreak);
        } else {
          perfectDayStreak = 0;
        }
      } else {
        // Skip days with no tasks (don't break streak)
      }
      d.setDate(d.getDate() + 1);
    }

    if (longestStreak >= 3) unlocked.add('on_a_roll');
    if (longestStreak >= 7) unlocked.add('week_warrior');
    if (longestPerfectStreak >= 7) unlocked.add('perfect_week');
  }

  return unlocked;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set, get) => ({
      achievements: ACHIEVEMENT_DEFS.map(d => ({ ...d, unlockedAt: null })),
      lastChecked: '',
      newlyUnlocked: [],

      checkAchievements: () => {
        const shouldUnlock = computeUnlocks();
        const current = get().achievements;
        const newUnlocks: string[] = [];
        const now = new Date().toISOString();

        const updated = current.map(a => {
          if (a.unlockedAt) return a; // already unlocked
          if (shouldUnlock.has(a.id)) {
            newUnlocks.push(a.id);
            return { ...a, unlockedAt: now };
          }
          return a;
        });

        // Also add any missing achievements from ACHIEVEMENT_DEFS
        const existingIds = new Set(updated.map(a => a.id));
        for (const def of ACHIEVEMENT_DEFS) {
          if (!existingIds.has(def.id)) {
            const isUnlocked = shouldUnlock.has(def.id);
            updated.push({ ...def, unlockedAt: isUnlocked ? now : null });
            if (isUnlocked) newUnlocks.push(def.id);
          }
        }

        if (newUnlocks.length > 0) {
          set({
            achievements: updated,
            lastChecked: now,
            newlyUnlocked: [...get().newlyUnlocked, ...newUnlocks],
          });
        } else {
          set({ lastChecked: now });
        }

        return newUnlocks;
      },

      dismissCelebration: (id: string) => {
        set(state => ({
          newlyUnlocked: state.newlyUnlocked.filter(i => i !== id),
        }));
      },

      dismissAllCelebrations: () => {
        set({ newlyUnlocked: [] });
      },
    }),
    {
      name: 'untodo-achievements',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        achievements: state.achievements,
        lastChecked: state.lastChecked,
        // Don't persist newlyUnlocked - they should only show once per session
      }),
      migrate: (persisted: any) => {
        try {
          const state = (persisted || {}) as any;
          return {
            achievements: Array.isArray(state.achievements) ? state.achievements : ACHIEVEMENT_DEFS.map(d => ({ ...d, unlockedAt: null })),
            lastChecked: state.lastChecked || '',
            newlyUnlocked: [],
          };
        } catch {
          return {
            achievements: ACHIEVEMENT_DEFS.map(d => ({ ...d, unlockedAt: null })),
            lastChecked: '',
            newlyUnlocked: [],
          };
        }
      },
    }
  )
);
