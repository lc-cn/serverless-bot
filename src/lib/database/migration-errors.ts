/** 重复跑迁移 / 幂等语句时常见错误，交由迁移器吞掉，不打 error 日志 */
export function isBenignMigrationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.toLowerCase();
  if (m.includes('already exists')) return true;
  if (m.includes('duplicate column name')) return true;
  if (m.includes('unique constraint failed')) return true;
  if (m.includes('index') && m.includes('already exists')) return true;
  // 002_migrate_oauth_off_users：新库 users 无 github_id/gitlab_id；或列已 DROP 后重复执行
  if (
    (m.includes('no such column') || m.includes('unknown column')) &&
    (m.includes('github_id') || m.includes('gitlab_id'))
  ) {
    return true;
  }
  if (m.includes("can't drop") && (m.includes('github_id') || m.includes('gitlab_id'))) return true;
  return false;
}
