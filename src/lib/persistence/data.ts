import { db } from '@/lib/data-layer';
import {
  sqlUpsertAdapter,
  sqlUpsertBot,
  sqlUpsertFlow,
  sqlUpsertJob,
  sqlUpsertLlmAgent,
  sqlUpsertLlmSkill,
  sqlUpsertLlmTool,
  sqlUpsertSystemRole,
  sqlUpsertTrigger,
} from '@/lib/database/sql-upsert';
import {
  BotConfig,
  AdapterConfig,
  Flow,
  Job,
  Step,
  StepType,
  Trigger,
  LlmAgent,
  LlmSkill,
  LlmTool,
  LlmVendorModel,
  LlmVendorProfile,
  LlmMcpServer,
  ScheduledTask,
  ScheduledTaskRun,
} from '@/types';
import { User, Role } from '@/types/auth';
import { generateId } from '@/lib/shared/utils';
import { verifyPassword } from '@/lib/auth/password-hash';
import { encryptAgentApiKey, decryptAgentApiKey } from '@/lib/crypto/agent-key-crypto';
import { parseVendorProfileExtraJson, type LlmVendorHttpOptions } from '@/llm/vendor-http-options';
import { normalizeTriggerScope } from '@/lib/trigger/trigger-scope';
import type { TriggerScope } from '@/types';
import { getSqlDialect } from '@/lib/database/sql-dialect';
import { PRESET_LIBRARY_OWNER_ID } from '@/lib/preset-library';

// ==================== Bot 操作 ====================
export async function getBots(ownerId?: string): Promise<BotConfig[]> {
  const sql = ownerId 
    ? 'SELECT * FROM bots WHERE owner_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM bots ORDER BY created_at DESC';
  const args = ownerId ? [ownerId] : [];
  const rows = await db.query<any>(sql, args);
  return rows.map(row => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    ownerId: row.owner_id || undefined,
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
    ownerId: row.owner_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBotsByPlatform(platform: string, ownerId?: string): Promise<BotConfig[]> {
  const sql = ownerId
    ? 'SELECT * FROM bots WHERE platform = ? AND owner_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM bots WHERE platform = ? ORDER BY created_at DESC';
  const args = ownerId ? [platform, ownerId] : [platform];
  const rows = await db.query<any>(sql, args);
  return rows.map(row => ({
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config || '{}'),
    ownerId: row.owner_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBot(bot: BotConfig): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(sqlUpsertBot(), [
    bot.id,
    bot.platform,
    bot.name,
    bot.enabled ? 1 : 0,
    JSON.stringify(bot.config),
    bot.ownerId || null,
    now,
    now,
  ]);
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
  await db.execute(sqlUpsertAdapter(), [
    adapter.platform,
    adapter.name,
    adapter.description,
    adapter.enabled ? 1 : 0,
    JSON.stringify(adapter.config),
    now,
    now,
  ]);
}

export async function deleteAdapter(platform: string): Promise<void> {
  await db.execute('DELETE FROM adapters WHERE platform = ?', [platform]);
}

// ==================== Flow 操作 ====================
function mapFlowTargetKind(row: { target_kind?: unknown }): Flow['targetKind'] {
  return String(row.target_kind ?? '') === 'agent' ? 'agent' : 'job';
}

function rowOwnerId(row: { owner_id?: unknown }): string | null {
  if (row.owner_id == null || row.owner_id === '') return null;
  return String(row.owner_id);
}

async function assembleFlow(row: Record<string, unknown>): Promise<Flow> {
  const id = String(row.id);
  const triggers = await db.query<any>('SELECT trigger_id FROM flow_triggers WHERE flow_id = ?', [id]);
  const jobs = await db.query<any>('SELECT job_id FROM flow_jobs WHERE flow_id = ? ORDER BY job_order', [id]);
  const haltRaw = row.halt_lower_priority;
  const haltLowerPriorityAfterMatch =
    haltRaw === 1 || haltRaw === true || haltRaw === '1';
  return {
    id,
    name: row.name as string,
    description: row.description as string | undefined,
    enabled: row.enabled === 1,
    eventType: row.event_type as Flow['eventType'],
    priority: (row.priority as number) || 0,
    triggerIds: triggers.map((t) => t.trigger_id),
    targetKind: mapFlowTargetKind(row),
    llmAgentId:
      row.llm_agent_id != null && row.llm_agent_id !== '' ? String(row.llm_agent_id) : null,
    jobIds: jobs.map((j) => j.job_id),
    haltLowerPriorityAfterMatch,
    ownerId: rowOwnerId(row),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

/** Webhook / 直发通道：Bot 有 ownerId 时只加载「全局 + 该用户」的流程 */
export async function getFlowsForWebhookBot(botOwnerId?: string | null): Promise<Flow[]> {
  const rows = botOwnerId
    ? await db.query<any>(
        'SELECT * FROM flows WHERE owner_id IS NULL OR owner_id = ? ORDER BY created_at DESC',
        [botOwnerId]
      )
    : await db.query<any>('SELECT * FROM flows ORDER BY created_at DESC');
  const flows: Flow[] = [];
  for (const row of rows) {
    flows.push(await assembleFlow(row));
  }
  return flows;
}

/** 控制台：当前用户可见全局 + 自己创建的流程 */
export async function listFlowsForUser(userId: string, eventType?: string | null): Promise<Flow[]> {
  let sql =
    'SELECT * FROM flows WHERE (owner_id IS NULL OR owner_id = ?)';
  const args: unknown[] = [userId];
  if (eventType != null && eventType !== '') {
    sql += ' AND event_type = ?';
    args.push(eventType);
  }
  sql += ' ORDER BY priority DESC';
  const rows = await db.query<any>(sql, args as any[]);
  const flows: Flow[] = [];
  for (const row of rows) {
    flows.push(await assembleFlow(row));
  }
  return flows;
}

export async function getFlowForUser(id: string, userId: string): Promise<Flow | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM flows WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)',
    [id, userId]
  );
  if (!row) return null;
  return assembleFlow(row);
}

export async function saveFlow(flow: Flow): Promise<void> {
  const now = new Date().toISOString();
  const targetKind = flow.targetKind === 'agent' ? 'agent' : 'job';
  const llmAgentId =
    targetKind === 'agent' && flow.llmAgentId != null && String(flow.llmAgentId).trim()
      ? String(flow.llmAgentId).trim()
      : null;
  const jobIdsToPersist = targetKind === 'agent' ? [] : flow.jobIds;
  const ownerId =
    flow.ownerId != null && String(flow.ownerId).trim() ? String(flow.ownerId).trim() : null;

  await db.execute(sqlUpsertFlow(), [
    flow.id,
    flow.name,
    flow.description,
    flow.enabled ? 1 : 0,
    flow.eventType,
    flow.priority,
    targetKind,
    llmAgentId,
    ownerId,
    flow.haltLowerPriorityAfterMatch ? 1 : 0,
    now,
    now,
  ]);
  
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
  for (let i = 0; i < jobIdsToPersist.length; i++) {
    await db.execute(
      'INSERT INTO flow_jobs (flow_id, job_id, job_order) VALUES (?, ?, ?)',
      [flow.id, jobIdsToPersist[i], i]
    );
  }
}

export async function deleteFlowForUser(id: string, userId: string): Promise<void> {
  await db.execute('DELETE FROM flows WHERE id = ? AND owner_id = ?', [id, userId]);
}

// ==================== Trigger 操作 ====================
function mapTriggerRow(row: any): Trigger {
  let scope: TriggerScope | undefined;
  if (row.scope_json && String(row.scope_json).trim()) {
    try {
      scope = normalizeTriggerScope(JSON.parse(String(row.scope_json)) as TriggerScope);
    } catch {
      scope = undefined;
    }
  }
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
      allowRoles: JSON.parse(row.permission_allow_roles || '[]'),
      allowEnvironments: JSON.parse(row.permission_allow_environments || '[]'),
      allowGroups: row.permission_allow_groups ? JSON.parse(row.permission_allow_groups) : undefined,
      allowUsers: row.permission_allow_users ? JSON.parse(row.permission_allow_users) : undefined,
      denyGroups: row.permission_deny_groups ? JSON.parse(row.permission_deny_groups) : undefined,
      denyUsers: row.permission_deny_users ? JSON.parse(row.permission_deny_users) : undefined,
    },
    ...(scope ? { scope } : {}),
    ownerId: rowOwnerId(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTriggersForWebhookBot(botOwnerId?: string | null): Promise<Trigger[]> {
  const rows = botOwnerId
    ? await db.query<any>(
        'SELECT * FROM triggers WHERE owner_id IS NULL OR owner_id = ? ORDER BY created_at DESC',
        [botOwnerId]
      )
    : await db.query<any>('SELECT * FROM triggers ORDER BY created_at DESC');
  return rows.map(mapTriggerRow);
}

export async function listTriggersForUser(userId: string, eventType?: string | null): Promise<Trigger[]> {
  let sql =
    'SELECT * FROM triggers WHERE (owner_id IS NULL OR owner_id = ?)';
  const args: unknown[] = [userId];
  if (eventType != null && eventType !== '') {
    sql += ' AND event_type = ?';
    args.push(eventType);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = await db.query<any>(sql, args as any[]);
  return rows.map(mapTriggerRow);
}

export async function getTriggerForUser(id: string, userId: string): Promise<Trigger | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM triggers WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)',
    [id, userId]
  );
  if (!row) return null;
  return mapTriggerRow(row);
}

export async function saveTrigger(trigger: Trigger): Promise<void> {
  const now = new Date().toISOString();
  const ownerId =
    trigger.ownerId != null && String(trigger.ownerId).trim()
      ? String(trigger.ownerId).trim()
      : null;
  const scopeJsonRaw = normalizeTriggerScope(trigger.scope);
  const scopeJson = scopeJsonRaw ? JSON.stringify(scopeJsonRaw) : null;
  await db.execute(sqlUpsertTrigger(), [
      trigger.id,
      trigger.name,
      trigger.description,
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
      scopeJson,
      ownerId,
      now,
      now,
    ]
  );
}

export async function deleteTriggerForUser(id: string, userId: string): Promise<void> {
  await db.execute('DELETE FROM triggers WHERE id = ? AND owner_id = ?', [id, userId]);
}

// ==================== Job 操作 ====================
async function assembleJob(row: Record<string, unknown>): Promise<Job> {
  const id = String(row.id);
  const steps = await db.query<any>('SELECT * FROM steps WHERE job_id = ? ORDER BY step_order', [id]);
  return {
    id,
    name: row.name as string,
    description: row.description as string | undefined,
    enabled: row.enabled === 1,
    steps: steps.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      description: s.description,
      config: JSON.parse(s.config || '{}'),
      order: s.step_order,
    })),
    ownerId: rowOwnerId(row),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function getJobsForWebhookBot(botOwnerId?: string | null): Promise<Job[]> {
  const rows = botOwnerId
    ? await db.query<any>(
        'SELECT * FROM jobs WHERE owner_id IS NULL OR owner_id = ? OR owner_id = ? ORDER BY created_at DESC',
        [botOwnerId, PRESET_LIBRARY_OWNER_ID]
      )
    : await db.query<any>('SELECT * FROM jobs ORDER BY created_at DESC');
  const jobs: Job[] = [];
  for (const row of rows) {
    jobs.push(await assembleJob(row));
  }
  return jobs;
}

/** Webhook 一次并行加载 flows / jobs / triggers，减少往返 */
export async function getWebhookFlowRuntimeSnapshot(botOwnerId?: string | null): Promise<{
  flows: Flow[];
  jobs: Job[];
  triggers: Trigger[];
}> {
  const [flows, jobs, triggers] = await Promise.all([
    getFlowsForWebhookBot(botOwnerId),
    getJobsForWebhookBot(botOwnerId),
    getTriggersForWebhookBot(botOwnerId),
  ]);
  return { flows, jobs, triggers };
}

export async function listJobsForUser(userId: string): Promise<Job[]> {
  const rows = await db.query<any>(
    'SELECT * FROM jobs WHERE (owner_id IS NULL OR owner_id = ? OR owner_id = ?) ORDER BY created_at DESC',
    [userId, PRESET_LIBRARY_OWNER_ID]
  );
  const jobs: Job[] = [];
  for (const row of rows) {
    jobs.push(await assembleJob(row));
  }
  return jobs;
}

export async function getJobForUser(id: string, userId: string): Promise<Job | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM jobs WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR owner_id = ?)',
    [id, userId, PRESET_LIBRARY_OWNER_ID]
  );
  if (!row) return null;
  return assembleJob(row);
}

