import type { FlowAction, Step } from '@/types';
import { buildLlmAgentPromptSysVars } from '@/lib/llm/agent-prompt-sys';
import { storage } from '@/lib/persistence';
import { getLlmAdapter } from '@/llm/registry';
import type { ChatMessage } from '@/llm/types';
import type { JobContext } from '../types';
import { interpolate } from '../step-template';

export type LlmToolRunner = (
  steps: Step[],
  parentContext: JobContext,
  toolArgs: Record<string, unknown>
) => Promise<{ ok: boolean; payload: string }>;

function parseOpenAiToolCalls(raw: unknown): Array<{
  id: string;
  function: { name: string; arguments: string };
}> {
  const choices = (raw as { choices?: Array<{ message?: { tool_calls?: unknown } }> })?.choices;
  const msg = choices?.[0]?.message;
  const tc = msg?.tool_calls;
  if (!Array.isArray(tc) || tc.length === 0) return [];
  const out: Array<{ id: string; function: { name: string; arguments: string } }> = [];
  for (const x of tc) {
    if (!x || typeof x !== 'object') continue;
    const o = x as { id?: string; function?: { name?: string; arguments?: string } };
    const id = o.id != null ? String(o.id) : '';
    const name = o.function?.name != null ? String(o.function.name) : '';
    const args = o.function?.arguments != null ? String(o.function.arguments) : '{}';
    if (id && name) out.push({ id, function: { name, arguments: args } });
  }
  return out;
}

function contextWithAgentPromptSys(context: JobContext): JobContext {
  const base = buildLlmAgentPromptSysVars();
  const raw = context.variables.sys;
  const mergedSys: Record<string, unknown> =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...base, ...(raw as Record<string, unknown>) }
      : { ...base };
  return {
    ...context,
    variables: {
      ...context.variables,
      sys: mergedSys,
    },
  };
}

