import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 数据库初始化 API
 * POST /api/init - 初始化数据库表和数据
 * 
 * 警告：这个 API 应该只在开发或首次部署时调用
 */
export async function POST() {
  try {
    // 检查是否配置了 Turso/libSQL 数据库
    const dbUrl = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
    const authToken = process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl) {
      // 如果没有配置数据库，说明在使用内存存储，直接返回成功
      return NextResponse.json({
        success: true,
        message: 'Using in-memory storage, no database initialization needed',
      });
    }

    // 连接到数据库
    const db = createClient({ url: dbUrl, authToken });

    // 读取迁移 SQL 文件
    const migrationPath = join(process.cwd(), 'migrations', '001_create_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // 执行迁移 SQL
    // 需要按 SQL 语句分割，因为 libSQL 一次执行一个语句
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executedCount = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        await db.execute(statement);
        executedCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // 忽略表已存在的错误
        if (!errorMsg.includes('already exists') && !errorMsg.includes('UNIQUE constraint failed')) {
          errors.push(`Statement failed: ${statement.substring(0, 100)}... Error: ${errorMsg}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      executedStatements: executedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Init] Database initialization failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/init - 检查数据库状态
 */
export async function GET() {
  try {
    const dbUrl = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
    const authToken = process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl) {
      return NextResponse.json({
        status: 'ok',
        storage: 'in-memory',
        message: 'Using in-memory storage',
      });
    }

    const db = createClient({ url: dbUrl, authToken });

    // 检查是否有 users 表
    const result = await db.execute('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"');

    const tableCount = (result.rows[0] as any)?.count || 0;

    return NextResponse.json({
      status: tableCount > 0 ? 'initialized' : 'not-initialized',
      storage: 'libSQL/Turso',
      tableCount,
      message: tableCount > 0 ? 'Database is initialized' : 'Database needs initialization. Call POST /api/init',
    });
  } catch (error) {
    console.error('[Init] Status check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
