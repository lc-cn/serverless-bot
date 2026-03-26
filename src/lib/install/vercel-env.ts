/**
 * 使用 Vercel REST API 写入环境变量（用户需提供 Personal Token，不入库）。
 * 文档：https://vercel.com/docs/rest-api/endpoints#create-one-or-more-environment-variables
 */

export type VercelEnvPushInput = {
  token: string;
  projectId: string;
  teamId?: string;
  variables: Record<string, string>;
};

export type VercelEnvPushResult = {
  ok: boolean;
  details: string[];
};

export async function vercelPushEnvironmentVariables(input: VercelEnvPushInput): Promise<VercelEnvPushResult> {
  const details: string[] = [];
  const qs = input.teamId?.trim()
    ? `?teamId=${encodeURIComponent(input.teamId.trim())}`
    : '';
  const base = `https://api.vercel.com/v10/projects/${encodeURIComponent(input.projectId.trim())}/env${qs}`;

  for (const [key, value] of Object.entries(input.variables)) {
    if (value == null || String(value).trim() === '') continue;
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: key.trim(),
        value: String(value),
        type: 'encrypted',
        target: ['production', 'preview', 'development'],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      details.push(`${key}: HTTP ${res.status} — ${text.slice(0, 300)}`);
    }
  }

  return { ok: details.length === 0, details };
}
