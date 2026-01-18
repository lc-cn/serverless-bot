import { BotConfig, AdapterConfig, Flow, Job, Trigger } from '@/types';
import { User, Role, SYSTEM_ROLES } from '@/types/auth';
import { generateId } from '@/lib/utils';
import { createClient, type Client } from '@libsql/client';

// ==================== 统一存储接口 ====================

export interface UnifiedStorage {
  // Bot 配置
  getBots(): Promise<BotConfig[]>;
  getBot(id: string): Promise<BotConfig | null>;
  getBotsByPlatform(platform: string): Promise<BotConfig[]>;
  saveBot(bot: BotConfig): Promise<void>;
  deleteBot(id: string): Promise<void>;

  // Adapter 配置
  getAdapters(): Promise<AdapterConfig[]>;
  getAdapter(platform: string): Promise<AdapterConfig | null>;
  saveAdapter(adapter: AdapterConfig): Promise<void>;
  deleteAdapter(platform: string): Promise<void>;

  // Flow 配置
  getFlows(): Promise<Flow[]>;
  getFlow(id: string): Promise<Flow | null>;
  getFlowsByType(type: string): Promise<Flow[]>;
  saveFlow(flow: Flow): Promise<void>;
  deleteFlow(id: string): Promise<void>;

  // Trigger 配置
  getTriggers(): Promise<Trigger[]>;
  getTrigger(id: string): Promise<Trigger | null>;
  getTriggersByType(type: string): Promise<Trigger[]>;
  saveTrigger(trigger: Trigger): Promise<void>;
  deleteTrigger(id: string): Promise<void>;

  // Job 配置
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  saveJob(job: Job): Promise<void>;
  deleteJob(id: string): Promise<void>;

  // 用户管理
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByGithubId(githubId: string): Promise<User | null>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;

  // 角色管理
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | null>;
  createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;
  updateRole(id: string, updates: Partial<Role>): Promise<Role | null>;
  deleteRole(id: string): Promise<boolean>;

  // 初始化
  initializeRBAC(): Promise<void>;
}

// ==================== 内存存储实现 ====================

class MemoryStorage implements UnifiedStorage {
  private bots: Map<string, BotConfig> = new Map();
  private adapters: Map<string, AdapterConfig> = new Map();
  private flows: Map<string, Flow> = new Map();
  private triggers: Map<string, Trigger> = new Map();
  private jobs: Map<string, Job> = new Map();
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();

  // ==================== Bot 配置 ====================
  async getBots(): Promise<BotConfig[]> {
    return Array.from(this.bots.values());
  }

  async getBot(id: string): Promise<BotConfig | null> {
    return this.bots.get(id) || null;
  }

  async getBotsByPlatform(platform: string): Promise<BotConfig[]> {
    return Array.from(this.bots.values()).filter(bot => bot.platform === platform);
  }

  async saveBot(bot: BotConfig): Promise<void> {
    this.bots.set(bot.id, bot);
  }

  async deleteBot(id: string): Promise<void> {
    this.bots.delete(id);
  }

  // ==================== Adapter 配置 ====================
  async getAdapters(): Promise<AdapterConfig[]> {
    return Array.from(this.adapters.values());
  }

  async getAdapter(platform: string): Promise<AdapterConfig | null> {
    return this.adapters.get(platform) || null;
  }

  async saveAdapter(adapter: AdapterConfig): Promise<void> {
    this.adapters.set(adapter.platform, adapter);
  }

  async deleteAdapter(platform: string): Promise<void> {
    this.adapters.delete(platform);
  }

  // ==================== Flow 配置 ====================
  async getFlows(): Promise<Flow[]> {
    return Array.from(this.flows.values());
  }

  async getFlow(id: string): Promise<Flow | null> {
    return this.flows.get(id) || null;
  }

  async getFlowsByType(type: string): Promise<Flow[]> {
    return Array.from(this.flows.values()).filter(flow => flow.eventType === type);
  }

  async saveFlow(flow: Flow): Promise<void> {
    this.flows.set(flow.id, flow);
  }

  async deleteFlow(id: string): Promise<void> {
    this.flows.delete(id);
  }

