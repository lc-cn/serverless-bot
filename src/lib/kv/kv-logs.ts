import { getKvRedis } from '@/lib/data-layer';

export interface EventLogEntry {
  id: string; // event id
  type: string;
  subType?: string;
  platform: string;
  botId: string;
  timestamp: number;
  sender?: { userId?: string };
  summary?: Record<string, unknown>;
}

export async function appendEventLog(platform: string, botId: string, entry: EventLogEntry, max = 200) {
  const kv = getKvRedis();
  const key = `logs:events:${platform}:${botId}`;
  await kv.lpush(key, entry);
  await kv.ltrim(key, 0, max - 1);
}

export async function getEventLogs(platform: string, botId: string, limit = 50): Promise<EventLogEntry[]> {
  const kv = getKvRedis();
  const key = `logs:events:${platform}:${botId}`;
  const logs = (await kv.lrange<EventLogEntry>(key, 0, limit - 1)) || [];
  return logs;
}
