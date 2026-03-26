import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db, isRelationalDatabaseConfigured } from '@/lib/data-layer';
import { getLatestAppliedMigration } from '@/lib/database/sql-migrate';
import { getInstallPhase } from '@/lib/install/install-state';
import { localeFromRequestCookies, pickMessage } from '@/lib/i18n/catalog';

/**
 * 安装状态（无需登录）。中间件与安装页使用。
 */
export async function GET() {
  const cookieStore = await cookies();
  const locale = localeFromRequestCookies((n) => cookieStore.get(n)?.value);
  const hints = {
    localSqlite: pickMessage(locale, 'InstallStatusHints.localSqlite'),
    serverless: pickMessage(locale, 'InstallStatusHints.serverless'),
  };

  try {
    const phase = await getInstallPhase();
    let lastAppliedMigration: string | null = null;
    if (isRelationalDatabaseConfigured()) {
      try {
        lastAppliedMigration = await getLatestAppliedMigration(db);
      } catch {
        lastAppliedMigration = null;
      }
    }
    return NextResponse.json({
      phase,
      databaseConfigured: isRelationalDatabaseConfigured(),
      lastAppliedMigration,
      hints,
    });
  } catch (e) {
    console.error('[install/status]', e);
    return NextResponse.json(
      {
        phase: 'no_database' as const,
        databaseConfigured: false,
        lastAppliedMigration: null,
        hints,
        error: process.env.NODE_ENV === 'development' ? String(e) : undefined,
      },
      { status: 500 },
    );
  }
}
