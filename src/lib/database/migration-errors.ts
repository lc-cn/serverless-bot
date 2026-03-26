/** 重复跑迁移 / 幂等语句时常见错误，交由迁移器吞掉，不打 error 日志 */
export function isBenignMigrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  if (m.includes('already exists')) return true;
  if (m.includes('duplicate column name')) return true;
  if (m.includes('unique constraint failed')) return true;
  if (m.includes('index') && m.includes('already exists')) return true;
  return false;
}
