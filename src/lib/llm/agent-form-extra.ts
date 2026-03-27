import {
  DEFAULT_AGENT_MEMORY_MODE,
  DEFAULT_MEMORY_WINDOW_TURNS,
  MAX_MEMORY_WINDOW_TURNS,
  MIN_MEMORY_WINDOW_TURNS,
  parseAgentMemoryFromExtra,
  type AgentMemoryMode,
} from '@/lib/llm/agent-memory-config';

export { DEFAULT_MEMORY_WINDOW_TURNS } from '@/lib/llm/agent-memory-config';

export type SkillInjectUi = 'none' | 'summary' | 'full';

/** 表单：与下拉框一致的 memory 选项 */
export type AgentMemoryModeUi = AgentMemoryMode;

function clampTurns(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MEMORY_WINDOW_TURNS;
  return Math.min(MAX_MEMORY_WINDOW_TURNS, Math.max(MIN_MEMORY_WINDOW_TURNS, Math.floor(n)));
}

export function mergeAgentFormExtraJson(
  raw: string,
  opts: {
    skillInject: SkillInjectUi;
    memoryMode: AgentMemoryModeUi;
    memoryWindowTurns: number;
  }
): string | undefined {
  let obj: Record<string, unknown> = {};
  const t = raw.trim();
  if (t) {
    try {
      obj = JSON.parse(t) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  }
  obj.skillInject = opts.skillInject;
  obj.memoryMode = opts.memoryMode;
  obj.memoryWindowTurns = clampTurns(opts.memoryWindowTurns);
  const s = JSON.stringify(obj);
  return s === '{}' ? undefined : s;
}

export function parseMemoryFormFromExtraJson(raw: string): {
  memoryMode: AgentMemoryModeUi;
  memoryWindowTurns: number;
} {
  if (!raw.trim()) {
    return { memoryMode: DEFAULT_AGENT_MEMORY_MODE, memoryWindowTurns: DEFAULT_MEMORY_WINDOW_TURNS };
  }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    return parseAgentMemoryFromExtra(o);
  } catch {
    return { memoryMode: DEFAULT_AGENT_MEMORY_MODE, memoryWindowTurns: DEFAULT_MEMORY_WINDOW_TURNS };
  }
}
