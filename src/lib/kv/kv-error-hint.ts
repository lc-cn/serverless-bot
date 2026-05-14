/**
 * 从 TypeError(fetch failed) 等链式 cause 中识别常见 DNS/连接错误，
 * 便于在日志里一眼看出是 KV 环境变量或实例问题。
 */
export function kvRestNetworkFailureHint(err: unknown): string {
  let cur: unknown = err;
  for (let depth = 0; depth < 6 && cur != null; depth++) {
    if (typeof cur === 'object' && 'code' in cur) {
      const code = String((cur as { code?: unknown }).code);
      if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
        return (
          ' [KV] REST 主机不可达（DNS/连接）。请检查部署环境中的 KV_REST_API_URL + KV_REST_API_TOKEN，' +
          '或 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 是否与 Upstash 控制台一致、数据库是否已删除或 URL 已轮换。'
        );
      }
    }
    cur =
      typeof cur === 'object' && cur !== null && 'cause' in cur
        ? (cur as { cause: unknown }).cause
        : undefined;
  }
  return '';
}