export async function saveJob(job: Job): Promise<void> {
  const now = new Date().toISOString();
  const ownerId =
    job.ownerId != null && String(job.ownerId).trim() ? String(job.ownerId).trim() : null;

  await db.execute(sqlUpsertJob(), [job.id, job.name, job.description, job.enabled ? 1 : 0, ownerId, now, now]);
  
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

export async function deleteJobForUser(id: string, userId: string): Promise<void> {
  await db.execute(
    'DELETE FROM jobs WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
    [id, userId, PRESET_LIBRARY_OWNER_ID]
  );
}

// ==================== 定时任务（绑定 Job + Bot + Cron）====================
function rowToScheduledTask(row: Record<string, unknown>): ScheduledTask {
  return {
    id: String(row.id),
    name: row.name as string,
    description: (row.description as string) || undefined,
    enabled: row.enabled === 1,
    ownerId: String(row.owner_id),
    jobId: String(row.job_id),
    botId: String(row.bot_id),
    cronExpr: String(row.cron_expr),
    timezone: (row.timezone as string) || 'UTC',
    lastRunAt: row.last_run_at != null ? Number(row.last_run_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listScheduledTasksForUser(userId: string): Promise<ScheduledTask[]> {
  const rows = await db.query<any>(
    'SELECT * FROM scheduled_tasks WHERE owner_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(rowToScheduledTask);
}

export async function listEnabledScheduledTasks(): Promise<ScheduledTask[]> {
  const rows = await db.query<any>('SELECT * FROM scheduled_tasks WHERE enabled = 1', []);
  return rows.map(rowToScheduledTask);
}

export async function getScheduledTaskForUser(id: string, userId: string): Promise<ScheduledTask | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM scheduled_tasks WHERE id = ? AND owner_id = ?',
    [id, userId],
  );
  if (!row) return null;
  return rowToScheduledTask(row);
}

export async function insertScheduledTask(task: ScheduledTask): Promise<void> {
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO scheduled_tasks (id, name, description, enabled, owner_id, job_id, bot_id, cron_expr, timezone, last_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.name,
        task.description ?? null,
        task.enabled ? 1 : 0,
        task.ownerId,
        task.jobId,
        task.botId,
        task.cronExpr,
        task.timezone,
        task.lastRunAt,
        task.createdAt,
        task.updatedAt,
      ],
    );
    return;
  }
  await db.execute(
    `INSERT INTO scheduled_tasks (id, name, description, enabled, owner_id, job_id, bot_id, cron_expr, timezone, last_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.name,
      task.description ?? null,
      task.enabled ? 1 : 0,
      task.ownerId,
      task.jobId,
      task.botId,
      task.cronExpr,
      task.timezone,
      task.lastRunAt,
      task.createdAt,
      task.updatedAt,
    ],
  );
}

export async function updateScheduledTaskForUser(task: ScheduledTask, userId: string): Promise<boolean> {
  const now = Date.now();
  const r = await db.execute(
    `UPDATE scheduled_tasks SET name = ?, description = ?, enabled = ?, job_id = ?, bot_id = ?, cron_expr = ?, timezone = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
    [
      task.name,
      task.description ?? null,
      task.enabled ? 1 : 0,
      task.jobId,
      task.botId,
      task.cronExpr,
      task.timezone,
      now,
      task.id,
      userId,
    ],
  );
  return (r.changes ?? 0) > 0;
}

export async function deleteScheduledTaskForUser(id: string, userId: string): Promise<void> {
  await db.execute('DELETE FROM scheduled_tasks WHERE id = ? AND owner_id = ?', [id, userId]);
}

/** tick 成功执行后更新；不校验 owner（仅内部路由调用） */
export async function touchScheduledTaskLastRun(id: string, at: number): Promise<void> {
  await db.execute('UPDATE scheduled_tasks SET last_run_at = ?, updated_at = ? WHERE id = ?', [at, at, id]);
}

const SCHED_TASK_RUN_ERR_MAX = 2000;

function rowToScheduledTaskRun(row: Record<string, unknown>): ScheduledTaskRun {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    ownerId: String(row.owner_id),
    traceId: row.trace_id != null ? String(row.trace_id) : undefined,
    startedAt: Number(row.started_at),
    finishedAt: row.finished_at != null ? Number(row.finished_at) : null,
    outcome: row.outcome as ScheduledTaskRun['outcome'],
    errorMessage: row.error_message != null ? String(row.error_message) : undefined,
  };
}

