import { auth } from './next-auth';
import { getBot, hasPermission, hasAnyPermission } from '@/lib/persistence';
import { NextResponse } from 'next/server';
import { jsonApiError } from '@/lib/http/api-wire-error';
import { pickMessage } from '@/lib/i18n/catalog';
import { getServerApiLocale } from '@/lib/i18n/server-locale';
import { localizedRedirect } from '@/i18n/server-redirect';
import type { ExtendedSession } from '@/types/auth';
import type { BotConfig } from '@/types';

// ==================== 服务端权限检查 ====================

/**
 * 在服务端组件中检查用户是否已登录
 */
export async function requireAuth() {
  const session = await auth() as ExtendedSession | null;

  if (!session?.user) {
    await localizedRedirect('/sign-in');
  }

  return session as ExtendedSession;
}

/**
 * 在服务端组件中检查用户是否有指定权限
 */
export async function requirePermission(permission: string | string[]) {
  const session = await requireAuth();

  const required = Array.isArray(permission) ? permission : [permission];

  if (!hasPermission(session.user.permissions || [], required)) {
    await localizedRedirect('/unauthorized');
  }

  return session;
}

/**
 * 在服务端组件中检查用户是否有任一指定权限
 */
export async function requireAnyPermission(permissions: string[]) {
  const session = await requireAuth();

  if (!hasAnyPermission(session.user.permissions || [], permissions)) {
    await localizedRedirect('/unauthorized');
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
    const locale = await getServerApiLocale();
    return {
      error: jsonApiError(401, 'UNAUTHORIZED', pickMessage(locale, 'Api.unauthorized')),
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
    const locale = await getServerApiLocale();
    return {
      error: jsonApiError(403, 'FORBIDDEN', pickMessage(locale, 'Api.forbidden')),
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
    const locale = await getServerApiLocale();
    return {
      error: jsonApiError(403, 'FORBIDDEN', pickMessage(locale, 'Api.forbidden')),
      session: null,
    };
  }
  
  return { error: null, session };
}

/**
 * Bot 多租户：归属于自己的 Bot 可操作；owner_id 为空的遗留数据仅允许具备 bots/adapters 管理类权限的用户。
 */
export function userCanAccessBot(session: ExtendedSession, bot: Pick<BotConfig, 'ownerId'> | null): boolean {
  if (!bot) return false;
  const uid = session.user.id;
  const ownerRaw = bot.ownerId;
  const owner =
    ownerRaw != null && String(ownerRaw).trim() !== '' ? String(ownerRaw).trim() : null;
  if (owner === uid) return true;
  if (owner == null) {
    return hasAnyPermission(session.user.permissions || [], ['bots:manage', 'adapters:manage']);
  }
  return false;
}

export type BotAccessLevel = 'read' | 'write' | 'admin';

const BOT_ACCESS_PERM: Record<BotAccessLevel, string[]> = {
  read: ['bots:read', 'bots:create', 'bots:update', 'bots:delete', 'bots:manage', 'adapters:manage'],
  write: ['bots:update', 'bots:manage', 'adapters:manage'],
  admin: ['bots:manage', 'adapters:manage'],
};

/** 校验登录 + 对指定 botId 的归属/权限（防 IDOR） */
export async function apiRequireBotAccess(botId: string, level: BotAccessLevel): Promise<{
  error: NextResponse | null;
  session: ExtendedSession | null;
  bot: BotConfig | null;
}> {
  const { error, session } = await apiRequireAuth();
  if (error || !session) return { error, session: null, bot: null };

  const sess = session as ExtendedSession;
  const bot = await getBot(botId);
  const locale = await getServerApiLocale();
  if (!bot || !userCanAccessBot(sess, bot)) {
    return {
      error: jsonApiError(403, 'FORBIDDEN', pickMessage(locale, 'Api.botInaccessible')),
      session: sess,
      bot: null,
    };
  }

  if (!hasAnyPermission(sess.user.permissions || [], BOT_ACCESS_PERM[level])) {
    return {
      error: jsonApiError(403, 'FORBIDDEN', pickMessage(locale, 'Api.forbidden')),
      session: sess,
      bot: null,
    };
  }

  return { error: null, session: sess, bot };
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

  AGENTS_READ: 'agents:read',
  AGENTS_MANAGE: 'agents:manage',
  
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

  AUDIT_READ: 'audit:read',
} as const;
