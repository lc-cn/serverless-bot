import { createHash } from 'node:crypto';

/** 微信公众平台明文模式：校验 signature（token、timestamp、nonce 字典序拼接后 sha1） */
export function wechatMpVerifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string
): boolean {
  if (!token || !timestamp || !nonce || !signature) return false;
  const sorted = [token, timestamp, nonce].sort().join('');
  const hash = createHash('sha1').update(sorted).digest('hex');
  return hash === signature;
}

/**
 * 解析被动消息 XML 为扁平字段（一级标签）。
 * 明文模式直接解析正文；安全/兼容模式应先解密外层 Encrypt，再对内层 XML 调用本函数（见 inbound.ts）。
 */
export function parseWechatMpXml(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = xml.trim();
  if (!trimmed || !trimmed.includes('<')) return out;
  const re = /<([a-zA-Z0-9_]+)>(?:\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*|([^<]*))<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? '').trim();
  }
  return out;
}