  // ==================== Trigger 配置 ====================
  async getTriggers(): Promise<Trigger[]> {
    return Array.from(this.triggers.values());
  }

  async getTrigger(id: string): Promise<Trigger | null> {
    return this.triggers.get(id) || null;
  }

  async getTriggersByType(type: string): Promise<Trigger[]> {
    return Array.from(this.triggers.values()).filter(trigger => trigger.eventType === type);
  }

  async saveTrigger(trigger: Trigger): Promise<void> {
    this.triggers.set(trigger.id, trigger);
  }

  async deleteTrigger(id: string): Promise<void> {
    this.triggers.delete(id);
  }

  // ==================== Job 配置 ====================
  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJob(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async saveJob(job: Job): Promise<void> {
    this.jobs.set(job.id, job);
  }

  async deleteJob(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  // ==================== 用户管理 ====================
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.email === email) || null;
  }

  async getUserByGithubId(githubId: string): Promise<User | null> {
    return Array.from(this.users.values()).find(u => u.githubId === githubId) || null;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      ...userData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updated: User = {
      ...user,
      ...updates,
      id: user.id,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // ==================== 角色管理 ====================
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async getRole(id: string): Promise<Role | null> {
    return this.roles.get(id) || null;
  }

  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const now = new Date().toISOString();
    const role: Role = {
      ...roleData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.roles.set(role.id, role);
    return role;
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(id);
    if (!role) return null;

    const updated: Role = {
      ...role,
      ...updates,
      id: role.id,
      updatedAt: new Date().toISOString(),
    };
    this.roles.set(id, updated);
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    const systemRoleIds = Object.values(SYSTEM_ROLES).map(r => r.id);
    if (systemRoleIds.includes(id)) return false;
    return this.roles.delete(id);
  }

  // ==================== RBAC 初始化 ====================
  async initializeRBAC(): Promise<void> {
    const now = new Date().toISOString();
    for (const roleData of Object.values(SYSTEM_ROLES)) {
      if (!this.roles.has(roleData.id)) {
        const role: Role = {
          ...roleData,
          createdAt: now,
          updatedAt: now,
        };
        this.roles.set(role.id, role);
      }
    }
  }
}

// ==================== libSQL/Turso 存储实现 ====================

class LibsqlStorage implements UnifiedStorage {
  private db: Client | null = null;

  private async getDb() {
    if (this.db) return this.db;
    const url = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
    if (!url) return null;
    this.db = createClient({ url, authToken: process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
    return this.db;
  }

  // ==================== Bot 配置 ====================
  async getBots(): Promise<BotConfig[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM bots ORDER BY created_at DESC', args: [] });
      return res.rows.map((row: any) => ({
        id: row.id,
        platform: row.platform,
        name: row.name,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config || '{}'),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getBots failed', error);
      return [];
    }
  }

  async getBot(id: string): Promise<BotConfig | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM bots WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
      if (!row) return null;
      return {
        id: row.id,
        platform: row.platform,
        name: row.name,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config || '{}'),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (error) {
      console.error('[LibsqlStorage] getBot failed', error);
      return null;
    }
  }

  async getBotsByPlatform(platform: string): Promise<BotConfig[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM bots WHERE platform = ? ORDER BY created_at DESC', args: [platform] });
      return res.rows.map((row: any) => ({
        id: row.id,
        platform: row.platform,
        name: row.name,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config || '{}'),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getBotsByPlatform failed', error);
      return [];
    }
  }

  async saveBot(bot: BotConfig): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const now = new Date().toISOString();
      await db.execute({ sql: `INSERT INTO bots (id, platform, name, enabled, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`, args: [
          bot.id,
          bot.platform,
          bot.name,
          bot.enabled ? 1 : 0,
          JSON.stringify(bot.config),
          new Date(bot.createdAt).toISOString(),
          now,
        ] });
    } catch (error) {
      console.error('[LibsqlStorage] saveBot failed', error);
    }
  }

  async deleteBot(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.execute({ sql: 'DELETE FROM bots WHERE id = ?', args: [id] });
    } catch (error) {
      console.error('[LibsqlStorage] deleteBot failed', error);
    }
  }

  // ==================== Adapter 配置 ====================
  async getAdapters(): Promise<AdapterConfig[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM adapters ORDER BY created_at DESC', args: [] });
      return res.rows.map((row: any) => ({
        platform: row.platform,
        name: row.name,
        description: row.description,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config || '{}'),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getAdapters failed', error);
      return [];
    }
  }

  async getAdapter(platform: string): Promise<AdapterConfig | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM adapters WHERE platform = ?', args: [platform] });
      const row = res.rows[0] as any;
      if (!row) return null;
      return {
        platform: row.platform,
        name: row.name,
        description: row.description,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config || '{}'),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (error) {
      console.error('[LibsqlStorage] getAdapter failed', error);
      return null;
    }
  }

  async saveAdapter(adapter: AdapterConfig): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const now = new Date().toISOString();
      await db.execute({ sql: `INSERT INTO adapters (platform, name, description, enabled, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`, args: [
          adapter.platform,
          adapter.name,
          adapter.description || null,
          adapter.enabled ? 1 : 0,
          JSON.stringify(adapter.config),
          new Date(adapter.createdAt || Date.now()).toISOString(),
          now,
        ] });
    } catch (error) {
      console.error('[LibsqlStorage] saveAdapter failed', error);
    }
  }

