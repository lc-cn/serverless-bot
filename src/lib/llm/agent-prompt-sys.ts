/**
 * Agent 系统提示 / 本步 userPrompt / 技能块 插值时可用的 ${sys.*} 内置变量（每次请求即时计算，避免滞后）。
 */

export type LlmAgentPromptSysVars = Record<string, string | number>;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 构建注入到 context.variables.sys 的对象（扁平键，便于 ${sys.nowIso} 引用）。
 */
export function buildLlmAgentPromptSysVars(): LlmAgentPromptSysVars {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const offsetMin = -now.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  const utcOffsetLabel = `UTC${sign}${oh}:${om}`;

  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const localDate = `${y}-${m}-${d}`;

  return {
    nowIso: now.toISOString(),
    nowLocal: now.toLocaleString(locale, {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'medium',
    }),
    dateLocal: localDate,
    dateUtc: now.toISOString().slice(0, 10),
    timeUtc: now.toISOString().slice(11, 19),
    timestampMs: now.getTime(),
    timezone: tz,
    locale,
    utcOffsetMinutes: offsetMin,
    utcOffsetLabel,
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/** 控制台列表用路径（说明文案见 messages `AgentFormPage.sysVarHelp.*`） */
export const LLM_AGENT_SYS_VAR_PATHS: readonly string[] = [
  'sys.nowIso',
  'sys.nowLocal',
  'sys.dateLocal',
  'sys.dateUtc',
  'sys.timeUtc',
  'sys.timestampMs',
  'sys.timezone',
  'sys.locale',
  'sys.utcOffsetLabel',
  'sys.utcOffsetMinutes',
  'sys.cwd',
  'sys.platform',
  'sys.nodeVersion',
];
