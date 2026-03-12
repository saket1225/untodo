import { format, subDays, addDays } from 'date-fns';

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
  const today = getLogicalDate();
  if (dateStr === today) return 'Today, ' + format(date, 'MMM d');
  const yesterday = format(subDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
  if (dateStr === yesterday) return 'Yesterday';
  const tomorrow = format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
  if (dateStr === tomorrow) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

export function shiftDate(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  if (days > 0) return format(addDays(date, days), 'yyyy-MM-dd');
  return format(subDays(date, Math.abs(days)), 'yyyy-MM-dd');
}
