import { format, subDays, addDays } from 'date-fns';

export function getLogicalDate(resetHour: number = 5, resetMinute: number = 0): string {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour < resetHour || (currentHour === resetHour && currentMinute < resetMinute)) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  } catch {
    // Fallback: manual ISO date extraction
    return new Date().toISOString().split('T')[0];
  }
}

export function formatDisplayDate(dateStr: string): string {
  try {
    if (!dateStr || typeof dateStr !== 'string') return 'Unknown';
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return dateStr;
    const today = getLogicalDate();
    if (dateStr === today) return 'Today, ' + format(date, 'MMM d');
    const yesterday = format(subDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
    if (dateStr === yesterday) return 'Yesterday';
    const tomorrow = format(addDays(new Date(today + 'T12:00:00'), 1), 'yyyy-MM-dd');
    if (dateStr === tomorrow) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  } catch {
    return dateStr || 'Unknown';
  }
}

export function shiftDate(dateStr: string, days: number): string {
  try {
    if (!dateStr || typeof dateStr !== 'string') return getLogicalDate();
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return getLogicalDate();
    if (days > 0) return format(addDays(date, days), 'yyyy-MM-dd');
    return format(subDays(date, Math.abs(days)), 'yyyy-MM-dd');
  } catch {
    return getLogicalDate();
  }
}
