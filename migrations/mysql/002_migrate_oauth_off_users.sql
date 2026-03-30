-- 将 OAuth 外键从 users 迁出，仅保留 oauth_accounts；新库无 github_id/gitlab_id 时相关语句可能报错，需与迁移器良性错误规则配合或手工跳过。
INSERT IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id, email, metadata, created_at)
SELECT CONCAT('mig_github_', u.id), u.id, 'github', u.github_id, u.email, NULL, COALESCE(u.created_at, CURRENT_TIMESTAMP(3))
FROM users u
WHERE u.github_id IS NOT NULL AND TRIM(u.github_id) != ''
  AND NOT EXISTS (
    SELECT 1 FROM oauth_accounts o
    WHERE o.provider = 'github' AND o.provider_account_id = u.github_id AND o.user_id = u.id
  );

INSERT IGNORE INTO oauth_accounts (id, user_id, provider, provider_account_id, email, metadata, created_at)
SELECT CONCAT('mig_gitlab_', u.id), u.id, 'gitlab', u.gitlab_id, u.email, NULL, COALESCE(u.created_at, CURRENT_TIMESTAMP(3))
FROM users u
WHERE u.gitlab_id IS NOT NULL AND TRIM(u.gitlab_id) != ''
  AND NOT EXISTS (
    SELECT 1 FROM oauth_accounts o
    WHERE o.provider = 'gitlab' AND o.provider_account_id = u.gitlab_id AND o.user_id = u.id
  );

ALTER TABLE users DROP COLUMN github_id;

ALTER TABLE users DROP COLUMN gitlab_id;
