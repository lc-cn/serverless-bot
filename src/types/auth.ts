import { z } from 'zod';

// ==================== 权限定义 ====================

export const PermissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  resource: z.string(), // 资源类型：adapters, bots, flows, users, roles
  action: z.enum(['create', 'read', 'update', 'delete', 'manage']),
});

export type Permission = z.infer<typeof PermissionSchema>;

// 预定义权限
export const PERMISSIONS = {
  // 适配器权限
  ADAPTERS_READ: { id: 'adapters:read', name: '查看适配器', resource: 'adapters', action: 'read' as const },
  ADAPTERS_CREATE: { id: 'adapters:create', name: '创建适配器', resource: 'adapters', action: 'create' as const },
  ADAPTERS_UPDATE: { id: 'adapters:update', name: '更新适配器', resource: 'adapters', action: 'update' as const },
  ADAPTERS_DELETE: { id: 'adapters:delete', name: '删除适配器', resource: 'adapters', action: 'delete' as const },
  ADAPTERS_MANAGE: { id: 'adapters:manage', name: '管理适配器', resource: 'adapters', action: 'manage' as const },

  // 机器人权限
  BOTS_READ: { id: 'bots:read', name: '查看机器人', resource: 'bots', action: 'read' as const },
  BOTS_CREATE: { id: 'bots:create', name: '创建机器人', resource: 'bots', action: 'create' as const },
  BOTS_UPDATE: { id: 'bots:update', name: '更新机器人', resource: 'bots', action: 'update' as const },
  BOTS_DELETE: { id: 'bots:delete', name: '删除机器人', resource: 'bots', action: 'delete' as const },
  BOTS_MANAGE: { id: 'bots:manage', name: '管理机器人', resource: 'bots', action: 'manage' as const },

  // 流程权限
  FLOWS_READ: { id: 'flows:read', name: '查看流程', resource: 'flows', action: 'read' as const },
  FLOWS_CREATE: { id: 'flows:create', name: '创建流程', resource: 'flows', action: 'create' as const },
  FLOWS_UPDATE: { id: 'flows:update', name: '更新流程', resource: 'flows', action: 'update' as const },
  FLOWS_DELETE: { id: 'flows:delete', name: '删除流程', resource: 'flows', action: 'delete' as const },
  FLOWS_MANAGE: { id: 'flows:manage', name: '管理流程', resource: 'flows', action: 'manage' as const },

  // 用户权限
  USERS_READ: { id: 'users:read', name: '查看用户', resource: 'users', action: 'read' as const },
  USERS_CREATE: { id: 'users:create', name: '创建用户', resource: 'users', action: 'create' as const },
  USERS_UPDATE: { id: 'users:update', name: '更新用户', resource: 'users', action: 'update' as const },
  USERS_DELETE: { id: 'users:delete', name: '删除用户', resource: 'users', action: 'delete' as const },
  USERS_MANAGE: { id: 'users:manage', name: '管理用户', resource: 'users', action: 'manage' as const },

  // 角色权限
  ROLES_READ: { id: 'roles:read', name: '查看角色', resource: 'roles', action: 'read' as const },
  ROLES_CREATE: { id: 'roles:create', name: '创建角色', resource: 'roles', action: 'create' as const },
  ROLES_UPDATE: { id: 'roles:update', name: '更新角色', resource: 'roles', action: 'update' as const },
  ROLES_DELETE: { id: 'roles:delete', name: '删除角色', resource: 'roles', action: 'delete' as const },
  ROLES_MANAGE: { id: 'roles:manage', name: '管理角色', resource: 'roles', action: 'manage' as const },
} as const;

// ==================== 角色定义 ====================

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  permissions: z.array(z.string()), // 权限ID列表
  isSystem: z.boolean().default(false), // 系统内置角色，不可删除
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Role = z.infer<typeof RoleSchema>;

// 预定义角色
export const SYSTEM_ROLES: Record<string, Omit<Role, 'createdAt' | 'updatedAt'>> = {
  SUPER_ADMIN: {
    id: 'super_admin',
    name: '超级管理员',
    description: '拥有所有权限',
    permissions: Object.values(PERMISSIONS).map(p => p.id),
    isSystem: true,
  },
  ADMIN: {
    id: 'admin',
    name: '管理员',
    description: '管理适配器、机器人和流程',
    permissions: [
      PERMISSIONS.ADAPTERS_MANAGE.id,
      PERMISSIONS.BOTS_MANAGE.id,
      PERMISSIONS.FLOWS_MANAGE.id,
      PERMISSIONS.USERS_READ.id,
    ],
    isSystem: true,
  },
  OPERATOR: {
    id: 'operator',
    name: '运维人员',
    description: '管理机器人和流程',
    permissions: [
      PERMISSIONS.ADAPTERS_READ.id,
      PERMISSIONS.BOTS_READ.id,
      PERMISSIONS.BOTS_UPDATE.id,
      PERMISSIONS.FLOWS_READ.id,
      PERMISSIONS.FLOWS_UPDATE.id,
    ],
    isSystem: true,
  },
  VIEWER: {
    id: 'viewer',
    name: '观察者',
    description: '只读权限',
    permissions: [
      PERMISSIONS.ADAPTERS_READ.id,
      PERMISSIONS.BOTS_READ.id,
      PERMISSIONS.FLOWS_READ.id,
    ],
    isSystem: true,
  },
};

// ==================== 用户定义 ====================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string(),
  image: z.string().url().optional(),
  
  // 认证相关
  passwordHash: z.string().optional(), // 密码登录（可选）
  githubId: z.string().optional(), // GitHub OAuth
  
  // RBAC
  roleIds: z.array(z.string()), // 角色ID列表
  
  // 状态
  isActive: z.boolean().default(true),
  emailVerified: z.string().optional(), // 邮箱验证时间
  
  // 时间戳
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// 用户会话中的安全用户信息（不含敏感数据）
export const SafeUserSchema = UserSchema.omit({
  passwordHash: true,
}).extend({
  permissions: z.array(z.string()), // 展开的权限列表
});

export type SafeUser = z.infer<typeof SafeUserSchema>;

// ==================== 会话扩展 ====================

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  image?: string;
  roleIds: string[];
  permissions: string[];
}

export interface ExtendedSession {
  user: SessionUser;
  expires: string;
}

export interface ExtendedJWT {
  id: string;
  roleIds: string[];
  permissions: string[];
  name?: string;
  email?: string;
  picture?: string;
}
