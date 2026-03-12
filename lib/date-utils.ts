import { format, subDays } from 'date-fns';

export function getLogicalDate(resetHour: number = 5, resetMinute: number = 0): string {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  if (currentHour < resetHour || (currentHour === resetHour && currentMinute < resetMinute)) {
    return format(subDays(now, 1), 'yyyy-MM-dd');
  }
  return format(now, 'yyyy-MM-dd');
}

export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return format(date, 'EEEE, MMMM d');
}
