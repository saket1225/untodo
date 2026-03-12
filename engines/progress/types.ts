export interface DailyStats {
  date: string;
  totalTodos: number;
  completedTodos: number;
  focusMinutes: number;
}

export interface WeeklyStats {
  weekStart: string;
  days: DailyStats[];
  completionRate: number;
}