  async deleteAdapter(platform: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.execute({ sql: 'DELETE FROM adapters WHERE platform = ?', args: [platform] });
    } catch (error) {
      console.error('[LibsqlStorage] deleteAdapter failed', error);
    }
  }

  // ==================== Flow 配置 ====================
  async getFlows(): Promise<Flow[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM flows ORDER BY created_at DESC', args: [] });
      const flows: Flow[] = [];
      
      for (const row of res.rows as any[]) {
        // 获取关联的 trigger 和 job
        const triggersRes = await db.execute({ sql: 'SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', args: [row.id] });
        const jobsRes = await db.execute({ sql: 'SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', args: [row.id] });
        
        flows.push({
          id: row.id,
          name: row.name,
          description: row.description,
          enabled: row.enabled === 1,
          eventType: row.event_type,
          triggerIds: triggersRes.rows.map((r: any) => r.trigger_id),
          priority: row.priority,
          jobIds: jobsRes.rows.map((r: any) => r.job_id),
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        });
      }
      
      return flows;
    } catch (error) {
      console.error('[LibsqlStorage] getFlows failed', error);
      return [];
    }
  }

  async getFlow(id: string): Promise<Flow | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM flows WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
      if (!row) return null;
      
      const triggersRes = await db.execute({ sql: 'SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', args: [id] });
      const jobsRes = await db.execute({ sql: 'SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', args: [id] });
      
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        enabled: row.enabled === 1,
        eventType: row.event_type,
        triggerIds: triggersRes.rows.map((r: any) => r.trigger_id),
        priority: row.priority,
        jobIds: jobsRes.rows.map((r: any) => r.job_id),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (error) {
      console.error('[LibsqlStorage] getFlow failed', error);
      return null;
    }
  }

  async getFlowsByType(type: string): Promise<Flow[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM flows WHERE event_type = ? ORDER BY priority DESC', args: [type] });
      const flows: Flow[] = [];
      
      for (const row of res.rows as any[]) {
        const triggersRes = await db.execute({ sql: 'SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', args: [row.id] });
        const jobsRes = await db.execute({ sql: 'SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', args: [row.id] });
        
        flows.push({
          id: row.id,
          name: row.name,
          description: row.description,
          enabled: row.enabled === 1,
          eventType: row.event_type,
          triggerIds: triggersRes.rows.map((r: any) => r.trigger_id),
          priority: row.priority,
          jobIds: jobsRes.rows.map((r: any) => r.job_id),
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        });
      }
      
      return flows;
    } catch (error) {
      console.error('[LibsqlStorage] getFlowsByType failed', error);
      return [];
    }
  }

  async saveFlow(flow: Flow): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const now = new Date().toISOString();
      
      // 保存 flow 主记录
      await db.execute({ sql: `INSERT INTO flows (id, name, description, enabled, event_type, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, event_type=excluded.event_type, priority=excluded.priority, updated_at=excluded.updated_at`, args: [
          flow.id,
          flow.name,
          flow.description || null,
          flow.enabled ? 1 : 0,
          flow.eventType,
          flow.priority,
          new Date(flow.createdAt).toISOString(),
          now,
        ] });
      
      // 删除旧的关联关系并重新插入
      await db.execute({ sql: 'DELETE FROM flow_triggers WHERE flow_id = ?', args: [flow.id] });
      for (const triggerId of flow.triggerIds) {
        await db.execute({ sql: 'INSERT INTO flow_triggers (flow_id, trigger_id) VALUES (?, ?)', args: [flow.id, triggerId] });
      }
      
      await db.execute({ sql: 'DELETE FROM flow_jobs WHERE flow_id = ?', args: [flow.id] });
      for (let i = 0; i < flow.jobIds.length; i++) {
        await db.execute({ sql: 'INSERT INTO flow_jobs (flow_id, job_id, job_order) VALUES (?, ?, ?)', args: [flow.id, flow.jobIds[i], i] });
      }
    } catch (error) {
      console.error('[LibsqlStorage] saveFlow failed', error);
    }
  }

  async deleteFlow(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      // 级联删除会自动处理 flow_triggers 和 flow_jobs
      await db.execute({ sql: 'DELETE FROM flows WHERE id = ?', args: [id] });
    } catch (error) {
      console.error('[LibsqlStorage] deleteFlow failed', error);
    }
  }

  // ==================== Trigger 配置 ====================
  async getTriggers(): Promise<Trigger[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM triggers ORDER BY created_at DESC', args: [] });
      return res.rows.map((row: any) => ({
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
        permission: {
          allowRoles: JSON.parse(row.permission_allow_roles),
          allowEnvironments: JSON.parse(row.permission_allow_environments),
          allowGroups: row.permission_allow_groups ? JSON.parse(row.permission_allow_groups) : undefined,
          allowUsers: row.permission_allow_users ? JSON.parse(row.permission_allow_users) : undefined,
          denyGroups: row.permission_deny_groups ? JSON.parse(row.permission_deny_groups) : undefined,
          denyUsers: row.permission_deny_users ? JSON.parse(row.permission_deny_users) : undefined,
        },
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getTriggers failed', error);
      return [];
    }
  }

  async getTrigger(id: string): Promise<Trigger | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM triggers WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
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
        permission: {
          allowRoles: JSON.parse(row.permission_allow_roles),
          allowEnvironments: JSON.parse(row.permission_allow_environments),
          allowGroups: row.permission_allow_groups ? JSON.parse(row.permission_allow_groups) : undefined,
          allowUsers: row.permission_allow_users ? JSON.parse(row.permission_allow_users) : undefined,
          denyGroups: row.permission_deny_groups ? JSON.parse(row.permission_deny_groups) : undefined,
          denyUsers: row.permission_deny_users ? JSON.parse(row.permission_deny_users) : undefined,
        },
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (error) {
      console.error('[LibsqlStorage] getTrigger failed', error);
      return null;
    }
  }

  async getTriggersByType(type: string): Promise<Trigger[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM triggers WHERE event_type = ? ORDER BY created_at DESC', args: [type] });
      return res.rows.map((row: any) => ({
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
        permission: {
          allowRoles: JSON.parse(row.permission_allow_roles),
          allowEnvironments: JSON.parse(row.permission_allow_environments),
          allowGroups: row.permission_allow_groups ? JSON.parse(row.permission_allow_groups) : undefined,
          allowUsers: row.permission_allow_users ? JSON.parse(row.permission_allow_users) : undefined,
          denyGroups: row.permission_deny_groups ? JSON.parse(row.permission_deny_groups) : undefined,
          denyUsers: row.permission_deny_users ? JSON.parse(row.permission_deny_users) : undefined,
        },
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getTriggersByType failed', error);
      return [];
    }
  }

  async saveTrigger(trigger: Trigger): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const now = new Date().toISOString();
      await db.execute({ sql: `INSERT INTO triggers (id, name, description, enabled, event_type, match_type, match_pattern, match_ignore_case, 
          permission_allow_roles, permission_allow_environments, permission_allow_groups, permission_allow_users, 
          permission_deny_groups, permission_deny_users, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET 
          name=excluded.name, description=excluded.description, enabled=excluded.enabled, 
          event_type=excluded.event_type, match_type=excluded.match_type, match_pattern=excluded.match_pattern, 
          match_ignore_case=excluded.match_ignore_case, permission_allow_roles=excluded.permission_allow_roles, 
          permission_allow_environments=excluded.permission_allow_environments, updated_at=excluded.updated_at`, args: [
          trigger.id,
          trigger.name,
          trigger.description || null,
          trigger.enabled ? 1 : 0,
          trigger.eventType,
          trigger.match.type,
          trigger.match.pattern,
          trigger.match.ignoreCase ? 1 : 0,
          JSON.stringify(trigger.permission.allowRoles),
          JSON.stringify(trigger.permission.allowEnvironments),
          trigger.permission.allowGroups ? JSON.stringify(trigger.permission.allowGroups) : null,
          trigger.permission.allowUsers ? JSON.stringify(trigger.permission.allowUsers) : null,
          trigger.permission.denyGroups ? JSON.stringify(trigger.permission.denyGroups) : null,
          trigger.permission.denyUsers ? JSON.stringify(trigger.permission.denyUsers) : null,
          new Date(trigger.createdAt).toISOString(),
          now,
        ] });
    } catch (error) {
      console.error('[LibsqlStorage] saveTrigger failed', error);
    }
  }

  async deleteTrigger(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.execute({ sql: 'DELETE FROM triggers WHERE id = ?', args: [id] });
    } catch (error) {
      console.error('[LibsqlStorage] deleteTrigger failed', error);
    }
  }

  // ==================== Job 配置 ====================
  async getJobs(): Promise<Job[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM jobs ORDER BY created_at DESC', args: [] });
      const jobs: Job[] = [];
      
      for (const row of res.rows as any[]) {
        const stepsRes = await db.execute({ sql: 'SELECT * FROM steps WHERE job_id = ? ORDER BY step_order', args: [row.id] });
        jobs.push({
          id: row.id,
          name: row.name,
          description: row.description,
          enabled: row.enabled === 1,
          steps: stepsRes.rows.map((s: any) => ({
            id: s.id,
            type: s.type,
            name: s.name,
            description: s.description,
            config: JSON.parse(s.config),
            order: s.step_order,
          })),
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        });
      }
      
      return jobs;
    } catch (error) {
      console.error('[LibsqlStorage] getJobs failed', error);
      return [];
    }
  }

  async getJob(id: string): Promise<Job | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
      if (!row) return null;
      
      const stepsRes = await db.execute({ sql: 'SELECT * FROM steps WHERE job_id = ? ORDER BY step_order', args: [id] });
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        enabled: row.enabled === 1,
        steps: stepsRes.rows.map((s: any) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          description: s.description,
          config: JSON.parse(s.config),
          order: s.step_order,
        })),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (error) {
      console.error('[LibsqlStorage] getJob failed', error);
      return null;
    }
  }

  async saveJob(job: Job): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      const now = new Date().toISOString();
      
      // 保存 job
      await db.execute({ sql: `INSERT INTO jobs (id, name, description, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, updated_at=excluded.updated_at`, args: [
          job.id,
          job.name,
          job.description || null,
          job.enabled ? 1 : 0,
          new Date(job.createdAt).toISOString(),
          now,
        ] });
      
      // 删除旧的 steps 并重新插入
      await db.execute({ sql: 'DELETE FROM steps WHERE job_id = ?', args: [job.id] });
      for (const step of job.steps) {
        await db.execute({ sql: `INSERT INTO steps (id, job_id, type, name, description, config, step_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [
            step.id,
            job.id,
            step.type,
            step.name,
            step.description || null,
            JSON.stringify(step.config),
            step.order,
            now,
            now,
          ] });
      }
    } catch (error) {
      console.error('[LibsqlStorage] saveJob failed', error);
    }
  }

  async deleteJob(id: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    try {
      await db.execute({ sql: 'DELETE FROM jobs WHERE id = ?', args: [id] });
    } catch (error) {
      console.error('[LibsqlStorage] deleteJob failed', error);
    }
  }

  // ==================== 用户管理 ====================
  async getUsers(): Promise<User[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM users ORDER BY created_at DESC', args: [] });
      const users: User[] = [];
      
      for (const row of res.rows as any[]) {
        const rolesRes = await db.execute({ sql: 'SELECT role_id FROM user_roles WHERE user_id = ?', args: [row.id] });
        
        users.push({
          id: row.id,
          email: row.email,
          name: row.name,
          image: row.image,
          passwordHash: row.password_hash,
          githubId: row.github_id,
          roleIds: rolesRes.rows.map((r: any) => r.role_id),
          isActive: row.is_active === 1,
          emailVerified: row.email_verified,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: row.last_login_at,
        });
      }
      
      return users;
    } catch (error) {
      console.error('[LibsqlStorage] getUsers failed', error);
      return [];
    }
  }

  async getUser(id: string): Promise<User | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
      if (!row) return null;
      
      const rolesRes = await db.execute({ sql: 'SELECT role_id FROM user_roles WHERE user_id = ?', args: [id] });
      
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        image: row.image,
        passwordHash: row.password_hash,
        githubId: row.github_id,
        roleIds: rolesRes.rows.map((r: any) => r.role_id),
        isActive: row.is_active === 1,
        emailVerified: row.email_verified,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at,
      };
    } catch (error) {
      console.error('[LibsqlStorage] getUser failed', error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
      const row = res.rows[0] as any;
      if (!row) return null;
      return await this.getUser(row.id);
    } catch (error) {
      console.error('[LibsqlStorage] getUserByEmail failed', error);
      return null;
    }
  }

  async getUserByGithubId(githubId: string): Promise<User | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM users WHERE github_id = ?', args: [githubId] });
      const row = res.rows[0] as any;
      if (!row) return null;
      return await this.getUser(row.id);
    } catch (error) {
      console.error('[LibsqlStorage] getUserByGithubId failed', error);
      return null;
    }
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const db = await this.getDb();
    if (!db) throw new Error('Database not configured');
    
    const now = new Date().toISOString();
    const userId = generateId();
    
    try {
      await db.execute({ sql: `INSERT INTO users (id, email, name, image, password_hash, github_id, is_active, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [
          userId,
          userData.email || null,
          userData.name,
          userData.image || null,
          userData.passwordHash || null,
          userData.githubId || null,
          userData.isActive ? 1 : 0,
          userData.emailVerified || null,
          now,
          now,
        ] });
      
      // 添加角色
      for (const roleId of userData.roleIds) {
        await db.execute({ sql: 'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', args: [userId, roleId] });
      }
      
      return await this.getUser(userId) as User;
    } catch (error) {
      console.error('[LibsqlStorage] createUser failed', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const db = await this.getDb();
    if (!db) return null;
    
    try {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];
      
      if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
      if ('email' in updates) { fields.push('email = ?'); values.push(updates.email); }
      if ('image' in updates) { fields.push('image = ?'); values.push(updates.image); }
      if ('passwordHash' in updates) { fields.push('password_hash = ?'); values.push(updates.passwordHash); }
      if ('isActive' in updates) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
      if ('lastLoginAt' in updates) { fields.push('last_login_at = ?'); values.push(updates.lastLoginAt); }
      
      if (fields.length > 0) {
        fields.push('updated_at = ?');
        values.push(now);
        values.push(id);
        
        await db.execute({ 
          sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, 
          args: values as any
        });
      }
      
      return await this.getUser(id);
    } catch (error) {
      console.error('[LibsqlStorage] updateUser failed', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    const db = await this.getDb();
    if (!db) return false;
    try {
      await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
      return true;
    } catch (error) {
      console.error('[LibsqlStorage] deleteUser failed', error);
      return false;
    }
  }

  // ==================== 角色管理 ====================
  async getRoles(): Promise<Role[]> {
    const db = await this.getDb();
    if (!db) return [];
    try {
      const res = await db.execute({ sql: 'SELECT * FROM roles ORDER BY created_at DESC', args: [] });
      return res.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: JSON.parse(row.permissions),
        isSystem: row.is_system === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[LibsqlStorage] getRoles failed', error);
      return [];
    }
  }

  async getRole(id: string): Promise<Role | null> {
    const db = await this.getDb();
    if (!db) return null;
    try {
      const res = await db.execute({ sql: 'SELECT * FROM roles WHERE id = ?', args: [id] });
      const row = res.rows[0] as any;
      if (!row) return null;
      
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: JSON.parse(row.permissions),
        isSystem: row.is_system === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('[LibsqlStorage] getRole failed', error);
      return null;
    }
  }

  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const db = await this.getDb();
    if (!db) throw new Error('Database not configured');
    
    const now = new Date().toISOString();
    const roleId = generateId();
    
    try {
      await db.execute({ sql: `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, args: [
          roleId,
          roleData.name,
          roleData.description || null,
          JSON.stringify(roleData.permissions),
          roleData.isSystem ? 1 : 0,
          now,
          now,
        ] });
      
      return await this.getRole(roleId) as Role;
    } catch (error) {
      console.error('[LibsqlStorage] createRole failed', error);
      throw error;
    }
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
    const db = await this.getDb();
    if (!db) return null;
    
    try {
      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: unknown[] = [];
      
      if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
      if ('description' in updates) { fields.push('description = ?'); values.push(updates.description); }
      if ('permissions' in updates) { fields.push('permissions = ?'); values.push(JSON.stringify(updates.permissions)); }
      
      if (fields.length > 0) {
        fields.push('updated_at = ?');
        values.push(now);
        values.push(id);
        
        await db.execute({ 
          sql: `UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, 
          args: values as any
        });
      }
      
      return await this.getRole(id);
    } catch (error) {
      console.error('[LibsqlStorage] updateRole failed', error);
      return null;
    }
  }

  async deleteRole(id: string): Promise<boolean> {
    const db = await this.getDb();
    if (!db) return false;
    
    try {
      const systemRoleIds = Object.values(SYSTEM_ROLES).map(r => r.id);
      if (systemRoleIds.includes(id)) return false;
      
      await db.execute({ sql: 'DELETE FROM roles WHERE id = ?', args: [id] });
      return true;
    } catch (error) {
      console.error('[LibsqlStorage] deleteRole failed', error);
      return false;
    }
  }

  // ==================== RBAC 初始化 ====================
  async initializeRBAC(): Promise<void> {
    // 表已经由迁移脚本初始化
    console.log('[LibsqlStorage] RBAC already initialized via migrations');
  }
}

