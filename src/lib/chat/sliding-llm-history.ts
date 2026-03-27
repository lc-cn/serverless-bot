import type { ChatMessage } from '@/lib/persistence/chat-store';
import type { ChatMessage as LlmChatMessage } from '@/llm/types';

/**
 * listMessages 为最新在前；转为时间正序后，把控制台/适配器存的 user、bot 映射为 LLM 的 user、assistant，
 * 并截取最近 maxUiMessages 条（约 memoryWindowTurns 个来回 × 2）。
 */
export function chatStoreRowsToSlidingLlmHistory(
  newestFirst: ChatMessage[],
  opts: { maxUiMessages: number; excludeMessageIds?: Set<string> }
): LlmChatMessage[] {
  const exclude = opts.excludeMessageIds ?? new Set<string>();
  const chronological = [...newestFirst].reverse();
  const llm: LlmChatMessage[] = [];
  for (const m of chronological) {
    if (exclude.has(m.id)) continue;
    if (m.role === 'user') {
      llm.push({ role: 'user', content: m.text });
    } else if (m.role === 'bot') {
      llm.push({ role: 'assistant', content: m.text });
    }
  }
  const cap = Math.max(0, opts.maxUiMessages);
  if (llm.length <= cap) return llm;
  return llm.slice(-cap);
}
