import 'server-only';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type McpServerRuntimeConfig = {
  id: string;
  url: string;
  transport: string;
  headersJson: string | null;
};

function parseHeaderRecord(raw: string | null): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = v == null ? '' : String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** OpenAI function.name：仅字母数字与下划线，≤64；按 serverId + 原名生成稳定且不易撞车的前缀 */
export function mcpToolFunctionName(serverId: string, mcpToolName: string): string {
  const slug = (s: string) =>
    s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const sid = slug(serverId).slice(-16) || 'srv';
  const tn = slug(mcpToolName) || 'tool';
  let name = `mcp_${sid}_${tn}`;
  if (name.length > 64) name = name.slice(0, 64);
  return name || 'mcp_tool';
}

export async function withMcpClient<T>(
  cfg: McpServerRuntimeConfig,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const url = new URL(cfg.url);
  const extraHeaders = parseHeaderRecord(cfg.headersJson);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: extraHeaders,
    },
  });
  const client = new Client({ name: 'serverless-bot', version: '0.1.0' });
  await client.connect(transport);
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

export async function listMcpToolsOpenAiStyle(cfg: McpServerRuntimeConfig): Promise<{
  tools: unknown[];
  router: Record<string, { serverId: string; toolName: string }>;
}> {
  return withMcpClient(cfg, async (client) => {
    const { tools } = await client.listTools();
    const router: Record<string, { serverId: string; toolName: string }> = {};
    const out: unknown[] = [];
    for (const t of tools ?? []) {
      const mcpName = t.name;
      const fname = mcpToolFunctionName(cfg.id, mcpName);
      /** 若撞名则追加序号 */
      let finalName = fname;
      let n = 0;
      while (router[finalName]) {
        n += 1;
        const suffix = `_${n}`;
        finalName = (fname.slice(0, 64 - suffix.length) + suffix) as string;
      }
      router[finalName] = { serverId: cfg.id, toolName: mcpName };
      const desc = t.description ?? '';
      const inputSchema =
        t.inputSchema && typeof t.inputSchema === 'object'
          ? t.inputSchema
          : { type: 'object', properties: {} };
      out.push({
        type: 'function',
        function: {
          name: finalName,
          description: `[MCP:${cfg.id.slice(0, 8)}…] ${desc}`.trim(),
          parameters: inputSchema,
        },
      });
    }
    return { tools: out, router };
  });
}

export function stringifyMcpCallResult(result: {
  content?: Array<{ type?: string; text?: string; [k: string]: unknown }>;
  isError?: boolean;
  [k: string]: unknown;
}): string {
  try {
    const parts =
      result.content?.map((c) => {
        if (c && typeof c === 'object' && c.type === 'text' && typeof c.text === 'string') {
          return c.text;
        }
        return JSON.stringify(c);
      }) ?? [];
    const body = parts.length > 0 ? parts.join('\n') : JSON.stringify(result);
    if (result.isError) {
      return JSON.stringify({ error: true, mcp: body });
    }
    return body;
  } catch {
    return JSON.stringify(result);
  }
}

export async function invokeMcpTool(
  cfg: McpServerRuntimeConfig,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  return withMcpClient(cfg, async (client) => {
    const raw = await client.callTool({ name: toolName, arguments: args });
    return stringifyMcpCallResult(raw as Parameters<typeof stringifyMcpCallResult>[0]);
  });
}
