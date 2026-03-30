/**
 * 赞助链接：仅使用 NEXT_PUBLIC_*，可在服务端与构建时读取。
 * 未配置任何有效 URL 时 enabled 为 false，UI 应不渲染占位。
 */

export type SponsorLinkItem = {
  url: string;
  /** 未提供时由文案层使用通用「赞助」 */
  label?: string;
};

export type SponsorPublicPayload = {
  enabled: boolean;
  /** 主 CTA 使用的 URL；可能来自环境变量主链或仅来自 JSON 第一条 */
  primaryUrl: string | null;
  /** 全部有效链接（含主链，去重顺序：主链优先，其余来自 JSON） */
  links: SponsorLinkItem[];
};

function trimHttpUrl(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function parseLinksJson(raw: string | undefined): SponsorLinkItem[] {
  const str = raw?.trim();
  if (!str) return [];
  try {
    const parsed = JSON.parse(str) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: SponsorLinkItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const url = trimHttpUrl(typeof o.url === 'string' ? o.url : '');
      if (!url) continue;
      const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined;
      out.push({ url, label });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 供 Route Handler、Server Component 使用；与 GET /api/auth/public-config 中 sponsor 字段一致。
 */
export function getSponsorPublicPayload(): SponsorPublicPayload {
  const primaryFromEnv = trimHttpUrl(process.env.NEXT_PUBLIC_SPONSOR_URL);
  const fromJson = parseLinksJson(process.env.NEXT_PUBLIC_SPONSOR_LINKS_JSON);

  const links: SponsorLinkItem[] = [];
  const seen = new Set<string>();

  if (primaryFromEnv) {
    links.push({ url: primaryFromEnv });
    seen.add(primaryFromEnv);
  }
  for (const item of fromJson) {
    if (seen.has(item.url)) continue;
    links.push(item);
    seen.add(item.url);
  }

  const enabled = links.length > 0;
  const primaryUrl = primaryFromEnv ?? links[0]?.url ?? null;

  return { enabled, primaryUrl, links };
}
