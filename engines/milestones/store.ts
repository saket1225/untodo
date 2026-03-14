import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTodoStore } from '../todo/store';

export interface TaskMilestone {
  threshold: number;
  title: string;
  message: string;
  emoji: string;
}

export const TASK_MILESTONES: TaskMilestone[] = [
  { threshold: 10, title: '10 Tasks Done!', message: "You're getting started. Momentum is building.", emoji: '◎' },
  { threshold: 25, title: '25 Tasks Crushed!', message: "A quarter century of tasks. You're locked in.", emoji: '◈' },
  { threshold: 50, title: 'Half Century!', message: "50 tasks completed. You're in the top 10% of untodo users.", emoji: '◇' },
  { threshold: 100, title: 'Centurion!', message: "100 tasks. You're in the top 1% of untodo users.", emoji: '◆' },
  { threshold: 250, title: 'Quarter Thousand!', message: '250 tasks completed. Absolute machine.', emoji: '◉' },
  { threshold: 500, title: 'Half K!', message: "500 tasks done. You don't stop.", emoji: '●' },
  { threshold: 1000, title: 'The Thousand!', message: "1,000 tasks. Legend status. They'll write about you.", emoji: '◉' },
];

interface MilestoneStore {
  celebratedMilestones: number[]; // thresholds already celebrated
  pendingMilestone: TaskMilestone | null;
  checkMilestones: () => void;
  dismissMilestone: () => void;
}

export const useMilestoneStore = create<MilestoneStore>()(
  persist(
    (set, get) => ({
      celebratedMilestones: [],
      pendingMilestone: null,

      checkMilestones: () => {
        const todos = useTodoStore.getState().todos;
        const totalCompleted = todos.filter(t => t.completed).length;
        const celebrated = get().celebratedMilestones;

        // Find the highest milestone that should be celebrated
        for (const milestone of TASK_MILESTONES) {
          if (totalCompleted >= milestone.threshold && !celebrated.includes(milestone.threshold)) {
            set({
              pendingMilestone: milestone,
              celebratedMilestones: [...celebrated, milestone.threshold],
            });
            return;
          }
        }
      },

      dismissMilestone: () => {
        set({ pendingMilestone: null });
      },
    }),
    {
      name: 'untodo-milestones',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        celebratedMilestones: state.celebratedMilestones,
      }),
    }
  )
);
