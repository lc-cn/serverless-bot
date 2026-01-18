// 开发环境临时 API - 初始化角色，清理历史 admin@localhost，并把当前账号提升为超级管理员
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { authStorage, getUserPermissions } from '@/lib/unified-storage';
import { SYSTEM_ROLES } from '@/types/auth';
import { db } from '@/lib/db';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  // 初始化 RBAC
  await authStorage.initializeRBAC();

  const session = await auth();
  
  if (!session?.user?.email) {
    return NextResponse.json({ 
      message: 'RBAC initialized, but no user logged in',
      roles: await authStorage.getRoles(),
    });
  }

  // 查找当前用户
  const user = await authStorage.getUserByEmail(session.user.email);
  
  if (!user) {
    return NextResponse.json({ 
      error: 'User not found in storage',
      email: session.user.email,
    }, { status: 404 });
  }

  // 清理历史默认管理员 admin@localhost（如存在）及其角色绑定
  const legacy = await db.queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', ['admin@localhost']);
  if (legacy?.id) {
    await db.execute('DELETE FROM user_roles WHERE user_id = ?', [legacy.id]);
    await db.execute('DELETE FROM users WHERE id = ?', [legacy.id]);
  }

  // 为当前用户授予 super_admin 角色（覆盖原有角色）
  await db.execute('DELETE FROM user_roles WHERE user_id = ?', [user.id]);
  await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, SYSTEM_ROLES.SUPER_ADMIN.id]);

  const permissions = await getUserPermissions(user.id);
  const updatedUser = await authStorage.getUser(user.id);

  return NextResponse.json({
    message: 'RBAC initialized, legacy admin cleaned, and user promoted to super admin',
    user: {
      id: updatedUser?.id,
      name: updatedUser?.name,
      email: updatedUser?.email,
      roleIds: updatedUser?.roleIds,
    },
    permissions,
    instruction: '请退出登录后重新登录以刷新会话权限',
  });
}