/** Cron tick 开始时插入（outcome=running）；失败应记录日志且不影响执行主流程 */
export async function insertScheduledTaskRun(input: {
  id: string;
  taskId: string;
  ownerId: string;
  traceId: string;
  startedAt: number;
}): Promise<void> {
  await db.execute(
    `INSERT INTO scheduled_task_runs (id, task_id, owner_id, trace_id, started_at, finished_at, outcome, error_message)
     VALUES (?, ?, ?, ?, ?, NULL, 'running', NULL)`,
    [input.id, input.taskId, input.ownerId, input.traceId, input.startedAt],
  );
}

export async function finishScheduledTaskRun(
  id: string,
  end: { finishedAt: number; outcome: 'ok' | 'error'; errorMessage?: string },
): Promise<void> {
  const msg =
    end.outcome === 'error' && end.errorMessage
      ? end.errorMessage.slice(0, SCHED_TASK_RUN_ERR_MAX)
      : null;
  await db.execute(
    `UPDATE scheduled_task_runs SET finished_at = ?, outcome = ?, error_message = ? WHERE id = ?`,
    [end.finishedAt, end.outcome, msg, id],
  );
}

export async function listScheduledTaskRunsForTask(
  taskId: string,
  userId: string,
  limit: number,
): Promise<ScheduledTaskRun[]> {
  const lim = Math.min(Math.max(1, limit), 100);
  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM scheduled_task_runs WHERE task_id = ? AND owner_id = ? ORDER BY started_at DESC LIMIT ?`,
    [taskId, userId, lim],
  );
  return rows.map(rowToScheduledTaskRun);
}

// ==================== User 操作 ====================

function mapUserRow(row: Record<string, unknown>, roleIds: string[]): User {
  return {
    id: String(row.id),
    username: row.username != null && String(row.username) !== '' ? String(row.username) : undefined,
    email: row.email != null && String(row.email) !== '' ? String(row.email) : undefined,
    name: String(row.name),
    image: row.image != null && String(row.image) !== '' ? String(row.image) : undefined,
    githubId: row.github_id != null && String(row.github_id) !== '' ? String(row.github_id) : undefined,
    isActive: row.is_active === 1,
    emailVerified: row.email_verified != null ? String(row.email_verified) : undefined,
    roleIds,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastLoginAt: row.last_login_at != null ? String(row.last_login_at) : undefined,
    onboardingCompletedAt:
      row.onboarding_completed_at != null ? Number(row.onboarding_completed_at) : null,
    onboardingSectionsJson:
      row.onboarding_sections_json != null ? String(row.onboarding_sections_json) : null,
  };
}

export async function countUsers(): Promise<number> {
  const row = await db.queryOne<{ c: number | bigint }>(
    'SELECT COUNT(*) as c FROM users',
    [],
  );
  return Number(row?.c ?? 0);
}

export async function getUsers(): Promise<User[]> {
  const rows = await db.query<any>('SELECT * FROM users ORDER BY created_at DESC');
  const users: User[] = [];

  for (const row of rows) {
    const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);
    users.push(mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id)));
  }

  return users;
}

export async function getUser(id: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!row) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [id]);

  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE email = ?', [email]);
  if (!row) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);

  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const row = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [
    username.trim().toLowerCase(),
  ]);
  if (!row) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);

  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

/** 邮箱或用户名（均按小写匹配） */
export async function getUserByIdentifier(identifier: string): Promise<User | null> {
  const norm = identifier.trim().toLowerCase();
  if (!norm) return null;
  const row = await db.queryOne<any>(
    `SELECT * FROM users WHERE (email IS NOT NULL AND lower(email) = ?) OR (username IS NOT NULL AND lower(username) = ?)`,
    [norm, norm],
  );
  if (!row) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);

  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

export async function authenticateLocalCredentials(
  identifier: string,
  password: string,
): Promise<User | null> {
  const norm = identifier.trim().toLowerCase();
  if (!norm || !password) return null;
  const row = await db.queryOne<any>(
    `SELECT * FROM users WHERE (email IS NOT NULL AND lower(email) = ?) OR (username IS NOT NULL AND lower(username) = ?)`,
    [norm, norm],
  );
  if (!row || row.is_active !== 1) return null;
  const hash = row.password_hash as string | null | undefined;
  if (!hash) return null;
  const ok = await verifyPassword(password, hash);
  if (!ok) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);
  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

export async function getUserByGithubId(githubId: string): Promise<User | null> {
  let row = await db.queryOne<any>(
    `SELECT u.* FROM users u
     INNER JOIN oauth_accounts o ON o.user_id = u.id
     WHERE o.provider = 'github' AND o.provider_account_id = ?`,
    [githubId],
  );
  if (!row) {
    row = await db.queryOne<any>('SELECT * FROM users WHERE github_id = ?', [githubId]);
  }
  if (!row) return null;

  const roles = await db.query<any>('SELECT role_id FROM user_roles WHERE user_id = ?', [row.id]);

  return mapUserRow(row, roles.map((r: { role_id: string }) => r.role_id));
}

export type OAuthAccountRow = {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  email?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export async function getOAuthAccount(
  provider: string,
  providerAccountId: string,
): Promise<OAuthAccountRow | null> {
  const row = await db.queryOne<{
    id: string;
    user_id: string;
    provider: string;
    provider_account_id: string;
    email: string | null;
    metadata: string | null;
    created_at: string;
  }>(
    'SELECT * FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?',
    [provider, providerAccountId],
  );
  if (!row) return null;
  let metadata: Record<string, unknown> | undefined;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = undefined;
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email ?? undefined,
    metadata,
    createdAt: row.created_at,
  };
}

export async function listOAuthAccountsForUser(userId: string): Promise<OAuthAccountRow[]> {
  const rows = await db.query<{
    id: string;
    user_id: string;
    provider: string;
    provider_account_id: string;
    email: string | null;
    metadata: string | null;
    created_at: string;
  }>('SELECT * FROM oauth_accounts WHERE user_id = ? ORDER BY created_at', [userId]);
  return rows.map((row) => {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = undefined;
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      providerAccountId: row.provider_account_id,
      email: row.email ?? undefined,
      metadata,
      createdAt: row.created_at,
    };
  });
}

export async function linkOAuthAccount(params: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email?: string;
  metadata?: Record<string, unknown>;
}): Promise<OAuthAccountRow> {
  const id = generateId();
  const now = new Date().toISOString();
  const metaJson = params.metadata ? JSON.stringify(params.metadata) : null;
  await db.execute(
    `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.provider,
      params.providerAccountId,
      params.email ?? null,
      metaJson,
      now,
    ],
  );
  if (params.provider === 'github') {
    await db.execute('UPDATE users SET github_id = ?, updated_at = ? WHERE id = ?', [
      params.providerAccountId,
      now,
      params.userId,
    ]);
  }
  const acc = await getOAuthAccount(params.provider, params.providerAccountId);
  if (!acc) throw new Error('linkOAuthAccount: insert failed');
  return acc;
}

export async function unlinkOAuthAccount(accountId: string, userId: string): Promise<boolean> {
  const row = await db.queryOne<{ provider: string }>(
    'SELECT provider FROM oauth_accounts WHERE id = ? AND user_id = ?',
    [accountId, userId],
  );
  if (!row) return false;
  await db.execute('DELETE FROM oauth_accounts WHERE id = ? AND user_id = ?', [accountId, userId]);
  if (row.provider === 'github') {
    const now = new Date().toISOString();
    await db.execute('UPDATE users SET github_id = NULL, updated_at = ? WHERE id = ?', [
      now,
      userId,
    ]);
  }
  return true;
}

