import CronExpressionParser from 'cron-parser';

/**
 * 自上次运行（或创建）时间起，是否存在「应触发且已到期」的 Cron 火点。
 */
export function isScheduledTaskDue(
  cronExpr: string,
  timezone: string,
  lastRunAt: number | null,
  createdAt: number,
): boolean {
  const now = Date.now();
  const anchor = lastRunAt ?? createdAt;
  try {
    const opts: import('cron-parser').CronExpressionOptions = {
      currentDate: new Date(anchor),
    };
    const tz = timezone?.trim();
    if (tz && tz !== 'UTC') opts.tz = tz;

    const expr = CronExpressionParser.parse(cronExpr.trim(), opts);
    const next = expr.next();
    return next.getTime() <= now;
  } catch {
    return false;
  }
}

export function validateCronExpression(
  cronExpr: string,
  timezone: string,
): { ok: true } | { ok: false; error: string } {
  try {
    const opts: import('cron-parser').CronExpressionOptions = {
      currentDate: new Date(),
    };
    const tz = timezone?.trim();
    if (tz && tz !== 'UTC') opts.tz = tz;
    CronExpressionParser.parse(cronExpr.trim(), opts);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
