/**
 * 内部路由 `POST /api/internal/cron/tick`：生产环境需配置 CRON_TICK_SECRET，并带头 x-cron-tick-secret
 */
export function assertCronTickAuthorized(request: Request): boolean {
  const secret = process.env.CRON_TICK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-cron-tick-secret') === secret;
}