export async function createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const userId = generateId();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO users (id, email, name, image, github_id, username, password_hash, is_active, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      userData.email ?? null,
      userData.name,
      userData.image || null,
      userData.githubId || null,
      userData.username ?? null,
      userData.passwordHash ?? null,
      userData.isActive ? 1 : 0,
      userData.emailVerified ?? null,
      now,
      now,
    ],
  );

  for (const roleId of userData.roleIds || []) {
    await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
  }

  if (userData.githubId) {
    const existingGh = await getOAuthAccount('github', userData.githubId);
    if (!existingGh) {
      await linkOAuthAccount({
        userId,
        provider: 'github',
        providerAccountId: userData.githubId,
        email: userData.email,
      });
    }
  }

  const created = await getUser(userId);
  if (!created) throw new Error('createUser: failed to read back');
  return created;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  
  if ('name' in updates) { fields.push('name = ?'); values.push(updates.name); }
  if ('email' in updates) { fields.push('email = ?'); values.push(updates.email); }
  if ('username' in updates) { fields.push('username = ?'); values.push(updates.username ?? null); }
  if ('image' in updates) { fields.push('image = ?'); values.push(updates.image); }
  if ('githubId' in updates) { fields.push('github_id = ?'); values.push(updates.githubId); }
  if ('passwordHash' in updates) {
    fields.push('password_hash = ?');
    values.push(updates.passwordHash ?? null);
  }
  if ('isActive' in updates) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if ('lastLoginAt' in updates) { fields.push('last_login_at = ?'); values.push(updates.lastLoginAt ? new Date(updates.lastLoginAt).toISOString() : null); }
  if ('onboardingCompletedAt' in updates) {
    fields.push('onboarding_completed_at = ?');
    values.push(
      updates.onboardingCompletedAt != null ? Number(updates.onboardingCompletedAt) : null,
    );
  }
  if ('onboardingSectionsJson' in updates) {
    fields.push('onboarding_sections_json = ?');
    values.push(updates.onboardingSectionsJson ?? null);
  }

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

// ==================== LLM Agent ====================

export type SkillInjectMode = 'none' | 'summary' | 'full';

export interface LlmAgentRuntimeConfig {
  vendorKind: string;
  apiBaseUrl: string;
  apiKey: string;
  defaultModel: string;
  /** 来自厂商 Profile extra_json.http */
  vendorHttp?: LlmVendorHttpOptions;
  presetSystemPrompt?: string;
  skillsJson?: string | null;
  toolsJson?: string | null;
  /** OpenAI function.name → 实现该工具的 Job（步骤流水线）id */
  /** OpenAI function.name → 该工具自带的步骤（按 order 执行） */
  toolImplementationStepsByFunctionName?: Record<string, Step[]>;
  /** OpenAI function.name → MCP 服务与原始工具名 */
  mcpToolRouter?: Record<string, { serverId: string; toolName: string }>;
  extra: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
    skillInject?: SkillInjectMode;
    /** Agent extra_json.maxToolRounds；工具调用轮次上限，与 LLM_AGENT_MAX_TOOL_ROUNDS 联用 */
    maxToolRounds?: number;
  };
}

function parseSkillInjectFromExtra(extra: Record<string, unknown>): SkillInjectMode {
  const v = extra.skillInject;
  if (v === 'none' || v === 'summary' || v === 'full') return v;
  return 'full';
}

function resolveSkillInjectMode(
  extra: Record<string, unknown>,
  override?: SkillInjectMode
): SkillInjectMode {
  return override ?? parseSkillInjectFromExtra(extra);
}

function mapLlmAgentRowPublic(row: Record<string, unknown>): LlmAgent {
  const enc = row.api_key_encrypted as string;
  const cfg = row.configured_model_id;
  const configuredModelId =
    cfg != null && String(cfg).trim() !== '' ? String(cfg) : null;
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    vendorKind: row.vendor_kind as string,
    name: row.name as string,
    apiBaseUrl: row.api_base_url as string,
    defaultModel: row.default_model as string,
    configuredModelId,
    presetSystemPrompt: (row.preset_system_prompt as string) || undefined,
    extraJson: (row.extra_json as string) || null,
    skillIds: [],
    toolIds: [],
    mcpServerIds: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasApiKey: !!(enc && enc.length > 0) || !!configuredModelId,
  };
}

async function attachConfiguredModelSummaries(
  agents: LlmAgent[],
  ownerId: string
): Promise<LlmAgent[]> {
  const ids = agents
    .map((a) => a.configuredModelId)
    .filter((x): x is string => !!x);
  if (ids.length === 0) return agents;
  try {
    const ph = ids.map(() => '?').join(',');
    const rows = await db.query<{
      mid: string;
      model_id: string;
      display_name: string | null;
      profile_name: string;
    }>(
      `SELECT m.id AS mid, m.model_id, m.display_name, p.name AS profile_name
       FROM llm_vendor_models m
       JOIN llm_vendor_profiles p ON p.id = m.profile_id
       WHERE m.id IN (${ph}) AND m.owner_id = ?`,
      [...ids, ownerId]
    );
    const map = new Map<string, string>();
    for (const r of rows) {
      const label = r.display_name?.trim() || r.model_id;
      map.set(r.mid, `${r.profile_name} / ${label}`);
    }
    return agents.map((a) => {
      if (!a.configuredModelId) return a;
      const s = map.get(a.configuredModelId);
      return s
        ? { ...a, configuredModelSummary: s }
        : { ...a, configuredModelSummary: '(模型已删除)' };
    });
  } catch {
    return agents;
  }
}

/** 解析 Agent 引用的「预置模型」：密钥以 Profile 为准，修改 Profile 后 Agent 无需重配 */
async function getConfiguredModelRuntimeSource(
  configuredModelId: string,
  ownerId: string
): Promise<{
  vendorKind: string;
  apiBaseUrl: string;
  apiKeyEncrypted: string;
  modelId: string;
  modelExtra: Record<string, unknown>;
  profileExtraJson: string | null;
} | null> {
  try {
    const row = await db.queryOne<Record<string, unknown>>(
      `SELECT m.model_id AS model_id, m.extra_json AS model_extra_json,
              p.vendor_kind, p.api_base_url, p.api_key_encrypted, p.extra_json AS profile_extra_json
       FROM llm_vendor_models m
       JOIN llm_vendor_profiles p ON p.id = m.profile_id
       WHERE m.id = ? AND m.owner_id = ? AND p.owner_id = ?`,
      [configuredModelId, ownerId, ownerId]
    );
    if (!row) return null;
    let modelExtra: Record<string, unknown> = {};
    if (row.model_extra_json) {
      try {
        modelExtra = JSON.parse(String(row.model_extra_json)) as Record<string, unknown>;
      } catch {
        modelExtra = {};
      }
    }
    const pex = row.profile_extra_json;
    return {
      vendorKind: String(row.vendor_kind),
      apiBaseUrl: String(row.api_base_url),
      apiKeyEncrypted: String(row.api_key_encrypted),
      modelId: String(row.model_id),
      modelExtra,
      profileExtraJson: pex != null && String(pex).trim() !== '' ? String(pex) : null,
    };
  } catch {
    return null;
  }
}

async function attachAgentLinks(agents: LlmAgent[]): Promise<LlmAgent[]> {
  if (agents.length === 0) return agents;
  const ids = agents.map((a) => a.id);
  const ph = ids.map(() => '?').join(',');
  const sRows = await db.query<{ agent_id: string; skill_id: string }>(
    `SELECT agent_id, skill_id FROM llm_agent_skills WHERE agent_id IN (${ph})`,
    ids
  );
  const tRows = await db.query<{ agent_id: string; tool_id: string }>(
    `SELECT agent_id, tool_id FROM llm_agent_tools WHERE agent_id IN (${ph})`,
    ids
  );
  let mRows: { agent_id: string; mcp_server_id: string }[] = [];
  try {
    mRows = await db.query<{ agent_id: string; mcp_server_id: string }>(
      `SELECT agent_id, mcp_server_id FROM llm_agent_mcp WHERE agent_id IN (${ph})`,
      ids
    );
  } catch {
    mRows = [];
  }
  const sm = new Map<string, string[]>();
  const tm = new Map<string, string[]>();
  const mm = new Map<string, string[]>();
  for (const r of sRows) {
    if (!sm.has(r.agent_id)) sm.set(r.agent_id, []);
    sm.get(r.agent_id)!.push(r.skill_id);
  }
  for (const r of tRows) {
    if (!tm.has(r.agent_id)) tm.set(r.agent_id, []);
    tm.get(r.agent_id)!.push(r.tool_id);
  }
  for (const r of mRows) {
    if (!mm.has(r.agent_id)) mm.set(r.agent_id, []);
    mm.get(r.agent_id)!.push(r.mcp_server_id);
  }
  return agents.map((a) => ({
    ...a,
    skillIds: sm.get(a.id) || [],
    toolIds: tm.get(a.id) || [],
    mcpServerIds: mm.get(a.id) || [],
  }));
}

