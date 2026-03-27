/** Agent extra_json 中的多轮对话记忆策略（滑动窗口） */

export type AgentMemoryMode = 'none' | 'sliding_window';

/** 新建 Agent 默认：开启滑动窗口，轮数尽量少以省 token */
export const DEFAULT_AGENT_MEMORY_MODE: AgentMemoryMode = 'sliding_window';
export const DEFAULT_MEMORY_WINDOW_TURNS = 5;
export const MIN_MEMORY_WINDOW_TURNS = 1;
export const MAX_MEMORY_WINDOW_TURNS = 50;

export function parseAgentMemoryFromExtra(extra: Record<string, unknown>): {
  memoryMode: AgentMemoryMode;
  memoryWindowTurns: number;
} {
  const modeRaw = extra.memoryMode;
  let memoryMode: AgentMemoryMode = DEFAULT_AGENT_MEMORY_MODE;
  if (modeRaw === 'none') memoryMode = 'none';
  else if (modeRaw === 'sliding_window') memoryMode = 'sliding_window';

  let turns = DEFAULT_MEMORY_WINDOW_TURNS;
  const w = extra.memoryWindowTurns;
  if (typeof w === 'number' && Number.isFinite(w)) {
    turns = Math.min(MAX_MEMORY_WINDOW_TURNS, Math.max(MIN_MEMORY_WINDOW_TURNS, Math.floor(w)));
  } else if (typeof w === 'string' && /^\d+$/.test(w.trim())) {
    turns = Math.min(
      MAX_MEMORY_WINDOW_TURNS,
      Math.max(MIN_MEMORY_WINDOW_TURNS, parseInt(w.trim(), 10)),
    );
  }

  return { memoryMode, memoryWindowTurns: turns };
}
