// Silicon bridge - connects to the personal agent backend
// TODO: Implement actual bridge when silicon API is ready

export async function sendCommand(command: string): Promise<string> {
  console.log('[silicon] command:', command);
  return 'OK';
}

export async function syncTodos(): Promise<void> {
  console.log('[silicon] sync todos');
}
