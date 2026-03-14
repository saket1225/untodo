import { create } from 'zustand';

interface PomodoroState {
  isActive: boolean;
  taskTitle: string;
  taskId: string;
  phase: 'work' | 'short-break' | 'long-break';
  secondsLeft: number;
  isFlowtime: boolean;
  setActive: (active: boolean, taskTitle?: string, taskId?: string) => void;
  updateTimer: (seconds: number, phase: 'work' | 'short-break' | 'long-break', isFlowtime?: boolean) => void;
  clear: () => void;
}

export const usePomodoroState = create<PomodoroState>((set) => ({
  isActive: false,
  taskTitle: '',
  taskId: '',
  phase: 'work',
  secondsLeft: 0,
  isFlowtime: false,
  setActive: (active, taskTitle = '', taskId = '') =>
    set({ isActive: active, taskTitle, taskId }),
  updateTimer: (seconds, phase, isFlowtime = false) =>
    set({ secondsLeft: seconds, phase, isFlowtime }),
  clear: () =>
    set({ isActive: false, taskTitle: '', taskId: '', phase: 'work', secondsLeft: 0, isFlowtime: false }),
}));
