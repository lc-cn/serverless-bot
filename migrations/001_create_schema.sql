-- SQLite 迁移：创建所有业务表，不使用 kv_store

-- ============================================================
-- 1. RBAC 系统表
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL, -- JSON 数组：["adapters:read", "bots:create", ...]
  is_system INTEGER DEFAULT 0, -- 1 表示系统内置角色
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  password_hash TEXT,
  github_id TEXT UNIQUE,
  is_active INTEGER DEFAULT 1,
  email_verified TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE, -- base64url 编码
  public_key TEXT NOT NULL, -- base64url 编码
  counter INTEGER NOT NULL,
  transports TEXT, -- JSON 数组
  device_name TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge TEXT PRIMARY KEY,
  user_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. 适配器配置表
-- ============================================================

CREATE TABLE IF NOT EXISTS adapters (
  platform TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  config TEXT NOT NULL, -- JSON 对象
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================
-- 3. 机器人配置表
-- ============================================================

CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  config TEXT NOT NULL, -- JSON 对象：{accessToken, secret, ...}
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bots_platform ON bots(platform);

-- ============================================================
-- 4. 流程相关表
-- ============================================================

CREATE TABLE IF NOT EXISTS triggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  event_type TEXT NOT NULL, -- 'message', 'request', 'notice'
  match_type TEXT NOT NULL, -- 'exact', 'prefix', 'suffix', 'contains', 'regex', 'always'
  match_pattern TEXT NOT NULL,
  match_ignore_case INTEGER DEFAULT 0,
  permission_allow_roles TEXT NOT NULL, -- JSON 数组
  permission_allow_environments TEXT NOT NULL, -- JSON 数组：['private', 'group']
  permission_allow_groups TEXT, -- JSON 数组（可选）
  permission_allow_users TEXT, -- JSON 数组（可选）
  permission_deny_groups TEXT, -- JSON 数组（可选）
  permission_deny_users TEXT, -- JSON 数组（可选）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_triggers_event_type ON triggers(event_type);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'call_api', 'send_message', 'conditional', ...
  name TEXT NOT NULL,
  description TEXT,
  config TEXT NOT NULL, -- JSON 对象
  step_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_job_id ON steps(job_id);
CREATE INDEX IF NOT EXISTS idx_steps_order ON steps(job_id, step_order);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  event_type TEXT NOT NULL, -- 'message', 'request', 'notice'
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_flows_event_type ON flows(event_type);
CREATE INDEX IF NOT EXISTS idx_flows_priority ON flows(priority);

-- 流程与触发器的多对多关联
CREATE TABLE IF NOT EXISTS flow_triggers (
  flow_id TEXT NOT NULL,
  trigger_id TEXT NOT NULL,
  PRIMARY KEY (flow_id, trigger_id),
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
);

-- 流程与任务的多对多关联（有序）
CREATE TABLE IF NOT EXISTS flow_jobs (
  flow_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_order INTEGER NOT NULL,
  PRIMARY KEY (flow_id, job_id),
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flow_jobs_order ON flow_jobs(flow_id, job_order);

-- ============================================================
-- 5. 聊天相关表
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  peer_id TEXT NOT NULL, -- 用户ID或群组ID
  peer_type TEXT NOT NULL, -- 'contact' 或 'group'
  role TEXT NOT NULL, -- 'user' 或 'bot'
  content TEXT NOT NULL, -- 消息内容（支持 JSON 格式）
  raw_data TEXT, -- 原始数据（平台特定）
  created_at TEXT NOT NULL,
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_bot_peer ON messages(bot_id, peer_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE TABLE IF NOT EXISTS contacts (
  peer_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  role TEXT, -- 'normal', 'admin', 'owner'
  extra TEXT, -- JSON 对象（平台特定数据）
  updated_at TEXT NOT NULL,
  PRIMARY KEY (peer_id, platform, bot_id),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_platform_bot ON contacts(platform, bot_id);

CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  member_count INTEGER,
  owner_id TEXT,
  description TEXT,
  extra TEXT, -- JSON 对象（平台特定数据）
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, platform, bot_id),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_groups_platform_bot ON groups(platform, bot_id);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  name TEXT,
  role TEXT, -- 'normal', 'admin', 'owner'
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, member_id, platform, bot_id),
  FOREIGN KEY (group_id, platform, bot_id) REFERENCES groups(group_id, platform, bot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id, platform, bot_id);

-- ============================================================
-- 6. 初始化系统数据
-- ============================================================

-- 插入系统角色
INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
VALUES 
  (
    'super_admin',
    '超级管理员',
    '拥有所有权限',
    json('["adapters:read","adapters:create","adapters:update","adapters:delete","adapters:manage","bots:read","bots:create","bots:update","bots:delete","bots:manage","flows:read","flows:create","flows:update","flows:delete","flows:manage","users:read","users:create","users:update","users:delete","users:manage","roles:read","roles:create","roles:update","roles:delete","roles:manage"]'),
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'admin',
    '管理员',
    '管理适配器、机器人和流程',
    json('["adapters:manage","bots:manage","flows:manage","users:read"]'),
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'operator',
    '运维人员',
    '管理机器人和流程',
    json('["adapters:read","bots:read","bots:update","flows:read","flows:update"]'),
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'viewer',
    '查看者',
    '只读权限',
    json('["adapters:read","bots:read","flows:read"]'),
    1,
    datetime('now'),
    datetime('now')
  )
ON CONFLICT(id) DO UPDATE SET updated_at = datetime('now');

-- 插入默认管理员用户
INSERT INTO users (id, name, email, is_active, created_at, updated_at)
VALUES ('admin-localhost', 'Admin', 'admin@localhost', 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO NOTHING;

-- 为默认管理员分配超级管理员角色
INSERT INTO user_roles (user_id, role_id)
VALUES ('admin-localhost', 'super_admin')
ON CONFLICT DO NOTHING;
