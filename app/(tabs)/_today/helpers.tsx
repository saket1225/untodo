export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function getGreeting(): string {
  const tod = getTimeOfDay();
  switch (tod) {
    case 'morning': return 'Good morning';
    case 'afternoon': return 'Good afternoon';
    case 'evening': return 'Good evening';
    case 'night': return 'Still up?';
  }
}

export function getGreetingSub(completed: number, total: number): string | null {
  const tod = getTimeOfDay();
  if (total === 0) {
    switch (tod) {
      case 'morning': return 'Fresh start. What matters today?';
      case 'afternoon': return 'Still time to set intentions.';
      case 'evening': return 'Plan tomorrow before you rest.';
      case 'night': return 'Rest well. Tomorrow is yours.';
    }
  }
  const remaining = total - completed;
  if (remaining === 0) return null; // all done - handled elsewhere
  switch (tod) {
    case 'morning': return `${total} task${total !== 1 ? 's' : ''} ahead. Let's go.`;
    case 'afternoon': return remaining <= 3 ? `Just ${remaining} left. Strong finish.` : `${completed}/${total} done. Keep pushing.`;
    case 'evening': return remaining <= 2 ? `Almost there — ${remaining} to go.` : `${remaining} remaining. Focus up.`;
    case 'night': return remaining <= 2 ? `Finish ${remaining} or let it rest.` : 'Tomorrow is another day.';
  }
}
