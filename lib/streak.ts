import { Todo } from '../engines/todo/types';

/**
 * Calculate streak: consecutive days (going backwards from today) with at least one task completed.
 * Days with no tasks are skipped (don't break the streak).
 * Returns the streak count.
 */
export function calculateStreak(allTodos: Todo[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];
  const todayCompleted = allTodos.some(t => t.logicalDate === todayStr && t.completed);

  let streak = 0;
  const startDay = new Date(today);

  if (todayCompleted) {
    streak = 1;
    startDay.setDate(startDay.getDate() - 1);
  } else {
    startDay.setDate(startDay.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = startDay.toISOString().split('T')[0];
    const dayTodos = allTodos.filter(t => t.logicalDate === dateStr);
    if (dayTodos.length === 0) {
      // No tasks that day — skip, don't break
      startDay.setDate(startDay.getDate() - 1);
      continue;
    }
    if (dayTodos.some(t => t.completed)) {
      streak++;
      startDay.setDate(startDay.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
