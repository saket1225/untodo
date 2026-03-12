export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
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
}
