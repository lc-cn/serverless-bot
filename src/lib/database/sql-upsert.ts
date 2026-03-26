import { getSqlDialect } from './sql-dialect';

/**
 * 按方言生成 INSERT … ON CONFLICT / ON DUPLICATE KEY 语句（data.ts、initializeRBAC 等复用）。
 */

export function sqlUpsertBot(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO bots (id, platform, name, enabled, config, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), enabled=VALUES(enabled), config=VALUES(config), updated_at=VALUES(updated_at)`;
  }
  return `INSERT INTO bots (id, platform, name, enabled, config, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`;
}

export function sqlUpsertAdapter(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO adapters (platform, name, description, enabled, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), enabled=VALUES(enabled), config=VALUES(config), updated_at=VALUES(updated_at)`;
  }
  return `INSERT INTO adapters (platform, name, description, enabled, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(platform) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, config=excluded.config, updated_at=excluded.updated_at`;
}

export function sqlUpsertFlow(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO flows (id, name, description, enabled, event_type, priority, target_kind, llm_agent_id, owner_id, halt_lower_priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), enabled=VALUES(enabled), event_type=VALUES(event_type), priority=VALUES(priority), target_kind=VALUES(target_kind), llm_agent_id=VALUES(llm_agent_id), owner_id=COALESCE(flows.owner_id, VALUES(owner_id)), halt_lower_priority=VALUES(halt_lower_priority), updated_at=VALUES(updated_at)`;
  }
  return `INSERT INTO flows (id, name, description, enabled, event_type, priority, target_kind, llm_agent_id, owner_id, halt_lower_priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, event_type=excluded.event_type, priority=excluded.priority, target_kind=excluded.target_kind, llm_agent_id=excluded.llm_agent_id, owner_id=COALESCE(flows.owner_id, excluded.owner_id), halt_lower_priority=excluded.halt_lower_priority, updated_at=excluded.updated_at`;
}

export function sqlUpsertTrigger(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO triggers (id, name, description, enabled, event_type, match_type, match_pattern, match_ignore_case, 
      permission_allow_roles, permission_allow_environments, permission_allow_groups, permission_allow_users, 
      permission_deny_groups, permission_deny_users, scope_json, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       name=VALUES(name), description=VALUES(description), enabled=VALUES(enabled), 
       event_type=VALUES(event_type), match_type=VALUES(match_type), match_pattern=VALUES(match_pattern), 
       match_ignore_case=VALUES(match_ignore_case), permission_allow_roles=VALUES(permission_allow_roles), 
       permission_allow_environments=VALUES(permission_allow_environments), 
       permission_allow_groups=VALUES(permission_allow_groups), permission_allow_users=VALUES(permission_allow_users),
       permission_deny_groups=VALUES(permission_deny_groups), permission_deny_users=VALUES(permission_deny_users),
       scope_json=VALUES(scope_json),
       owner_id=COALESCE(triggers.owner_id, VALUES(owner_id)),
       updated_at=VALUES(updated_at)`;
  }
  return `INSERT INTO triggers (id, name, description, enabled, event_type, match_type, match_pattern, match_ignore_case, 
      permission_allow_roles, permission_allow_environments, permission_allow_groups, permission_allow_users, 
      permission_deny_groups, permission_deny_users, scope_json, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       name=excluded.name, description=excluded.description, enabled=excluded.enabled, 
       event_type=excluded.event_type, match_type=excluded.match_type, match_pattern=excluded.match_pattern, 
       match_ignore_case=excluded.match_ignore_case, permission_allow_roles=excluded.permission_allow_roles, 
       permission_allow_environments=excluded.permission_allow_environments, 
       permission_allow_groups=excluded.permission_allow_groups, permission_allow_users=excluded.permission_allow_users,
       permission_deny_groups=excluded.permission_deny_groups, permission_deny_users=excluded.permission_deny_users,
       scope_json=excluded.scope_json,
       owner_id=COALESCE(triggers.owner_id, excluded.owner_id),
       updated_at=excluded.updated_at`;
}

export function sqlUpsertJob(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO jobs (id, name, description, enabled, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), enabled=VALUES(enabled), owner_id=COALESCE(jobs.owner_id, VALUES(owner_id)), updated_at=VALUES(updated_at)`;
  }
  return `INSERT INTO jobs (id, name, description, enabled, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, enabled=excluded.enabled, owner_id=COALESCE(jobs.owner_id, excluded.owner_id), updated_at=excluded.updated_at`;
}

export function sqlUpsertLlmAgent(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO llm_agents (id, owner_id, vendor_kind, name, api_base_url, api_key_encrypted, default_model, preset_system_prompt, extra_json, configured_model_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       vendor_kind = VALUES(vendor_kind),
       name = VALUES(name),
       api_base_url = VALUES(api_base_url),
       api_key_encrypted = VALUES(api_key_encrypted),
       default_model = VALUES(default_model),
       preset_system_prompt = VALUES(preset_system_prompt),
       extra_json = VALUES(extra_json),
       configured_model_id = VALUES(configured_model_id),
       updated_at = VALUES(updated_at)`;
  }
  return `INSERT INTO llm_agents (id, owner_id, vendor_kind, name, api_base_url, api_key_encrypted, default_model, preset_system_prompt, extra_json, configured_model_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       vendor_kind = excluded.vendor_kind,
       name = excluded.name,
       api_base_url = excluded.api_base_url,
       api_key_encrypted = excluded.api_key_encrypted,
       default_model = excluded.default_model,
       preset_system_prompt = excluded.preset_system_prompt,
       extra_json = excluded.extra_json,
       configured_model_id = excluded.configured_model_id,
       updated_at = excluded.updated_at`;
}

export function sqlUpsertLlmSkill(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO llm_skills (id, owner_id, name, description, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       content = VALUES(content),
       updated_at = VALUES(updated_at)`;
  }
  return `INSERT INTO llm_skills (id, owner_id, name, description, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       content = excluded.content,
       updated_at = excluded.updated_at`;
}

export function sqlUpsertLlmTool(): string {
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO llm_tools (id, owner_id, name, description, definition_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       definition_json = VALUES(definition_json),
       updated_at = VALUES(updated_at)`;
  }
  return `INSERT INTO llm_tools (id, owner_id, name, description, definition_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       definition_json = excluded.definition_json,
       updated_at = excluded.updated_at`;
}

export function sqlUpsertSystemRole(): string {
  const now = getSqlDialect() === 'mysql' ? 'UTC_TIMESTAMP(3)' : "datetime('now')";
  if (getSqlDialect() === 'mysql') {
    return `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${now}, ${now})
       ON DUPLICATE KEY UPDATE permissions=VALUES(permissions), updated_at=${now}`;
  }
  return `INSERT INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ${now}, ${now})
       ON CONFLICT(id) DO UPDATE SET permissions=excluded.permissions, updated_at=${now}`;
}