export async function getLlmAgentsByOwner(ownerId: string): Promise<LlmAgent[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM llm_agents WHERE owner_id = ? ORDER BY updated_at DESC',
    [ownerId]
  );
  const withLinks = await attachAgentLinks(rows.map(mapLlmAgentRowPublic));
  return attachConfiguredModelSummaries(withLinks, ownerId);
}

export async function getLlmAgentForOwner(id: string, ownerId: string): Promise<LlmAgent | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM llm_agents WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (!row) return null;
  const [withLinks] = await attachAgentLinks([mapLlmAgentRowPublic(row)]);
  const [withSummary] = await attachConfiguredModelSummaries([withLinks], ownerId);
  return withSummary;
}

export interface GetLlmAgentRuntimeOptions {
  /** 覆盖 Agent extra 中的 skillInject */
  skillInject?: SkillInjectMode;
  /** 本回合额外加载正文（须为该 Agent 已关联的技能 id）；与 skillInject 组合：none 时仅这些条会注入正文 */
  loadSkillIdsFull?: string[];
}

export async function getLlmAgentRuntime(
  agentId: string,
  ownerId: string,
  options?: GetLlmAgentRuntimeOptions
): Promise<LlmAgentRuntimeConfig | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM llm_agents WHERE id = ? AND owner_id = ?',
    [agentId, ownerId]
  );
  if (!row) return null;

  const configuredRaw = row.configured_model_id;
  const configuredId =
    configuredRaw != null && String(configuredRaw).trim() !== ''
      ? String(configuredRaw)
      : null;

  let vendorKind: string;
  let apiBaseUrl: string;
  let apiKey: string;
  let defaultModel: string;
  let modelExtra: Record<string, unknown> = {};

  if (!configuredId) {
    return null;
  }
  const src = await getConfiguredModelRuntimeSource(configuredId, ownerId);
  if (!src) return null;
  vendorKind = src.vendorKind;
  apiBaseUrl = src.apiBaseUrl;
  apiKey = decryptAgentApiKey(src.apiKeyEncrypted);
  defaultModel = src.modelId;
  modelExtra = src.modelExtra;
  const vendorHttp = parseVendorProfileExtraJson(src.profileExtraJson);

  let extra: Record<string, unknown> = { ...modelExtra };
  if (row.extra_json) {
    try {
      const agentExtra = JSON.parse(String(row.extra_json)) as Record<string, unknown>;
      extra = { ...extra, ...agentExtra };
    } catch {
      /* keep modelExtra only */
    }
  }

  const injectMode = resolveSkillInjectMode(extra, options?.skillInject);
  const loadFullSet = new Set((options?.loadSkillIdsFull || []).map(String));

  const skillLinkRows = await db.query<{ skill_id: string }>(
    'SELECT skill_id FROM llm_agent_skills WHERE agent_id = ?',
    [agentId]
  );
  const summaryParts: string[] = [];
  const fullParts: string[] = [];
  for (const { skill_id } of skillLinkRows) {
    const sk = await db.queryOne<Record<string, unknown>>(
      'SELECT name, content, description FROM llm_skills WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
      [skill_id, ownerId, PRESET_LIBRARY_OWNER_ID]
    );
    if (!sk) continue;
    const name = String(sk.name);
    const content = String(sk.content ?? '');
    const desc = sk.description != null ? String(sk.description) : '';

    if (injectMode === 'full') {
      fullParts.push(`### ${name}\n${content}`);
    } else if (injectMode === 'summary') {
      summaryParts.push(
        `- **${name}**（id: \`${skill_id}\`）${desc ? `：${desc}` : ''}`
      );
      if (loadFullSet.has(skill_id)) {
        fullParts.push(`### ${name}（本回合全文）\n${content}`);
      }
    } else {
      if (loadFullSet.has(skill_id)) {
        fullParts.push(`### ${name}\n${content}`);
      }
    }
  }

  const linkedSections: string[] = [];
  if (summaryParts.length > 0) {
    linkedSections.push(
      `## 可用技能目录（正文默认不加载；可用流程步骤「本回合加载正文」指定 id）\n${summaryParts.join('\n')}`
    );
  }
  if (fullParts.length > 0) {
    linkedSections.push(`## 技能正文\n${fullParts.join('\n\n')}`);
  }
  const linkedSkillsBlock = linkedSections.length > 0 ? linkedSections.join('\n\n') : '';
  const combinedSkills = linkedSkillsBlock.trim() ? linkedSkillsBlock : null;

  const toolLinkRows = await db.query<{ tool_id: string }>(
    'SELECT tool_id FROM llm_agent_tools WHERE agent_id = ?',
    [agentId]
  );
  const toolObjs: unknown[] = [];
  const toolImplementationStepsByFunctionName: Record<string, Step[]> = {};
  for (const { tool_id } of toolLinkRows) {
    const tk = await db.queryOne<Record<string, unknown>>(
      'SELECT definition_json FROM llm_tools WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
      [tool_id, ownerId, PRESET_LIBRARY_OWNER_ID]
    );
    if (tk?.definition_json) {
      try {
        const def = JSON.parse(String(tk.definition_json)) as {
          type?: string;
          function?: { name?: string };
        };
        toolObjs.push(def);
        const fname = def?.function?.name;
        const steps = await loadLlmToolStepsForTool(tool_id);
        if (fname && steps.length > 0) {
          toolImplementationStepsByFunctionName[fname] = steps;
        }
      } catch {
        /* skip invalid */
      }
    }
  }

  const usedToolNames = new Set<string>();
  for (const o of toolObjs) {
    const fn = (o as { function?: { name?: string } })?.function?.name;
    if (fn) usedToolNames.add(fn);
  }

  let mcpToolRouter: Record<string, { serverId: string; toolName: string }> = {};
  let mcpLinkRows: { mcp_server_id: string }[] = [];
  try {
    mcpLinkRows = await db.query<{ mcp_server_id: string }>(
      'SELECT mcp_server_id FROM llm_agent_mcp WHERE agent_id = ?',
      [agentId]
    );
  } catch {
    mcpLinkRows = [];
  }
  if (mcpLinkRows.length > 0) {
    try {
      const { listMcpToolsOpenAiStyle } = await import('@/lib/mcp/client-runtime');
      for (const { mcp_server_id } of mcpLinkRows) {
        const srv = await db.queryOne<Record<string, unknown>>(
          'SELECT id, url, transport, headers_json FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
          [mcp_server_id, ownerId]
        );
        if (!srv) continue;
        try {
          const { tools, router } = await listMcpToolsOpenAiStyle({
            id: String(srv.id),
            url: String(srv.url),
            transport: String(srv.transport ?? 'streamable_http'),
            headersJson: srv.headers_json != null ? String(srv.headers_json) : null,
          });
          for (const t of tools) {
            const fn = (t as { function?: { name?: string } })?.function?.name;
            if (fn && usedToolNames.has(fn)) {
              console.warn('[LLM Agent] Skip MCP tool, name collision with existing tool:', fn);
              delete router[fn];
              continue;
            }
            if (fn) usedToolNames.add(fn);
            toolObjs.push(t);
          }
          mcpToolRouter = { ...mcpToolRouter, ...router };
        } catch (e) {
          console.warn('[LLM Agent] MCP listTools failed for server', mcp_server_id, e);
        }
      }
    } catch (e) {
      console.warn('[LLM Agent] MCP client load failed', e);
    }
  }

  const toolsJsonOut = toolObjs.length > 0 ? JSON.stringify(toolObjs) : null;

  return {
    vendorKind,
    apiBaseUrl,
    apiKey,
    defaultModel,
    vendorHttp,
    presetSystemPrompt: row.preset_system_prompt ? String(row.preset_system_prompt) : undefined,
    skillsJson: combinedSkills,
    toolsJson: toolsJsonOut,
    toolImplementationStepsByFunctionName:
      Object.keys(toolImplementationStepsByFunctionName).length > 0
        ? toolImplementationStepsByFunctionName
        : undefined,
    mcpToolRouter: Object.keys(mcpToolRouter).length > 0 ? mcpToolRouter : undefined,
    extra: {
      temperature: typeof extra.temperature === 'number' ? extra.temperature : undefined,
      maxTokens: typeof extra.maxTokens === 'number' ? extra.maxTokens : undefined,
      jsonMode: Boolean(extra.jsonMode),
      timeoutMs: typeof extra.timeoutMs === 'number' ? extra.timeoutMs : undefined,
      skillInject: injectMode,
      maxToolRounds:
        typeof extra.maxToolRounds === 'number' && extra.maxToolRounds > 0
          ? Math.floor(extra.maxToolRounds)
          : undefined,
    },
  };
}

