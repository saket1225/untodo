import { Todo, CATEGORIES } from '../engines/todo/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function generateDailyInsight(todos: Todo[]): string | null {
  if (todos.length < 10) return null;

  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );

  const insights: string[] = [];

  // Analyze morning vs afternoon starts
  const earlyTasks = todos.filter(t => {
    const created = new Date(t.createdAt);
    return created.getHours() < 10 && t.completed;
  });
  const lateTasks = todos.filter(t => {
    const created = new Date(t.createdAt);
    return created.getHours() >= 10 && t.completed;
  });
  if (earlyTasks.length > 5 && lateTasks.length > 5) {
    const earlyDays = new Set(earlyTasks.map(t => t.logicalDate));
    const lateDays = new Set(lateTasks.map(t => t.logicalDate));
    const earlyAvg = earlyTasks.length / earlyDays.size;
    const lateAvg = lateTasks.length / lateDays.size;
    if (earlyAvg > lateAvg * 1.2) {
      const pct = Math.round(((earlyAvg - lateAvg) / lateAvg) * 100);
      insights.push(`You complete ${pct}% more tasks when you start before 10am`);
    }
  }

  // Most productive category
  const catCounts: Record<string, number> = {};
  todos.filter(t => t.completed && t.category).forEach(t => {
    catCounts[t.category!] = (catCounts[t.category!] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const catInfo = CATEGORIES.find(c => c.key === topCat[0]);
    if (catInfo) {
      insights.push(`Your most productive category is ${catInfo.label}`);
    }
  }

  // Day of week analysis
  const dayCompletions: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  todos.forEach(t => {
    const d = new Date(t.logicalDate + 'T12:00:00');
    const dow = d.getDay();
    dayTotals[dow]++;
    if (t.completed) dayCompletions[dow]++;
  });

  // Find least productive day
  const dayRates = dayTotals.map((total, i) =>
    total > 3 ? dayCompletions[i] / total : -1
  );
  const worstDay = dayRates.reduce(
    (min, rate, i) => (rate >= 0 && (min === -1 || rate < dayRates[min])) ? i : min,
    -1
  );
  if (worstDay >= 0 && dayRates[worstDay] < 0.6) {
    insights.push(`You tend to skip tasks on ${DAY_NAMES[worstDay]}s`);
  }

  // Current streak message
  const todayStr = today.toISOString().split('T')[0];
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const total = dayTodos.length;
    const completed = dayTodos.filter(t => t.completed).length;
    if (i === 0 && total === 0) continue;
    if (total > 0 && completed / total >= 0.5) streak++;
    else if (total > 0) break;
  }
  if (streak >= 3) {
    insights.push(`You've been consistent for ${streak} days — keep it up`);
  }

  // Monthly completed count
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthCompleted = todos.filter(t => {
    if (!t.completed) return false;
    const d = new Date(t.logicalDate + 'T12:00:00');
    return d >= monthStart && d <= today;
  }).length;
  if (monthCompleted > 10) {
    insights.push(`You've completed ${monthCompleted} tasks this month`);
  }

  // Completion time pattern
  const completedBefore2pm = todos.filter(t => {
    if (!t.completed || !t.updatedAt) return false;
    const updated = new Date(t.updatedAt);
    return updated.getHours() < 14;
  }).length;
  const totalCompleted = todos.filter(t => t.completed).length;
  if (totalCompleted > 20 && completedBefore2pm / totalCompleted > 0.6) {
    insights.push('You complete most tasks before 2pm');
  }

  // Best day of week
  const bestDay = dayRates.reduce(
    (max, rate, i) => (rate >= 0 && (max === -1 || rate > dayRates[max])) ? i : max,
    -1
  );
  if (bestDay >= 0) {
    insights.push(`${DAY_NAMES[bestDay]} is your most productive day of the week`);
  }

  // Pomodoro insight
  const pomodoroTodos = todos.filter(t => t.pomodoroMinutesLogged > 0);
  if (pomodoroTodos.length > 5) {
    const totalMins = pomodoroTodos.reduce((s, t) => s + t.pomodoroMinutesLogged, 0);
    const completedWithPomo = pomodoroTodos.filter(t => t.completed).length;
    const pomoRate = completedWithPomo / pomodoroTodos.length;
    const overallRate = todos.filter(t => t.completed).length / todos.length;
    if (pomoRate > overallRate + 0.1) {
      insights.push('Tasks with pomodoro sessions have a higher completion rate');
    }
  }

  if (insights.length === 0) return null;

  // Rotate by day
  return insights[dayOfYear % insights.length];
}

