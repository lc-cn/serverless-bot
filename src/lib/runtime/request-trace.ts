/**
 * 从请求头推导或生成 trace id，用于 Webhook / Chat / Flow 全链路日志关联。
 */
export function getOrCreateTraceId(headers: Headers): string {
  const fromHeader =
    headers.get('x-request-id')?.trim() ||
    headers.get('x-vercel-id')?.trim() ||
    headers.get('cf-ray')?.trim() ||
    headers.get('x-amzn-trace-id')?.trim();
  if (fromHeader) return fromHeader;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