export interface SaveLlmAgentInput {
  id?: string;
  name: string;
  /** 必选：引用「模型连接」中的预置模型；运行时从 Profile 读密钥与 Base URL */
  configuredModelId?: string | null;
  presetSystemPrompt?: string;
  extraJson?: string | null;
  /** 传数组则替换关联；不传则保持原有关联 */
  skillIds?: string[];
  toolIds?: string[];
  mcpServerIds?: string[];
}

export async function saveLlmAgent(ownerId: string, input: SaveLlmAgentInput): Promise<LlmAgent> {
  const id =
    input.id ||
    `llm_agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{
    api_key_encrypted: string;
    configured_model_id: string | null;
  }>('SELECT api_key_encrypted, configured_model_id FROM llm_agents WHERE id = ? AND owner_id = ?', [
    id,
    ownerId,
  ]);
  if (input.id && !existing) {
    throw new Error('Agent not found or access denied');
  }

  let nextConfigured: string | null;
  if ('configuredModelId' in input) {
    const v = input.configuredModelId;
    nextConfigured = v == null || String(v).trim() === '' ? null : String(v).trim();
  } else {
    nextConfigured =
      existing?.configured_model_id != null && String(existing.configured_model_id).trim() !== ''
        ? String(existing.configured_model_id).trim()
        : null;
  }

  if (!nextConfigured) {
    throw new Error('须选择预置模型（在「模型连接」中添加厂商与模型）');
  }

  const src = await getConfiguredModelRuntimeSource(nextConfigured, ownerId);
  if (!src) throw new Error('预置模型无效或无权访问');
  const vendorKind = src.vendorKind;
  const apiBaseUrl = src.apiBaseUrl.replace(/\/+$/, '');
  const defaultModel = src.modelId;
  const enc = src.apiKeyEncrypted;

  const now = new Date().toISOString();
  await db.execute(sqlUpsertLlmAgent(), [
    id,
    ownerId,
    vendorKind,
    input.name,
    apiBaseUrl,
    enc,
    defaultModel,
    input.presetSystemPrompt ?? null,
    input.extraJson ?? null,
    nextConfigured,
    now,
    now,
  ]);

  if (input.skillIds !== undefined) {
    await db.execute('DELETE FROM llm_agent_skills WHERE agent_id = ?', [id]);
    for (const sid of input.skillIds) {
      const ok = await db.queryOne<{ id: string }>(
        'SELECT id FROM llm_skills WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
        [sid, ownerId, PRESET_LIBRARY_OWNER_ID]
      );
      if (!ok) throw new Error(`Skill not found or access denied: ${sid}`);
      await db.execute('INSERT INTO llm_agent_skills (agent_id, skill_id) VALUES (?, ?)', [id, sid]);
    }
  }

  if (input.toolIds !== undefined) {
    await db.execute('DELETE FROM llm_agent_tools WHERE agent_id = ?', [id]);
    for (const tid of input.toolIds) {
      const ok = await db.queryOne<{ id: string }>(
        'SELECT id FROM llm_tools WHERE id = ? AND owner_id = ?',
        [tid, ownerId]
      );
      if (!ok) throw new Error(`Tool not found or access denied: ${tid}`);
      await db.execute('INSERT INTO llm_agent_tools (agent_id, tool_id) VALUES (?, ?)', [id, tid]);
    }
  }

  if (input.mcpServerIds !== undefined) {
    await db.execute('DELETE FROM llm_agent_mcp WHERE agent_id = ?', [id]);
    for (const mid of input.mcpServerIds) {
      const ok = await db.queryOne<{ id: string }>(
        'SELECT id FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
        [mid, ownerId]
      );
      if (!ok) throw new Error(`MCP server not found or access denied: ${mid}`);
      await db.execute(
        'INSERT INTO llm_agent_mcp (agent_id, mcp_server_id) VALUES (?, ?)',
        [id, mid]
      );
    }
  }

  const saved = await getLlmAgentForOwner(id, ownerId);
  if (!saved) throw new Error('Failed to persist LLM agent');
  return saved;
}

export async function deleteLlmAgent(id: string, ownerId: string): Promise<boolean> {
  await db.execute('DELETE FROM llm_agent_skills WHERE agent_id = ?', [id]);
  await db.execute('DELETE FROM llm_agent_tools WHERE agent_id = ?', [id]);
  try {
    await db.execute('DELETE FROM llm_agent_mcp WHERE agent_id = ?', [id]);
  } catch {
    /* 表未迁移 */
  }
  const r = await db.execute('DELETE FROM llm_agents WHERE id = ? AND owner_id = ?', [id, ownerId]);
  return (r.changes ?? 0) > 0;
}

// ==================== LLM MCP 服务 ====================

function mapMcpServerRow(row: Record<string, unknown>): LlmMcpServer {
  const hj = row.headers_json as string | null;
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    url: row.url as string,
    transport: (row.transport as string) || 'streamable_http',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasHeaders: !!(hj && hj.trim().length > 0),
  };
}

export async function getLlmMcpServersByOwner(ownerId: string): Promise<LlmMcpServer[]> {
  try {
    const rows = await db.query<Record<string, unknown>>(
      'SELECT * FROM llm_mcp_servers WHERE owner_id = ? ORDER BY updated_at DESC',
      [ownerId]
    );
    return rows.map(mapMcpServerRow);
  } catch {
    return [];
  }
}

export async function getLlmMcpServerForOwner(
  id: string,
  ownerId: string
): Promise<LlmMcpServer | null> {
  try {
    const row = await db.queryOne<Record<string, unknown>>(
      'SELECT * FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );
    return row ? mapMcpServerRow(row) : null;
  } catch {
    return null;
  }
}

/** 详情/编辑用：含请求头 JSON（仅 owner 拉取） */
export async function getLlmMcpServerWithHeadersForOwner(
  id: string,
  ownerId: string
): Promise<(LlmMcpServer & { headersJson: string | null }) | null> {
  const base = await getLlmMcpServerForOwner(id, ownerId);
  if (!base) return null;
  try {
    const row = await db.queryOne<{ headers_json: string | null }>(
      'SELECT headers_json FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );
    return {
      ...base,
      headersJson: row?.headers_json != null ? String(row.headers_json) : null,
    };
  } catch {
    return { ...base, headersJson: null };
  }
}

/** 运行时调用 MCP（含 headers）；仅服务端使用 */
export async function getLlmMcpServerRuntimeForOwner(
  id: string,
  ownerId: string
): Promise<{
  id: string;
  url: string;
  transport: string;
  headersJson: string | null;
} | null> {
  try {
    const row = await db.queryOne<Record<string, unknown>>(
      'SELECT id, url, transport, headers_json FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );
    if (!row) return null;
    return {
      id: String(row.id),
      url: String(row.url),
      transport: String(row.transport ?? 'streamable_http'),
      headersJson: row.headers_json != null ? String(row.headers_json) : null,
    };
  } catch {
    return null;
  }
}

export interface SaveLlmMcpServerInput {
  id?: string;
  name: string;
  url: string;
  transport?: string;
  headersJson?: string | null;
}

export async function saveLlmMcpServer(ownerId: string, input: SaveLlmMcpServerInput): Promise<LlmMcpServer> {
  const id =
    input.id ||
    `llm_mcp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (input.id && !existing) {
    throw new Error('MCP server not found or access denied');
  }
  let headersOut: string | null;
  if (existing && input.headersJson === undefined) {
    const h = await db.queryOne<{ headers_json: string | null }>(
      'SELECT headers_json FROM llm_mcp_servers WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );
    headersOut = h?.headers_json ?? null;
  } else {
    headersOut = input.headersJson ?? null;
  }
  const now = new Date().toISOString();
  const transport = input.transport?.trim() || 'streamable_http';
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO llm_mcp_servers (id, owner_id, name, url, transport, headers_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), url=VALUES(url), transport=VALUES(transport), headers_json=VALUES(headers_json), updated_at=VALUES(updated_at)`,
      [
        id,
        ownerId,
        input.name,
        input.url.replace(/\/+$/, ''),
        transport,
        headersOut,
        now,
        now,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO llm_mcp_servers (id, owner_id, name, url, transport, headers_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, transport=excluded.transport, headers_json=excluded.headers_json, updated_at=excluded.updated_at`,
      [
        id,
        ownerId,
        input.name,
        input.url.replace(/\/+$/, ''),
        transport,
        headersOut,
        now,
        now,
      ]
    );
  }
  const saved = await getLlmMcpServerForOwner(id, ownerId);
  if (!saved) throw new Error('Failed to persist MCP server');
  return saved;
}