export async function executeLlmAgent(
  action: FlowAction,
  context: JobContext,
  runToolSteps: LlmToolRunner
): Promise<unknown> {
  const config = action.config as {
    agentId: string;
    userPrompt?: string;
    saveAs?: string;
    saveRawAs?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    skillInject?: 'inherit' | 'none' | 'summary' | 'full';
    loadSkillIds?: string;
  };

  const ownerId = context.bot.ownerId;
  if (!ownerId) {
    throw new Error('Bot has no ownerId; cannot resolve LLM Agent');
  }

  const agentId = interpolate(String(config.agentId || ''), context).trim();
  if (!agentId) {
    throw new Error('llm_agent: agentId is required');
  }

  let loadSkillIdsFull: string[] | undefined;
  if (config.loadSkillIds != null && String(config.loadSkillIds).trim()) {
    const raw = interpolate(String(config.loadSkillIds), context).trim();
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) loadSkillIdsFull = p.map(String);
    } catch {
      loadSkillIdsFull = raw
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const injectOpt =
    config.skillInject === 'none' ||
    config.skillInject === 'summary' ||
    config.skillInject === 'full'
      ? config.skillInject
      : undefined;

  const runtime = await storage.getLlmAgentRuntime(agentId, ownerId, {
    skillInject: injectOpt,
    loadSkillIdsFull,
  });
  if (!runtime) {
    throw new Error(`LLM Agent not found or access denied: ${agentId}`);
  }

  const adapter = getLlmAdapter(runtime.vendorKind);

  const px = contextWithAgentPromptSys(context);

  let systemContent = runtime.presetSystemPrompt ? interpolate(runtime.presetSystemPrompt, px) : '';
  if (runtime.skillsJson) {
    const skills = interpolate(runtime.skillsJson, px);
    systemContent = systemContent ? `${systemContent}\n\n${skills}` : skills;
  }

  const userContent = config.userPrompt ? interpolate(config.userPrompt, px) : '';

  const messages: ChatMessage[] = [];
  if (systemContent.trim()) {
    messages.push({ role: 'system', content: systemContent });
  }
  messages.push({ role: 'user', content: userContent || '(empty user prompt)' });

  let tools: unknown[] | undefined;
  if (runtime.toolsJson) {
    try {
      const parsed = JSON.parse(runtime.toolsJson) as unknown;
      tools = Array.isArray(parsed) ? parsed : undefined;
    } catch {
      tools = undefined;
    }
  }

  const timeoutMs = config.timeout ?? runtime.extra.timeoutMs ?? 60000;
  const temperature = config.temperature ?? runtime.extra.temperature;
  const maxTokens = config.maxTokens ?? runtime.extra.maxTokens;
  const hasTools = Boolean(tools && tools.length > 0);
  const jsonMode = hasTools ? false : runtime.extra.jsonMode === true;

  const toolStepsMap = runtime.toolImplementationStepsByFunctionName ?? {};
  const mcpToolRouter = runtime.mcpToolRouter ?? {};
  const fromExtra = runtime.extra.maxToolRounds;
  const fromPlatform = context.platform?.llmAgentMaxToolRounds;
  let maxToolRounds = 8;
  if (fromExtra != null && Number.isFinite(fromExtra) && fromExtra > 0) {
    maxToolRounds = Math.min(64, Math.floor(fromExtra));
  } else if (fromPlatform != null && Number.isFinite(fromPlatform) && fromPlatform > 0) {
    maxToolRounds = Math.min(64, Math.floor(fromPlatform));
  }
  let lastRaw: unknown = null;
  let lastContent = '';

  for (let round = 0; round < maxToolRounds; round++) {
    const result = await adapter.chat({
      apiKey: runtime.apiKey,
      baseUrl: runtime.apiBaseUrl,
      model: runtime.defaultModel,
      messages,
      temperature,
      maxTokens,
      jsonMode,
      tools: hasTools ? tools : undefined,
      timeoutMs,
      vendorHttp: runtime.vendorHttp,
    });
    lastRaw = result.raw;
    lastContent = result.content;
    const tcalls = hasTools ? parseOpenAiToolCalls(result.raw) : [];
    if (tcalls.length === 0) {
      break;
    }

    const choices = (result.raw as { choices?: Array<{ message?: unknown }> })?.choices;
    const assistantMsg = choices?.[0]?.message;
    messages.push({
      role: 'assistant',
      content:
        typeof (assistantMsg as { content?: string | null })?.content === 'string'
          ? (assistantMsg as { content: string }).content
          : (assistantMsg as { content?: string | null })?.content === null ||
              (assistantMsg as { content?: string | null })?.content === undefined
            ? null
            : String((assistantMsg as { content: unknown }).content),
      tool_calls: (assistantMsg as { tool_calls?: unknown })?.tool_calls,
    });

    for (const tc of tcalls) {
      const implSteps = toolStepsMap[tc.function.name];
      const mcpRoute = mcpToolRouter[tc.function.name];
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        if (args === null || typeof args !== 'object' || Array.isArray(args)) {
          args = {};
        }
      } catch {
        args = {};
      }

      let payload: string;
      if (mcpRoute) {
        const cfg = await storage.getLlmMcpServerRuntimeForOwner(mcpRoute.serverId, ownerId);
        if (!cfg) {
          payload = JSON.stringify({
            error: `MCP 服务不存在或无权访问: ${mcpRoute.serverId}`,
          });
        } else {
          try {
            const { invokeMcpTool } = await import('@/lib/mcp/client-runtime');
            payload = await invokeMcpTool(cfg, mcpRoute.toolName, args);
          } catch (e) {
            payload = JSON.stringify({
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      } else if (implSteps?.length) {
        const run = await runToolSteps(implSteps, context, args);
        payload = run.payload;
      } else {
        payload = JSON.stringify({
          error: `工具「${tc.function.name}」未配置实现步骤，且非 MCP 工具，请在「工具管理」或「MCP 服务」中配置`,
        });
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: payload });
    }
  }

  const varName = (config.saveAs && String(config.saveAs).trim()) || 'llmReply';
  context.variables[varName] = lastContent;

  if (config.saveRawAs && String(config.saveRawAs).trim()) {
    context.variables[String(config.saveRawAs).trim()] = lastRaw;
  }

  return {
    type: 'llm_agent',
    saveAs: varName,
    contentLength: lastContent.length,
    hasRaw: Boolean(config.saveRawAs?.trim()),
  };
}
