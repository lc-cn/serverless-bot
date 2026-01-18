import { db } from './db';
import { BotConfig, AdapterConfig, Flow, Job, Trigger } from '@/types';
import { User, Role } from '@/types/auth';
import { generateId } from './utils';

// ==================== Bot 操作 ====================
export async function getBots(): Promise<BotConfig[]> {
  const rows = await db.query<any>('SELECT * FROM bots ORDER BY created_at DESC');
  return rows.map(row => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getBot(id: string): Promise<BotConfig | null> {
  const row = await db.queryOne<any>('SELECT * FROM bots WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBotsByPlatform(platform: string): Promise<BotConfig[]> {
  const rows = await db.query<any>('SELECT * FROM bots WHERE platform = ? ORDER BY created_at DESC', [platform]);
  return rows.map(row => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBot(bot: BotConfig): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO bots (id, platform, name, enabled, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`,
    [bot.id, bot.platform, bot.name, bot.enabled ? 1 : 0, JSON.stringify(bot.config), now, now]
  );
}

export async function deleteBot(id: string): Promise<void> {
  await db.execute('DELETE FROM bots WHERE id = ?', [id]);
}

// ==================== Adapter 操作 ====================
export async function getAdapters(): Promise<AdapterConfig[]> {
  const rows = await db.query<any>('SELECT * FROM adapters ORDER BY created_at DESC');
  return rows.map(row => ({
    platform: row.platform,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getAdapter(platform: string): Promise<AdapterConfig | null> {
  const row = await db.queryOne<any>('SELECT * FROM adapters WHERE platform = ?', [platform]);
  if (!row) return null;
  return {
    platform: row.platform,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveAdapter(adapter: AdapterConfig): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO adapters (platform, name, description, enabled, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(platform) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`,
    [adapter.platform, adapter.name, adapter.description, adapter.enabled ? 1 : 0, JSON.stringify(adapter.config), now, now]
  );
}

export async function deleteAdapter(platform: string): Promise<void> {
  await db.execute('DELETE FROM adapters WHERE platform = ?', [platform]);
}

// ==================== Flow 操作 ====================
export async function getFlows(): Promise<Flow[]> {
  const rows = await db.query<any>('SELECT * FROM flows ORDER BY created_at DESC');
  const flows: Flow[] = [];
  
  for (const row of rows) {
    const triggers = await db.query<any>('SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', [row.id]);
    const jobs = await db.query<any>('SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', [row.id]);
    
    flows.push({
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      eventType: row.event_type,
      priority: row.priority || 0,
      triggerIds: triggers.map(t => t.trigger_id),
      jobIds: jobs.map(j => j.job_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  
  return flows;
}

export async function getFlow(id: string): Promise<Flow | null> {
  const row = await db.queryOne<any>('SELECT * FROM flows WHERE id = ?', [id]);
  if (!row) return null;
  
  const triggers = await db.query<any>('SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', [id]);
  const jobs = await db.query<any>('SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', [id]);
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    eventType: row.event_type,
    priority: row.priority || 0,
    triggerIds: triggers.map(t => t.trigger_id),
    jobIds: jobs.map(j => j.job_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFlowsByType(type: string): Promise<Flow[]> {
  const rows = await db.query<any>('SELECT * FROM flows WHERE event_type = ? ORDER BY priority DESC', [type]);
  const flows: Flow[] = [];
  
  for (const row of rows) {
    const triggers = await db.query<any>('SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', [row.id]);
    const jobs = await db.query<any>('SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', [row.id]);
    
    flows.push({
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      eventType: row.event_type,
      priority: row.priority || 0,
      triggerIds: triggers.map(t => t.trigger_id),
      jobIds: jobs.map(j => j.job_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  
  return flows;
}

export async function saveFlow(flow: Flow): Promise<void> {
  const now = new Date().toISOString();
  
  await db.execute(
    `INSERT INTO flows (id, name, description, enabled, event_type, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, priority=excluded.priority, updated_at=excluded.updated_at`,
    [flow.id, flow.name, flow.description, flow.enabled ? 1 : 0, flow.eventType, flow.priority, now, now]
  );
  
  // 更新 triggers
  await db.execute('DELETE FROM flow_triggers WHERE flow_id = ?', [flow.id]);
  for (const triggerId of flow.triggerIds) {
    await db.execute(
      'INSERT INTO flow_triggers (flow_id, trigger_id) VALUES (?, ?)',
      [flow.id, triggerId]
    );
  }
  
  // 更新 jobs
  await db.execute('DELETE FROM flow_jobs WHERE flow_id = ?', [flow.id]);
  for (let i = 0; i < flow.jobIds.length; i++) {
    await db.execute(
      'INSERT INTO flow_jobs (flow_id, job_id, job_order) VALUES (?, ?, ?)',
      [flow.id, flow.jobIds[i], i]
    );
  }
}

export async function deleteFlow(id: string): Promise<void> {
  await db.execute('DELETE FROM flows WHERE id = ?', [id]);
}

// ==================== Trigger 操作 ====================
export async function getTriggers(): Promise<Trigger[]> {
  const rows = await db.query<any>('SELECT * FROM triggers ORDER BY created_at DESC');
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    eventType: row.event_type,
    match: {
      type: row.match_type,
      pattern: row.match_pattern,
      ignoreCase: row.match_ignore_case === 1,
    },
    permission: JSON.parse(row.permission_rules || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getTrigger(id: string): Promise<Trigger | null> {
  const row = await db.queryOne<any>('SELECT * FROM triggers WHERE id = ?', [id]);
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    eventType: row.event_type,
    match: {
      type: row.match_type,
      pattern: row.match_pattern,
      ignoreCase: row.match_ignore_case === 1,
    },
    permission: JSON.parse(row.permission_rules || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTriggersByType(type: string): Promise<Trigger[]> {
  const rows = await db.query<any>('SELECT * FROM triggers WHERE event_type = ? ORDER BY created_at DESC', [type]);
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    eventType: row.event_type,
    match: {
      type: row.match_type,
      pattern: row.match_pattern,
      ignoreCase: row.match_ignore_case === 1,
    },
    permission: JSON.parse(row.permission_rules || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveTrigger(trigger: Trigger): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO triggers (id, name, description, enabled, event_type, match_type, match_pattern, match_ignore_case, permission_rules, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, match_type=excluded.match_type, match_pattern=excluded.match_pattern, match_ignore_case=excluded.match_ignore_case, permission_rules=excluded.permission_rules, updated_at=excluded.updated_at`,
    [
      trigger.id,
      trigger.name,
      trigger.description,
      trigger.enabled ? 1 : 0,
      trigger.eventType,
      trigger.match.type,
      trigger.match.pattern,
      trigger.match.ignoreCase ? 1 : 0,
      JSON.stringify(trigger.permission),
      now,
      now,
    ]
  );
}

export async function deleteTrigger(id: string): Promise<void> {
  await db.execute('DELETE FROM triggers WHERE id = ?', [id]);
}

// ==================== Job 操作 ====================
export async function getJobs(): Promise<Job[]> {
  const rows = await db.query<any>('SELECT * FROM jobs ORDER BY created_at DESC');
  const jobs: Job[] = [];
  
  for (const row of rows) {
    const steps = await db.query<any>('SELECT * FROM steps WHERE job_id = ? ORDER BY step_order', [row.id]);
    
    jobs.push({
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      steps: steps.map(s => ({
        id: s.id,
        type: s.type,
        name: s.name,
        description: s.description,
        config: JSON.parse(s.config || '{}'),
        order: s.step_order,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  
  return jobs;
}

export async function getJob(id: string): Promise<Job | null> {
  const row = await db.queryOne<any>('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!row) return null;
  
  const steps = await db.query<any>('SELECT * FROM steps WHERE job_id = ? ORDER BY step_order', [id]);
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled === 1,
    steps: steps.map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      description: s.description,
      config: JSON.parse(s.config || '{}'),
      order: s.step_order,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveJob(job: Job): Promise<void> {
  const now = new Date().toISOString();
  
  await db.execute(
    `INSERT INTO jobs (id, name, description, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, updated_at=excluded.updated_at`,
    [job.id, job.name, job.description, job.enabled ? 1 : 0, now, now]
  );
  
  // 删除旧 steps
  await db.execute('DELETE FROM steps WHERE job_id = ?', [job.id]);
  
  // 插入新 steps
  for (const step of job.steps) {
    await db.execute(
      `INSERT INTO steps (id, job_id, type, name, description, config, step_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [step.id, job.id, step.type, step.name, step.description, JSON.stringify(step.config), step.order, now, now]
    );
  }
}

export async function deleteJob(id: string): Promise<void> {
  await db.execute('DELETE FROM jobs WHERE id = ?', [id]);
}

// ==================== User 操作 ====================
export async function getUser(id: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!row) return null;
  
  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [id]);
  
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image || undefined,
    isActive: row.is_active === 1,
    emailVerified: row.email_verified,
    roleIds: roles.map(r => r.role_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
  if (!row) return null;
  
  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);
  
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image || undefined,
    isActive: row.is_active === 1,
    emailVerified: row.email_verified,
    roleIds: roles.map(r => r.role_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserByGithubId(githubId: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE github_id = ?', [githubId]);
  if (!row) return null;
  
  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);
  
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image || undefined,
    isActive: row.is_active === 1,
    emailVerified: row.email_verified,
    roleIds: roles.map(r => r.role_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const userId = generateId();
  const now = new Date().toISOString();
  
  await db.execute(
    `INSERT INTO users (id, email, name, image, is_active, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, userData.email, userData.name, userData.image || null, userData.isActive ? 1 : 0, userData.emailVerified, now, now]
  );
  
  // 添加角色
  for (const roleId of userData.roleIds || []) {
    await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
  }
  
  return {
    id: userId,
    ...userData,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  
  if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
  if ('email' in updates) { fields.push('email = ?'); values.push(updates.email); }
  if ('image' in updates) { fields.push('image = ?'); values.push(updates.image); }
  if ('isActive' in updates) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if ('lastLoginAt' in updates) { fields.push('last_login_at = ?'); values.push(updates.lastLoginAt ? new Date(updates.lastLoginAt).toISOString() : null); }
  
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values as any);
  }
  
  return getUser(id);
}

export async function deleteUser(id: string): Promise<boolean> {
  await db.execute('DELETE FROM users WHERE id = ?', [id]);
  return true;
}

// ==================== Role 操作 ====================
export async function getRoles(): Promise<Role[]> {
  const rows = await db.query<any>('SELECT * FROM roles ORDER BY created_at DESC');
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: JSON.parse(row.permissions || '[]'),
    isSystem: row.is_system === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getRole(id: string): Promise<Role | null> {
  const row = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: JSON.parse(row.permissions || '[]'),
    isSystem: row.is_system === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
  const roleId = generateId();
  const now = new Date().toISOString();
  
  await db.execute(
    `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [roleId, roleData.name, roleData.description, JSON.stringify(roleData.permissions), roleData.isSystem ? 1 : 0, now, now]
  );
  
  return {
    id: roleId,
    ...roleData,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  
  if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
  if ('description' in updates) { fields.push('description = ?'); values.push(updates.description); }
  if ('permissions' in updates) { fields.push('permissions = ?'); values.push(JSON.stringify(updates.permissions)); }
  
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);
    
    await db.execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values as any);
  }
  
  return getRole(id);
}

export async function deleteRole(id: string): Promise<boolean> {
  // 不允许删除系统角色
  const role = await getRole(id);
  if (role?.isSystem) return false;
  
  await db.execute('DELETE FROM roles WHERE id = ?', [id]);
  return true;
}

// ==================== 权限相关 ====================
export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await getUser(userId);
  if (!user) return [];
  
  const roles = await Promise.all(user.roleIds.map(roleId => getRole(roleId)));
  const permissions = new Set<string>();
  
  for (const role of roles) {
    if (role?.permissions) {
      role.permissions.forEach(p => permissions.add(p));
    }
  }
  
  return Array.from(permissions);
}

export function hasPermission(userPermissions: string[], required: string | string[]): boolean {
  if (!userPermissions) return false;
  
  if (typeof required === 'string') {
    return userPermissions.includes(required);
  }
  
  return required.every(p => userPermissions.includes(p));
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  if (!userPermissions || !required) return false;
  return required.some(p => userPermissions.includes(p));
}

// ==================== 初始化 RBAC ====================
export async function initializeRBAC(): Promise<void> {
  const SYSTEM_ROLES = [
    {
      id: 'super_admin',
      name: '超级管理员',
      description: '拥有所有权限',
      permissions: [
        'adapters:read', 'adapters:create', 'adapters:update', 'adapters:delete', 'adapters:manage',
        'bots:read', 'bots:create', 'bots:update', 'bots:delete', 'bots:manage',
        'flows:read', 'flows:create', 'flows:update', 'flows:delete', 'flows:manage',
        'users:read', 'users:create', 'users:update', 'users:delete', 'users:manage',
        'roles:read', 'roles:create', 'roles:update', 'roles:delete', 'roles:manage',
      ],
      isSystem: true,
    },
    {
      id: 'admin',
      name: '管理员',
      description: '管理适配器、机器人和流程',
      permissions: ['adapters:manage', 'bots:manage', 'flows:manage', 'users:read'],
      isSystem: true,
    },
    {
      id: 'operator',
      name: '运维人员',
      description: '管理机器人和流程',
      permissions: ['adapters:read', 'bots:read', 'bots:update', 'flows:read', 'flows:update'],
      isSystem: true,
    },
    {
      id: 'viewer',
      name: '查看者',
      description: '只读权限',
      permissions: ['adapters:read', 'bots:read', 'flows:read'],
      isSystem: true,
    },
  ];
  
  for (const role of SYSTEM_ROLES) {
    await db.execute(
      `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET permissions=excluded.permissions, updated_at=datetime('now')`,
      [role.id, role.name, role.description, JSON.stringify(role.permissions), role.isSystem ? 1 : 0]
    );
  }
}
