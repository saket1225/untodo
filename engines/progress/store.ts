import { create } from 'zustand';
import { DailyStats } from './types';

interface ProgressStore {
  dailyStats: DailyStats[];
}

export const useProgressStore = create<ProgressStore>(() => ({
  dailyStats: [],
}));
