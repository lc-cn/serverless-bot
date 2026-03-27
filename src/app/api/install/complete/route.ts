import { NextResponse } from 'next/server';
import { bootstrapDatabaseSchema, getInstallPhase } from '@/lib/install/install-state';
import { assertInstallMutationAllowed } from '@/lib/install/install-mutation-guard';
import { setSignedInstallCookie } from '@/lib/install/install-cookie';

/**
 * 执行 SQL 迁移 + RBAC 校验：`/install`（首次）与 `/upgrade`（仅增量迁移）共用。
 * 仅在 `needs_install` / `needs_upgrade` / `no_database`（会 400）时有效；`installed` 时拒绝。
 */
export async function POST(request: Request) {
  const denied = assertInstallMutationAllowed(request);
  if (denied) return denied;

  const phase = await getInstallPhase();
  if (phase === 'installed') {
    return NextResponse.json({ error: '数据库已是最新，无需执行' }, { status: 400 });
  }
  if (phase === 'no_database') {
    return NextResponse.json(
      {
        error: 'no_database',
        message:
          '当前进程未检测到数据库配置。请设置 TURSO_DATABASE_URL（及 TURSO_AUTH_TOKEN）、或 LIBSQL_*、或 SQLITE_PATH 后重新部署或重启，再打开本页。',
      },
      { status: 400 }
    );
  }

  const result = await bootstrapDatabaseSchema();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  const res = NextResponse.json(result);
  try {
    await setSignedInstallCookie(res);
  } catch (e) {
    console.warn('[install/complete] 无法设置已安装 Cookie（缺少 NEXTAUTH_SECRET / INSTALL_COOKIE_SECRET）:', e);
  }
  return res;
}
