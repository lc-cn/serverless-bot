import { Redis } from '@upstash/redis';

/**
 * 聊天缓存、事件日志等使用的 Redis 能力子集。
 * 远端实现：**Upstash Redis HTTP API**。
 * 未配置时：**进程内内存**（见 MemoryKvRedis）。
 */

process.env.UPSTASH_DISABLE_TELEMETRY ??= '1';

export interface KvRedisLike {
  rpush(key: string, ...elements: unknown[]): Promise<number>;
  ltrim(key: string, start: number, end: number): Promise<unknown>;
  lrange<T>(key: string, start: number, end: number): Promise<T[]>;
  lpush(key: string, ...elements: unknown[]): Promise<number>;
  /** 左侧弹出，队列消费；无元素返回 null */
  lpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  /** sorted set：score 为毫秒时间戳等 */
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangeByScore(
    key: string,
    min: string,
    max: string,
    opts: { offset: number; count: number },
  ): Promise<string[]>;
  zrem(key: string, member: string): Promise<number>;
  zcount(key: string, min: string, max: string): Promise<number>;
  get<T>(key: string): Promise<T | null>;
  /** `nx: true` 时键已存在则返回 null（与 Upstash 一致） */
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<unknown>;
}

function encodeListMember(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function decodeJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

/** 将 Upstash/@upstash/redis 客户端适配为 KvRedisLike（列表项统一 JSON 序列化）。 */
class UpstashKvAdapter implements KvRedisLike {
  constructor(private readonly redis: Redis) {}

  async rpush(key: string, ...elements: unknown[]): Promise<number> {
    const parts = elements.map(encodeListMember);
    return this.redis.rpush(key, ...(parts as [string, ...string[]]));
  }

  async ltrim(key: string, start: number, end: number): Promise<unknown> {
    return this.redis.ltrim(key, start, end);
  }

  async lrange<T>(key: string, start: number, end: number): Promise<T[]> {
    const raw = await this.redis.lrange(key, start, end);
    if (!raw?.length) return [];
    return raw.map((item: unknown) => decodeJson<T>(String(item)));
  }

  async lpush(key: string, ...elements: unknown[]): Promise<number> {
    const parts = elements.map(encodeListMember);
    return this.redis.lpush(key, ...(parts as [string, ...string[]]));
  }

  async lpop(key: string): Promise<string | null> {
    const raw = await this.redis.lpop(key);
    if (raw == null) return null;
    return typeof raw === 'string' ? raw : String(raw);
  }

  async llen(key: string): Promise<number> {
    const n = await this.redis.llen(key);
    return typeof n === 'number' ? n : Number(n);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const r = await this.redis.zadd(key, { score, member });
    return typeof r === 'number' ? r : Number(r);
  }

  async zrangeByScore(
    key: string,
    min: string,
    max: string,
    opts: { offset: number; count: number },
  ): Promise<string[]> {
    const minV = min === '-inf' ? ('-inf' as const) : Number(min);
    const maxV = max === '+inf' ? ('+inf' as const) : Number(max);
    const raw = await this.redis.zrange<string[]>(key, minV, maxV, {
      byScore: true,
      offset: opts.offset,
      count: opts.count,
    });
    if (!raw?.length) return [];
    return raw.map((item) => (typeof item === 'string' ? item : String(item)));
  }

  async zrem(key: string, member: string): Promise<number> {
    const r = await this.redis.zrem(key, member);
    return typeof r === 'number' ? r : Number(r);
  }

  async zcount(key: string, min: string, max: string): Promise<number> {
    const minV = min === '-inf' ? ('-inf' as const) : Number(min);
    const maxV = max === '+inf' ? ('+inf' as const) : Number(max);
    const r = await this.redis.zcount(key, minV, maxV);
    return typeof r === 'number' ? r : Number(r);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw == null) return null;
    if (typeof raw === 'object') return raw as T;
    if (typeof raw === 'string') return decodeJson<T>(raw);
    return raw as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<unknown> {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (opts?.nx) {
      if (opts.ex != null) {
        const r = await this.redis.set(key, payload, { nx: true, ex: opts.ex });
        return r;
      }
      const r = await this.redis.set(key, payload, { nx: true });
      return r;
    }
    if (opts?.ex != null) {
      await this.redis.set(key, payload, { ex: opts.ex });
    } else {
      await this.redis.set(key, payload);
    }
    return 'OK';
  }
}

function clone<T>(v: T): T {
  return v !== null && typeof v === 'object' ? (JSON.parse(JSON.stringify(v)) as T) : v;
}

/**
 * Redis REST（Upstash 协议）：与 Vercel KV / Marketplace 对齐。
 * 优先级：`KV_REST_API_URL` + `KV_REST_API_TOKEN`（写令牌），其次 `UPSTASH_REDIS_REST_*`。
 * 不使用 `KV_REST_API_READ_ONLY_TOKEN`（只读）。
 */
export function resolveKvRestConfig(): { url: string; token: string } | null {
  const kvUrl = process.env.KV_REST_API_URL?.trim();
  const kvToken = process.env.KV_REST_API_TOKEN?.trim();
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken };

  const upUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upUrl && upToken) return { url: upUrl, token: upToken };

  return null;
}

export type KvBackendKind = 'redis-rest' | 'memory';

class MemoryKvRedis implements KvRedisLike {
  private lists = new Map<string, unknown[]>();
  /** member -> score */
  private zsets = new Map<string, Map<string, number>>();
  private kv = new Map<string, { value: unknown; exp?: number }>();

