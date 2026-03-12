export interface SiliconMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SiliconBridge {
  sendCommand: (command: string) => Promise<string>;
  syncTodos: () => Promise<void>;
}