export interface AnalyticsData {
  heatmap: { date: string; count: number; rate: number }[];
  categoryBreakdown: { category: string; label: string; color: string; count: number }[];
  avgDailyCompletion: number;
  mostProductiveDay: string;
  avgPomodoroMinutes: number;
  longestStreak: number;
  totalTimeTrackedMinutes: number;
}

export function computeAnalytics(todos: Todo[]): AnalyticsData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Heatmap: last 91 days (13 weeks) for GitHub-style contribution graph
  const heatmap: { date: string; count: number; rate: number }[] = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    const completed = dayTodos.filter(t => t.completed).length;
    const total = dayTodos.length;
    heatmap.push({
      date: dateStr,
      count: completed,
      rate: total > 0 ? completed / total : 0,
    });
  }

  // Category breakdown (completed tasks)
  const catCounts: Record<string, number> = {};
  todos.filter(t => t.completed && t.category).forEach(t => {
    catCounts[t.category!] = (catCounts[t.category!] || 0) + 1;
  });
  const categoryBreakdown = CATEGORIES
    .filter(c => c.key && catCounts[c.key])
    .map(c => ({
      category: c.key!,
      label: c.label,
      color: c.color,
      count: catCounts[c.key!] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Average daily completion over 30 days
  let totalCompleted30 = 0;
  let totalTasks30 = 0;
  let daysWithTasks30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayTodos = todos.filter(t => t.logicalDate === dateStr);
    if (dayTodos.length > 0) {
      daysWithTasks30++;
      totalCompleted30 += dayTodos.filter(t => t.completed).length;
      totalTasks30 += dayTodos.length;
    }
  }
  const avgDailyCompletion = daysWithTasks30 > 0
    ? Math.round((totalCompleted30 / totalTasks30) * 100)
    : 0;

  // Most productive day of week
  const dayCompletions: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  todos.forEach(t => {
    const d = new Date(t.logicalDate + 'T12:00:00');
    const dow = d.getDay();
    dayTotals[dow]++;
    if (t.completed) dayCompletions[dow]++;
  });
  const dayRates = dayTotals.map((total, i) =>
    total > 0 ? dayCompletions[i] / total : 0
  );
  const bestDayIdx = dayRates.reduce(
    (max, rate, i) => (rate > dayRates[max] ? i : max), 0
  );
  const mostProductiveDay = DAY_NAMES[bestDayIdx];

  // Average pomodoro minutes per day
  const pomoDays = new Set<string>();
  let totalPomoMins = 0;
  todos.forEach(t => {
    if (t.pomodoroMinutesLogged > 0) {
      pomoDays.add(t.logicalDate);
      totalPomoMins += t.pomodoroMinutesLogged;
    }
  });
  const avgPomodoroMinutes = pomoDays.size > 0
    ? Math.round(totalPomoMins / pomoDays.size)
    : 0;

  // Longest streak ever
  let longestStreak = 0;
  let currentStreak = 0;
  // Get all unique dates sorted
  const allDates = [...new Set(todos.map(t => t.logicalDate))].sort();
  if (allDates.length > 0) {
    const firstDate = new Date(allDates[0] + 'T12:00:00');
    const lastDate = new Date(allDates[allDates.length - 1] + 'T12:00:00');
    const d = new Date(firstDate);
    while (d <= lastDate) {
      const dateStr = d.toISOString().split('T')[0];
      const dayTodos = todos.filter(t => t.logicalDate === dateStr);
      const total = dayTodos.length;
      const completed = dayTodos.filter(t => t.completed).length;
      if (total > 0 && completed / total >= 0.5) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (total > 0) {
        currentStreak = 0;
      }
      d.setDate(d.getDate() + 1);
    }
  }

  // Total time tracked
  let totalTimeTrackedSeconds = 0;
  todos.forEach(t => {
    if (t.timeTracking?.totalSeconds) {
      totalTimeTrackedSeconds += t.timeTracking.totalSeconds;
    }
  });

  return {
    heatmap,
    categoryBreakdown,
    avgDailyCompletion,
    mostProductiveDay,
    avgPomodoroMinutes,
    longestStreak,
    totalTimeTrackedMinutes: Math.round(totalTimeTrackedSeconds / 60),
  };
}