  private getList(key: string): unknown[] {
    let list = this.lists.get(key);
    if (!list) {
      list = [];
      this.lists.set(key, list);
    }
    return list;
  }

  async rpush(key: string, ...elements: unknown[]): Promise<number> {
    const list = this.getList(key);
    for (const el of elements) list.push(clone(el));
    return list.length;
  }

  async ltrim(key: string, start: number, end: number): Promise<unknown> {
    const list = this.getList(key);
    const len = list.length;
    if (len === 0) return 'OK';

    if (start < 0 && end === -1) {
      const cap = -start;
      if (list.length > cap) list.splice(0, list.length - cap);
      return 'OK';
    }

    const toIdx = (i: number) => {
      if (i >= 0) return Math.min(i, len - 1);
      const x = len + i;
      return x < 0 ? 0 : Math.min(x, len - 1);
    };
    const from = toIdx(start);
    const to = toIdx(end);
    if (from > to || from >= len) {
      list.length = 0;
      return 'OK';
    }
    const next = list.slice(from, to + 1);
    this.lists.set(key, next);
    return 'OK';
  }

  async lrange<T>(key: string, start: number, end: number): Promise<T[]> {
    const list = this.lists.get(key) || [];
    const len = list.length;
    if (len === 0) return [];

    const toIdx = (i: number) => {
      if (i >= 0) return Math.min(i, len - 1);
      const x = len + i;
      return x < 0 ? 0 : x;
    };
    let from = toIdx(start);
    let to = end >= 0 ? Math.min(end, len - 1) : len + end;
    if (to < 0) to = 0;
    if (from > to) return [];
    return list.slice(from, to + 1) as T[];
  }

  async lpush(key: string, ...elements: unknown[]): Promise<number> {
    const list = this.getList(key);
    for (let i = elements.length - 1; i >= 0; i--) {
      list.unshift(clone(elements[i]));
    }
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key) || [];
    if (list.length === 0) return null;
    const v = list.shift()!;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  async llen(key: string): Promise<number> {
    return (this.lists.get(key) || []).length;
  }

  private getZset(key: string): Map<string, number> {
    let m = this.zsets.get(key);
    if (!m) {
      m = new Map();
      this.zsets.set(key, m);
    }
    return m;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    const m = this.getZset(key);
    const isNew = !m.has(member);
    m.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrangeByScore(
    key: string,
    min: string,
    max: string,
    opts: { offset: number; count: number },
  ): Promise<string[]> {
    const parseBound = (b: string): number => {
      if (b === '-inf') return -Infinity;
      if (b === '+inf') return Infinity;
      const n = Number(b);
      return Number.isFinite(n) ? n : -Infinity;
    };
    const lo = parseBound(min);
    const hi = parseBound(max);
    const m = this.zsets.get(key);
    if (!m || m.size === 0) return [];
    const rows = [...m.entries()]
          .filter(([, s]) => s >= lo && s <= hi)
          .sort((a, b) => a[1] - b[1]);
    return rows.slice(opts.offset, opts.offset + opts.count).map(([mem]) => mem);
  }

  async zrem(key: string, member: string): Promise<number> {
    const m = this.zsets.get(key);
    if (!m) return 0;
    if (!m.has(member)) return 0;
    m.delete(member);
    return 1;
  }

  async zcount(key: string, min: string, max: string): Promise<number> {
    const parseBound = (b: string): number => {
      if (b === '-inf') return -Infinity;
      if (b === '+inf') return Infinity;
      const n = Number(b);
      return Number.isFinite(n) ? n : -Infinity;
    };
    const lo = parseBound(min);
    const hi = parseBound(max);
    const m = this.zsets.get(key);
    if (!m) return 0;
    let c = 0;
    for (const s of m.values()) {
      if (s >= lo && s <= hi) c++;
    }
    return c;
  }

  async get<T>(key: string): Promise<T | null> {
    const row = this.kv.get(key);
    if (!row) return null;
    if (row.exp != null && row.exp < Date.now()) {
      this.kv.delete(key);
      return null;
    }
    return clone(row.value) as T;
  }

  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<unknown> {
    if (opts?.nx) {
      const row = this.kv.get(key);
      if (row && (row.exp == null || row.exp >= Date.now())) return null;
    }
    const exp = opts?.ex != null ? Date.now() + opts.ex * 1000 : undefined;
    this.kv.set(key, { value: clone(value), exp });
    return 'OK';
  }
}

let _kv: KvRedisLike | null = null;
let _backend: KvBackendKind | null = null;

/**
 * 单例：Redis REST（Upstash 协议）或内存。
 *
 * - `KV_BACKEND=memory`：强制内存。
 * - 未配置 REST：内存（开发环境会打日志）。
 */
export function getKvRedis(): KvRedisLike {
  if (_kv) return _kv;

  const forceMemory = process.env.KV_BACKEND === 'memory';
  const rest = resolveKvRestConfig();

  if (rest && !forceMemory) {
    const redis = new Redis({ url: rest.url, token: rest.token });
    _kv = new UpstashKvAdapter(redis);
    _backend = 'redis-rest';
  } else {
    _kv = new MemoryKvRedis();
    _backend = 'memory';
    if (process.env.NODE_ENV === 'development' && !forceMemory) {
      console.info(
        '[KV] 使用内存后端（未配置 KV_REST_API_URL + KV_REST_API_TOKEN，亦无 UPSTASH_REDIS_REST_*）。聊天/日志重启后丢失。',
      );
    }
  }

  return _kv;
}

export function getKvBackendKind(): KvBackendKind {
  getKvRedis();
  return _backend ?? 'memory';
}
