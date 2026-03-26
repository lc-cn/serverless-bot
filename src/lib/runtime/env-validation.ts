/**
 * 启动时环境变量提示（不抛错，避免阻断未配全秘钥时的 next build）。
 */
export function validateEnvironmentOrWarn(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET?.trim()) {
    console.warn('[env] 生产环境请配置 NEXTAUTH_SECRET（会话与安装 Cookie 签名）。');
  }
  const asyncFlow = process.env.WEBHOOK_FLOW_ASYNC?.trim().toLowerCase();
  if (
    process.env.NODE_ENV === 'production' &&
    (asyncFlow === '1' || asyncFlow === 'true' || asyncFlow === 'yes') &&
    !process.env.FLOW_WORKER_SECRET?.trim()
  ) {
    console.warn(
      '[env] 检测到 WEBHOOK_FLOW_ASYNC（或控制台已开异步入队）：生产环境须设置 FLOW_WORKER_SECRET；Worker 请求头 x-flow-worker-secret。异步入队主开关也可在「设置 → 平台参数」配置。',
    );
  }
  if (process.env.NODE_ENV === 'production' && !process.env.CRON_TICK_SECRET?.trim()) {
    console.warn(
      '[env] 生产环境未设置 CRON_TICK_SECRET：控制台「定时任务」不会在 POST /api/internal/cron/tick 上执行；若需要使用，请配置并在 Cron 请求头中带 x-cron-tick-secret。',
    );
  }
}