export async function deleteLlmMcpServer(id: string, ownerId: string): Promise<boolean> {
  const r = await db.execute('DELETE FROM llm_mcp_servers WHERE id = ? AND owner_id = ?', [id, ownerId]);
  return (r.changes ?? 0) > 0;
}

// ==================== LLM 厂商连接 / 预置模型 ====================

function mapVendorProfileRowPublic(row: Record<string, unknown>): LlmVendorProfile {
  const enc = row.api_key_encrypted as string;
  const ex = row.extra_json;
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    vendorKind: row.vendor_kind as string,
    name: row.name as string,
    apiBaseUrl: row.api_base_url as string,
    extraJson: ex != null && String(ex).trim() !== '' ? String(ex) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    hasApiKey: !!(enc && enc.length > 0),
  };
}

function mapVendorModelRow(row: Record<string, unknown>): LlmVendorModel {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    profileId: row.profile_id as string,
    modelId: row.model_id as string,
    displayName: row.display_name != null ? String(row.display_name) : undefined,
    extraJson: row.extra_json != null ? String(row.extra_json) : null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    profileName: row.profile_name != null ? String(row.profile_name) : undefined,
    vendorKind: row.vendor_kind != null ? String(row.vendor_kind) : undefined,
  };
}

export async function getLlmVendorProfilesByOwner(ownerId: string): Promise<LlmVendorProfile[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM llm_vendor_profiles WHERE owner_id = ? ORDER BY updated_at DESC',
    [ownerId]
  );
  return rows.map(mapVendorProfileRowPublic);
}

export async function getLlmVendorProfileForOwner(
  id: string,
  ownerId: string
): Promise<LlmVendorProfile | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM llm_vendor_profiles WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  return row ? mapVendorProfileRowPublic(row) : null;
}

export interface SaveLlmVendorProfileInput {
  id?: string;
  vendorKind: string;
  name: string;
  apiBaseUrl: string;
  apiKey?: string;
  /** JSON 字符串；含 http 块时可定制请求 */
  extraJson?: string | null;
}

export async function saveLlmVendorProfile(
  ownerId: string,
  input: SaveLlmVendorProfileInput
): Promise<LlmVendorProfile> {
  const id =
    input.id ||
    `llm_vprof_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{ api_key_encrypted: string; extra_json: string | null }>(
    'SELECT api_key_encrypted, extra_json FROM llm_vendor_profiles WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (input.id && !existing) {
    throw new Error('Profile not found or access denied');
  }
  let enc: string;
  if (input.apiKey !== undefined && input.apiKey.length > 0) {
    enc = encryptAgentApiKey(input.apiKey);
  } else if (existing) {
    enc = existing.api_key_encrypted;
  } else {
    throw new Error('新建厂商连接须填写 API Key');
  }
  let nextExtraJson: string | null;
  if (input.extraJson !== undefined) {
    const s = input.extraJson === null ? '' : String(input.extraJson).trim();
    if (s) {
      try {
        JSON.parse(s);
      } catch {
        throw new Error('厂商 extra_json 须为合法 JSON');
      }
      nextExtraJson = s;
    } else {
      nextExtraJson = null;
    }
  } else if (existing?.extra_json != null && String(existing.extra_json).trim() !== '') {
    nextExtraJson = String(existing.extra_json);
  } else {
    nextExtraJson = null;
  }
  const baseUrl = input.apiBaseUrl.replace(/\/+$/, '');
  const now = new Date().toISOString();
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO llm_vendor_profiles (id, owner_id, vendor_kind, name, api_base_url, api_key_encrypted, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vendor_kind=VALUES(vendor_kind), name=VALUES(name), api_base_url=VALUES(api_base_url), api_key_encrypted=VALUES(api_key_encrypted), extra_json=VALUES(extra_json), updated_at=VALUES(updated_at)`,
      [id, ownerId, input.vendorKind, input.name, baseUrl, enc, nextExtraJson, now, now]
    );
  } else {
    await db.execute(
      `INSERT INTO llm_vendor_profiles (id, owner_id, vendor_kind, name, api_base_url, api_key_encrypted, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET vendor_kind=excluded.vendor_kind, name=excluded.name, api_base_url=excluded.api_base_url, api_key_encrypted=excluded.api_key_encrypted, extra_json=excluded.extra_json, updated_at=excluded.updated_at`,
      [id, ownerId, input.vendorKind, input.name, baseUrl, enc, nextExtraJson, now, now]
    );
  }
  const saved = await getLlmVendorProfileForOwner(id, ownerId);
  if (!saved) throw new Error('Failed to persist vendor profile');
  return saved;
}

export async function deleteLlmVendorProfile(id: string, ownerId: string): Promise<boolean> {
  const ok = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_vendor_profiles WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (!ok) return false;
  const mids = await db.query<{ id: string }>(
    'SELECT id FROM llm_vendor_models WHERE profile_id = ?',
    [id]
  );
  const idList = mids.map((m) => m.id);
  if (idList.length > 0) {
    const ph = idList.map(() => '?').join(',');
    await db.execute(
      `UPDATE llm_agents SET configured_model_id = NULL WHERE configured_model_id IN (${ph})`,
      idList
    );
  }
  await db.execute('DELETE FROM llm_vendor_models WHERE profile_id = ?', [id]);
  const r = await db.execute('DELETE FROM llm_vendor_profiles WHERE id = ? AND owner_id = ?', [
    id,
    ownerId,
  ]);
  return (r.changes ?? 0) > 0;
}

export async function getLlmVendorModelsByOwner(ownerId: string): Promise<LlmVendorModel[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT m.*, p.name AS profile_name, p.vendor_kind
     FROM llm_vendor_models m
     JOIN llm_vendor_profiles p ON p.id = m.profile_id
     WHERE m.owner_id = ?
     ORDER BY p.name ASC, m.model_id ASC`,
    [ownerId]
  );
  return rows.map(mapVendorModelRow);
}

export async function getLlmVendorModelsByProfile(
  profileId: string,
  ownerId: string
): Promise<LlmVendorModel[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT m.*, p.name AS profile_name, p.vendor_kind
     FROM llm_vendor_models m
     JOIN llm_vendor_profiles p ON p.id = m.profile_id
     WHERE m.profile_id = ? AND m.owner_id = ?`,
    [profileId, ownerId]
  );
  return rows.map(mapVendorModelRow);
}

export async function getLlmVendorModelForOwner(
  id: string,
  ownerId: string
): Promise<LlmVendorModel | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    `SELECT m.*, p.name AS profile_name, p.vendor_kind
     FROM llm_vendor_models m
     JOIN llm_vendor_profiles p ON p.id = m.profile_id
     WHERE m.id = ? AND m.owner_id = ?`,
    [id, ownerId]
  );
  return row ? mapVendorModelRow(row) : null;
}

export interface SaveLlmVendorModelInput {
  id?: string;
  profileId: string;
  modelId: string;
  displayName?: string;
  extraJson?: string | null;
}

