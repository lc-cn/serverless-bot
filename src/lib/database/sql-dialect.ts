export type SqlDialect = 'sqlite' | 'mysql';

let currentDialect: SqlDialect = 'sqlite';

export function setSqlDialect(d: SqlDialect): void {
  currentDialect = d;
}

export function getSqlDialect(): SqlDialect {
  return currentDialect;
}

/** NOW：SQLite 用 datetime('now')，MySQL 用 UTC 毫秒时间戳函数 */
export function sqlNowExpr(): string {
  return currentDialect === 'mysql' ? 'UTC_TIMESTAMP(3)' : "datetime('now')";
}
