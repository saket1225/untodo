export interface SiliconCommand {
  id: string;
  type: 'add_task' | 'complete_task' | 'delete_task' | 'get_tasks' | 'write_daily_summary' | 'write_weekly_review' | 'update_wallpaper_config' | 'nudge' | 'get_progress';
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'done';
  createdAt: number;
}

export interface SiliconResponse {
  commandId: string;
  result: Record<string, any>;
  status: 'success' | 'error';
  completedAt: number;
}

export interface SiliconConnection {
  pairingCode: string;
  connected: boolean;
  lastSync: number | null;
}
