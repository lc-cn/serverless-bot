/**
 * 领域存储门面：将 `data.ts` 的函数封装为 `storage` 对象，供 API / 业务调用。
 * 底层主库与 KV 经 `@/lib/data-layer` 接入（引擎由环境变量选择，不限于 SQLite）。
 */

import * as data from './data';

/** 控制台与 API 统一使用的存储门面 */
export const storage = {
  // Bot 配置
  getBots: data.getBots,
  getBot: data.getBot,
  getBotsByPlatform: data.getBotsByPlatform,
  saveBot: data.saveBot,
  deleteBot: data.deleteBot,

  // Adapter 配置
  getAdapters: data.getAdapters,
  getAdapter: data.getAdapter,
  saveAdapter: data.saveAdapter,
  deleteAdapter: data.deleteAdapter,

  // Flow 配置（Webhook 用 getFlowsForWebhookBot；控制台用 listFlowsForUser）
  getFlowsForWebhookBot: data.getFlowsForWebhookBot,
  getWebhookFlowRuntimeSnapshot: data.getWebhookFlowRuntimeSnapshot,
  listFlowsForUser: data.listFlowsForUser,
  getFlowForUser: data.getFlowForUser,
  saveFlow: data.saveFlow,
  deleteFlowForUser: data.deleteFlowForUser,

  // Trigger 配置
  getTriggersForWebhookBot: data.getTriggersForWebhookBot,
  listTriggersForUser: data.listTriggersForUser,
  getTriggerForUser: data.getTriggerForUser,
  saveTrigger: data.saveTrigger,
  deleteTriggerForUser: data.deleteTriggerForUser,

  // Job 配置
  getJobsForWebhookBot: data.getJobsForWebhookBot,
  listJobsForUser: data.listJobsForUser,
  getJobForUser: data.getJobForUser,
  saveJob: data.saveJob,
  deleteJobForUser: data.deleteJobForUser,

  listScheduledTasksForUser: data.listScheduledTasksForUser,
  listEnabledScheduledTasks: data.listEnabledScheduledTasks,
  getScheduledTaskForUser: data.getScheduledTaskForUser,
  insertScheduledTask: data.insertScheduledTask,
  updateScheduledTaskForUser: data.updateScheduledTaskForUser,
  deleteScheduledTaskForUser: data.deleteScheduledTaskForUser,
  touchScheduledTaskLastRun: data.touchScheduledTaskLastRun,
  insertScheduledTaskRun: data.insertScheduledTaskRun,
  finishScheduledTaskRun: data.finishScheduledTaskRun,
  listScheduledTaskRunsForTask: data.listScheduledTaskRunsForTask,

  // 用户管理
  getUsers: data.getUsers,
  getUser: data.getUser,
  getUserByEmail: data.getUserByEmail,
  getUserByUsername: data.getUserByUsername,
  getUserByIdentifier: data.getUserByIdentifier,
  authenticateLocalCredentials: data.authenticateLocalCredentials,
  countUsers: data.countUsers,
  getUserByGithubId: data.getUserByGithubId,
  getOAuthAccount: data.getOAuthAccount,
  listOAuthAccountsForUser: data.listOAuthAccountsForUser,
  linkOAuthAccount: data.linkOAuthAccount,
  unlinkOAuthAccount: data.unlinkOAuthAccount,
  createUser: data.createUser,
  updateUser: data.updateUser,
  deleteUser: data.deleteUser,

  // LLM Agent
  getLlmAgentsByOwner: data.getLlmAgentsByOwner,
  getLlmAgentForOwner: data.getLlmAgentForOwner,
  getLlmAgentRuntime: data.getLlmAgentRuntime,
  saveLlmAgent: data.saveLlmAgent,
  deleteLlmAgent: data.deleteLlmAgent,
  getLlmMcpServersByOwner: data.getLlmMcpServersByOwner,
  getLlmMcpServerForOwner: data.getLlmMcpServerForOwner,
  getLlmMcpServerWithHeadersForOwner: data.getLlmMcpServerWithHeadersForOwner,
  getLlmMcpServerRuntimeForOwner: data.getLlmMcpServerRuntimeForOwner,
  saveLlmMcpServer: data.saveLlmMcpServer,
  deleteLlmMcpServer: data.deleteLlmMcpServer,
  getLlmVendorProfilesByOwner: data.getLlmVendorProfilesByOwner,
  getLlmVendorProfileForOwner: data.getLlmVendorProfileForOwner,
  saveLlmVendorProfile: data.saveLlmVendorProfile,
  deleteLlmVendorProfile: data.deleteLlmVendorProfile,
  getLlmVendorModelsByOwner: data.getLlmVendorModelsByOwner,
  getLlmVendorModelsByProfile: data.getLlmVendorModelsByProfile,
  getLlmVendorModelForOwner: data.getLlmVendorModelForOwner,
  saveLlmVendorModel: data.saveLlmVendorModel,
  deleteLlmVendorModel: data.deleteLlmVendorModel,
  getLlmSkillsByOwner: data.getLlmSkillsByOwner,
  getLlmSkillForOwner: data.getLlmSkillForOwner,
  saveLlmSkill: data.saveLlmSkill,
  deleteLlmSkill: data.deleteLlmSkill,
  getLlmToolsByOwner: data.getLlmToolsByOwner,
  getLlmToolForOwner: data.getLlmToolForOwner,
  saveLlmTool: data.saveLlmTool,
  deleteLlmTool: data.deleteLlmTool,

  // 角色管理
  getRoles: data.getRoles,
  getRole: data.getRole,
  createRole: data.createRole,
  updateRole: data.updateRole,
  deleteRole: data.deleteRole,

  // 初始化
  initializeRBAC: data.initializeRBAC,
};

// 重新导出权限相关函数
export { getUserPermissions, hasPermission, hasAnyPermission } from './data';
