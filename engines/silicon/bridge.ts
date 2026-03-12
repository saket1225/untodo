import AsyncStorage from '@react-native-async-storage/async-storage';

const SILICON_KEY = 'untodo-silicon-connection';

export function generatePairingCode(): string {
  // Generate a 6-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function saveSiliconConnection(serverUrl: string, code: string): Promise<void> {
  await AsyncStorage.setItem(SILICON_KEY, JSON.stringify({
    connected: true,
    serverUrl,
    pairingCode: code,
    lastSync: new Date().toISOString(),
    pollInterval: 5,
  }));
}

export async function getSiliconConnection() {
  const data = await AsyncStorage.getItem(SILICON_KEY);
  if (data) return JSON.parse(data);
  return null;
}

export async function disconnectSilicon(): Promise<void> {
  await AsyncStorage.removeItem(SILICON_KEY);
}

export async function pollSilicon(serverUrl: string): Promise<any> {
  try {
    const res = await fetch(`${serverUrl}/commands`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.status === 204) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function ackSilicon(serverUrl: string): Promise<void> {
  try {
    await fetch(`${serverUrl}/ack`, { method: 'POST' });
  } catch {}
}
