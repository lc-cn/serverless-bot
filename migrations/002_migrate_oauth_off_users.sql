-- 将 OAuth 外键从 users 迁出，仅保留 oauth_accounts；新库无 github_id/gitlab_id 时 INSERT 会报缺列，迁移器按良性错误跳过。
-- 从旧列回填（避免 DROP 后丢绑定）
INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id, email, metadata, created_at)
SELECT 'mig_github_' || u.id, u.id, 'github', u.github_id, u.email, NULL, COALESCE(u.created_at, datetime('now'))
FROM users u
WHERE u.github_id IS NOT NULL AND TRIM(u.github_id) != ''
  AND NOT EXISTS (
    SELECT 1 FROM oauth_accounts o
    WHERE o.provider = 'github' AND o.provider_account_id = u.github_id AND o.user_id = u.id
  );

INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id, email, metadata, created_at)
SELECT 'mig_gitlab_' || u.id, u.id, 'gitlab', u.gitlab_id, u.email, NULL, COALESCE(u.created_at, datetime('now'))
FROM users u
WHERE u.gitlab_id IS NOT NULL AND TRIM(u.gitlab_id) != ''
  AND NOT EXISTS (
    SELECT 1 FROM oauth_accounts o
    WHERE o.provider = 'gitlab' AND o.provider_account_id = u.gitlab_id AND o.user_id = u.id
  );

-- 旧库可能缺下列字段；已有则 duplicate column name（良性跳过）
ALTER TABLE users ADD COLUMN login_token_hash TEXT;

ALTER TABLE users ADD COLUMN onboarding_completed_at INTEGER;

ALTER TABLE users ADD COLUMN onboarding_sections_json TEXT;

ALTER TABLE users ADD COLUMN username TEXT;

-- SQLite 对带 UNIQUE 的列执行 DROP COLUMN 会失败（如 github_id）；改为整表重写并去掉 OAuth 列
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS users__oauth_migration_tmp;

CREATE TABLE users__oauth_migration_tmp (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  image TEXT,
  password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  email_verified TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  login_token_hash TEXT,
  onboarding_completed_at INTEGER,
  onboarding_sections_json TEXT,
  username TEXT
);

INSERT INTO users__oauth_migration_tmp (
  id,
  email,
  name,
  image,
  password_hash,
  is_active,
  email_verified,
  created_at,
  updated_at,
  last_login_at,
  login_token_hash,
  onboarding_completed_at,
  onboarding_sections_json,
  username
)
SELECT
  id,
  email,
  name,
  image,
  password_hash,
  is_active,
  email_verified,
  created_at,
  updated_at,
  last_login_at,
  login_token_hash,
  onboarding_completed_at,
  onboarding_sections_json,
  username
FROM users;

DROP TABLE users;

ALTER TABLE users__oauth_migration_tmp RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_token_hash
  ON users(login_token_hash) WHERE login_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username != '';

PRAGMA foreign_keys = ON;