// ==================== 导出单例 ====================

const globalForStorage = globalThis as unknown as {
  unifiedStorage: UnifiedStorage | undefined;
};

function createStorage(): UnifiedStorage {
  const hasLibsql = !!(process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL);

  if (typeof window === 'undefined' && !globalForStorage.unifiedStorage) {
    const mode = hasLibsql ? 'libSQL (Turso)' : 'in-memory';
    console.log(`[Storage] Using ${mode} storage.${mode === 'in-memory' ? ' Data will be lost on restart.' : ''}`);
  }

  if (hasLibsql) return new LibsqlStorage();
  return new MemoryStorage();
}

export const storage: UnifiedStorage = globalForStorage.unifiedStorage ?? (globalForStorage.unifiedStorage = createStorage());

// ==================== 权限工具函数 ====================

export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await storage.getUser(userId);
  if (!user || !user.isActive) return [];

  const permissions = new Set<string>();
  const roles = await storage.getRoles();

  for (const roleId of user.roleIds) {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      for (const permId of role.permissions) {
        permissions.add(permId);
        if (permId.endsWith(':manage')) {
          const resource = permId.split(':')[0];
          permissions.add(`${resource}:create`);
          permissions.add(`${resource}:read`);
          permissions.add(`${resource}:update`);
          permissions.add(`${resource}:delete`);
        }
      }
    }
  }

  return Array.from(permissions);
}

export function hasPermission(userPermissions: string[], required: string | string[]): boolean {
  const requiredPerms = Array.isArray(required) ? required : [required];
  return requiredPerms.every(perm => userPermissions.includes(perm));
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some(perm => userPermissions.includes(perm));
}

// 向后兼容：导出 authStorage 别名
export const authStorage = storage;
