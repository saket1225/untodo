export interface DaySummary {
  date: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  pomodoroMinutes: number;
  note?: string;
}

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  completionRate: number;
  totalCompleted: number;
  totalTasks: number;
  pomodoroMinutes: number;
  topStreak: number;
  review: string;
}

export interface HabitEntry {
  id: string;
  name: string;
  streak: number;
  lastCompleted: string;
  history: string[];
}
