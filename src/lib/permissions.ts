import { auth } from '@/lib/auth';
import { hasPermission, hasAnyPermission } from '@/lib/data';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import type { ExtendedSession } from '@/types/auth';

// ==================== 服务端权限检查 ====================

/**
 * 在服务端组件中检查用户是否已登录
 */
export async function requireAuth() {
  const session = await auth() as ExtendedSession | null;
  
  if (!session?.user) {
    redirect('/login');
  }
  
  return session;
}

/**
 * 在服务端组件中检查用户是否有指定权限
 */
export async function requirePermission(permission: string | string[]) {
  const session = await requireAuth();
  
  const required = Array.isArray(permission) ? permission : [permission];
  
  if (!hasPermission(session.user.permissions || [], required)) {
    redirect('/unauthorized');
  }
  
  return session;
}

/**
 * 在服务端组件中检查用户是否有任一指定权限
 */
export async function requireAnyPermission(permissions: string[]) {
  const session = await requireAuth();
  
  if (!hasAnyPermission(session.user.permissions || [], permissions)) {
    redirect('/unauthorized');
  }
  
  return session;
}

// ==================== API 路由权限检查 ====================

/**
 * API 路由认证检查
 */
export async function apiRequireAuth() {
  const session = await auth() as ExtendedSession | null;
  
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * API 路由权限检查
 */
export async function apiRequirePermission(permission: string | string[]) {
  const { error, session } = await apiRequireAuth();
  
  if (error) return { error, session: null };
  
  const required = Array.isArray(permission) ? permission : [permission];
  
  if (!hasPermission(session!.user.permissions || [], required)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * API 路由任一权限检查
 */
export async function apiRequireAnyPermission(permissions: string[]) {
  const { error, session } = await apiRequireAuth();
  
  if (error) return { error, session: null };
  
  if (!hasAnyPermission(session!.user.permissions || [], permissions)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }
  
  return { error: null, session };
}

// ==================== 权限常量 ====================

export const PERMISSIONS = {
  // 适配器
  ADAPTERS_READ: 'adapters:read',
  ADAPTERS_CREATE: 'adapters:create',
  ADAPTERS_UPDATE: 'adapters:update',
  ADAPTERS_DELETE: 'adapters:delete',
  ADAPTERS_MANAGE: 'adapters:manage',
  
  // 机器人
  BOTS_READ: 'bots:read',
  BOTS_CREATE: 'bots:create',
  BOTS_UPDATE: 'bots:update',
  BOTS_DELETE: 'bots:delete',
  BOTS_MANAGE: 'bots:manage',
  
  // 流程
  FLOWS_READ: 'flows:read',
  FLOWS_CREATE: 'flows:create',
  FLOWS_UPDATE: 'flows:update',
  FLOWS_DELETE: 'flows:delete',
  FLOWS_MANAGE: 'flows:manage',
  
  // 用户
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',
  
  // 角色
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_MANAGE: 'roles:manage',
} as const;
