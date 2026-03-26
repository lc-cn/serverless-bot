export interface DbClient {
  query<T = any>(sql: string, args?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, args?: any[]): Promise<T | null>;
  execute(sql: string, args?: any[]): Promise<{ changes: number }>;
}
