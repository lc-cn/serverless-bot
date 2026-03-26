// 开发环境临时 API - 初始化角色并把当前账号提升为超级管理员
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { storage, getUserPermissions } from '@/lib/persistence';
import { SYSTEM_ROLES } from '@/types/auth';
import { db } from '@/lib/data-layer';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const devSecret = process.env.DEV_DANGEROUS_API_SECRET?.trim();
  if (devSecret && request.headers.get('x-dev-dangerous-secret') !== devSecret) {
    return NextResponse.json(
      { error: 'Forbidden: set DEV_DANGEROUS_API_SECRET and header x-dev-dangerous-secret' },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 初始化 RBAC
  await storage.initializeRBAC();

  if (!session?.user?.email) {
    return NextResponse.json({
      message: 'RBAC 已初始化；当前会话无 email，跳过提升 super_admin（请使用 GitHub 等带邮箱的登录后再访问本接口）',
      roles: await storage.getRoles(),
    });
  }

  // 查找当前用户
  const user = await storage.getUserByEmail(session.user.email);
  
  if (!user) {
    return NextResponse.json({ 
      error: 'User not found in storage',
      email: session.user.email,
    }, { status: 404 });
  }

  // 为当前用户授予 super_admin 角色（覆盖原有角色）
  await db.execute('DELETE FROM user_roles WHERE user_id = ?', [user.id]);
  await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, SYSTEM_ROLES.SUPER_ADMIN.id]);

  const permissions = await getUserPermissions(user.id);
  const updatedUser = await storage.getUser(user.id);

  return NextResponse.json({
    message: 'RBAC initialized and user promoted to super admin',
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
