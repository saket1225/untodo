export type Priority = 'high' | 'medium' | 'low' | null;
export type Category = 'work' | 'personal' | 'health' | 'learning' | 'finance' | 'creative' | null;

export const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'work', label: 'Work', color: '#60A5FA' },
  { key: 'personal', label: 'Personal', color: '#A78BFA' },
  { key: 'health', label: 'Health', color: '#34D399' },
  { key: 'learning', label: 'Learning', color: '#FBBF24' },
  { key: 'finance', label: 'Finance', color: '#F87171' },
  { key: 'creative', label: 'Creative', color: '#F472B6' },
];

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; sort: number }> = {
  high: { label: 'High', color: '#F5F5F5', sort: 0 },
  medium: { label: 'Med', color: '#FBBF24', sort: 1 },
  low: { label: 'Low', color: '#555555', sort: 2 },
};

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export type SyncStatus = 'synced' | 'pending' | 'error';

export interface Recurrence {
  type: 'daily' | 'weekly' | 'custom';
  days?: number[]; // 0=Sun, 1=Mon, ... 6=Sat (for weekly/custom)
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  logicalDate: string;
  carriedOverFrom?: string;
  order: number;
  type: 'task' | 'audio';
  audioUri?: string;
  audioDuration?: number;
  estimatedMinutes?: number;
  pomodoroWork?: number;
  pomodoroBreak?: number;
  pomodoroPreset?: string;
  priority: Priority;
  category: Category;
  pomodoroMinutesLogged: number;
  subtasks: Subtask[];
  notes: string;
  syncStatus: SyncStatus;
  recurrence?: Recurrence;
  recurringParentId?: string; // ID of the original recurring task template
}