export async function saveLlmVendorModel(
  ownerId: string,
  input: SaveLlmVendorModelInput
): Promise<LlmVendorModel> {
  const prof = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_vendor_profiles WHERE id = ? AND owner_id = ?',
    [input.profileId, ownerId]
  );
  if (!prof) throw new Error('Vendor profile not found or access denied');
  const id =
    input.id ||
    `llm_vmodel_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_vendor_models WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (input.id && !existing) {
    throw new Error('Model not found or access denied');
  }
  const now = new Date().toISOString();
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO llm_vendor_models (id, owner_id, profile_id, model_id, display_name, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE profile_id=VALUES(profile_id), model_id=VALUES(model_id), display_name=VALUES(display_name), extra_json=VALUES(extra_json), updated_at=VALUES(updated_at)`,
      [
        id,
        ownerId,
        input.profileId,
        input.modelId,
        input.displayName ?? null,
        input.extraJson ?? null,
        now,
        now,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO llm_vendor_models (id, owner_id, profile_id, model_id, display_name, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET profile_id=excluded.profile_id, model_id=excluded.model_id, display_name=excluded.display_name, extra_json=excluded.extra_json, updated_at=excluded.updated_at`,
      [
        id,
        ownerId,
        input.profileId,
        input.modelId,
        input.displayName ?? null,
        input.extraJson ?? null,
        now,
        now,
      ]
    );
  }
  const saved = await getLlmVendorModelForOwner(id, ownerId);
  if (!saved) throw new Error('Failed to persist vendor model');
  return saved;
}

export async function deleteLlmVendorModel(id: string, ownerId: string): Promise<boolean> {
  await db.execute('UPDATE llm_agents SET configured_model_id = NULL WHERE configured_model_id = ?', [
    id,
  ]);
  const r = await db.execute(
    'DELETE FROM llm_vendor_models WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  return (r.changes ?? 0) > 0;
}

// ==================== LLM Skills / Tools ====================

async function loadLlmToolStepsForTool(toolId: string): Promise<Step[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM llm_tool_steps WHERE tool_id = ? ORDER BY step_order',
    [toolId]
  );
  return rows.map((s) => ({
    id: String(s.id),
    type: String(s.type) as StepType,
    name: String(s.name),
    description: s.description != null ? String(s.description) : undefined,
    config: (() => {
      try {
        return JSON.parse(String(s.config || '{}')) as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
    order: Number(s.step_order),
  }));
}

function mapSkillRow(row: Record<string, unknown>): LlmSkill {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    content: String(row.content),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapToolRow(row: Record<string, unknown>): LlmTool {
  const sc = row._step_count;
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    definitionJson: String(row.definition_json),
    stepCount: sc != null && !Number.isNaN(Number(sc)) ? Number(sc) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getLlmSkillsByOwner(ownerId: string): Promise<LlmSkill[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM llm_skills WHERE owner_id = ? OR owner_id = ?
     ORDER BY CASE WHEN owner_id = ? THEN 0 ELSE 1 END, updated_at DESC`,
    [ownerId, PRESET_LIBRARY_OWNER_ID, ownerId]
  );
  return rows.map(mapSkillRow);
}

export async function getLlmSkillForOwner(id: string, ownerId: string): Promise<LlmSkill | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM llm_skills WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
    [id, ownerId, PRESET_LIBRARY_OWNER_ID]
  );
  return row ? mapSkillRow(row) : null;
}

export interface SaveLlmSkillInput {
  id?: string;
  name: string;
  description?: string;
  content: string;
}

export async function saveLlmSkill(ownerId: string, input: SaveLlmSkillInput): Promise<LlmSkill> {
  const id =
    input.id ||
    `llm_skill_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_skills WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (input.id && !existing) {
    throw new Error('Skill not found or access denied');
  }
  const now = new Date().toISOString();
  await db.execute(sqlUpsertLlmSkill(), [
      id,
      ownerId,
      input.name,
      input.description ?? null,
      input.content,
      now,
      now,
    ]
  );
  const s = await getLlmSkillForOwner(id, ownerId);
  if (!s) throw new Error('Failed to save skill');
  return s;
}

export async function deleteLlmSkill(id: string, ownerId: string): Promise<boolean> {
  const r = await db.execute(
    'DELETE FROM llm_skills WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
    [id, ownerId, PRESET_LIBRARY_OWNER_ID]
  );
  return (r.changes ?? 0) > 0;
}

export async function getLlmToolsByOwner(ownerId: string): Promise<LlmTool[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT t.*, (SELECT COUNT(*) FROM llm_tool_steps s WHERE s.tool_id = t.id) AS _step_count
     FROM llm_tools t WHERE t.owner_id = ? OR t.owner_id = ?
     ORDER BY CASE WHEN t.owner_id = ? THEN 0 ELSE 1 END, t.updated_at DESC`,
    [ownerId, PRESET_LIBRARY_OWNER_ID, ownerId]
  );
  return rows.map(mapToolRow);
}

export async function getLlmToolForOwner(id: string, ownerId: string): Promise<LlmTool | null> {
  const row = await db.queryOne<Record<string, unknown>>(
    'SELECT * FROM llm_tools WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
    [id, ownerId, PRESET_LIBRARY_OWNER_ID]
  );
  if (!row) return null;
  const base = mapToolRow(row);
  const steps = await loadLlmToolStepsForTool(id);
  const { stepCount: _omit, ...rest } = base;
  return { ...rest, steps };
}

export interface SaveLlmToolInput {
  id?: string;
  name: string;
  description?: string;
  definitionJson: string;
  /** 传入则整表替换该工具的步骤；不传则更新时保留原步骤 */
  steps?: Step[];
}

export async function saveLlmTool(ownerId: string, input: SaveLlmToolInput): Promise<LlmTool> {
  JSON.parse(input.definitionJson);
  const isNew = !input.id;
  const id =
    input.id ||
    `llm_tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM llm_tools WHERE id = ? AND owner_id = ?',
    [id, ownerId]
  );
  if (!isNew && !existing) {
    throw new Error('Tool not found or access denied');
  }
  const now = new Date().toISOString();
  await db.execute(sqlUpsertLlmTool(), [
      id,
      ownerId,
      input.name,
      input.description ?? null,
      input.definitionJson,
      now,
      now,
    ]
  );

  if (input.steps !== undefined) {
    await db.execute('DELETE FROM llm_tool_steps WHERE tool_id = ?', [id]);
    for (const step of input.steps) {
      await db.execute(
        `INSERT INTO llm_tool_steps (id, tool_id, type, name, description, config, step_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          step.id,
          id,
          step.type,
          step.name,
          step.description ?? null,
          JSON.stringify(step.config ?? {}),
          step.order,
          now,
          now,
        ]
      );
    }
  }

  const t = await getLlmToolForOwner(id, ownerId);
  if (!t) throw new Error('Failed to save tool');
  return t;
}

export async function deleteLlmTool(id: string, ownerId: string): Promise<boolean> {
  const r = await db.execute(
    'DELETE FROM llm_tools WHERE id = ? AND (owner_id = ? OR owner_id = ?)',
    [id, ownerId, PRESET_LIBRARY_OWNER_ID]
  );
  return (r.changes ?? 0) > 0;
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
        'agents:read', 'agents:manage',
        'users:read', 'users:create', 'users:update', 'users:delete', 'users:manage',
        'roles:read', 'roles:create', 'roles:update', 'roles:delete', 'roles:manage',
        'audit:read',
        'system:auth_settings',
        'system:platform_settings',
      ],
      isSystem: true,
    },
    {
      id: 'admin',
      name: '管理员',
      description: '管理适配器、机器人和流程',
      permissions: [
        'adapters:manage',
        'bots:manage',
        'flows:manage',
        'agents:read',
        'agents:manage',
        'users:read',
        'audit:read',
      ],
      isSystem: true,
    },
    {
      id: 'operator',
      name: '运维人员',
      description: '管理机器人和流程',
      permissions: ['adapters:read', 'bots:read', 'bots:update', 'flows:read', 'flows:update', 'agents:read', 'agents:manage'],
      isSystem: true,
    },
    {
      id: 'viewer',
      name: '查看者',
      description: '只读权限',
      permissions: ['adapters:read', 'bots:read', 'flows:read', 'agents:read'],
      isSystem: true,
    },
  ];
  
  for (const role of SYSTEM_ROLES) {
    await db.execute(sqlUpsertSystemRole(), [
      role.id,
      role.name,
      role.description,
      JSON.stringify(role.permissions),
      role.isSystem ? 1 : 0,
    ]);
  }
}
