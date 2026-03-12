export interface SiliconConnection {
  connected: boolean;
  pairingCode: string | null;
  serverUrl: string | null;
  lastSync: string | null;
  pollInterval: number; // minutes, default 5
}

export interface SiliconCommand {
  action: 'add_todo' | 'complete_todo' | 'uncomplete_todo' | 'delete_todo' | 'add_habit' | 'complete_habit' | 'list_todos' | 'set_daily_summary' | 'refresh_wallpaper';
  text?: string;
  date?: string;
  name?: string;
  emoji?: string;
  summary?: string;
}
