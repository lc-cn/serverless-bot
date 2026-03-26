/**
 * 分板块新手引导：与侧栏分组对齐，供枢纽页与 /onboarding/[sectionId] 使用。
 */

export type OnboardingSectionId =
  | 'overview'
  | 'bot_access'
  | 'automation'
  | 'step_ref'
  | 'llm_runtime'
  | 'llm_assets'
  | 'rbac'
  | 'profile'
  | 'platform_ext';

export const ONBOARDING_SECTION_IDS: OnboardingSectionId[] = [
  'overview',
  'bot_access',
  'automation',
  'step_ref',
  'llm_runtime',
  'llm_assets',
  'rbac',
  'profile',
  'platform_ext',
];

export type OnboardingSectionDef = {
  id: OnboardingSectionId;
  title: string;
  description: string;
  /** 主要入口路由（文案/链接用） */
  routes: string[];
  /** 至少具备其中一条权限才可「开始」该板块；空表示不校验 */
  anyOfPermissions: string[];
};

export const ONBOARDING_SECTIONS: OnboardingSectionDef[] = [
  {
    id: 'overview',
    title: '概览',
    description: '控制台能做什么、各模块如何配合。',
    routes: ['/'],
    anyOfPermissions: [],
  },
  {
    id: 'bot_access',
    title: '机器人接入',
    description: '适配器、平台密钥与机器人实例，以及用「对话」试发消息。',
    routes: ['/adapter', '/chat'],
    anyOfPermissions: ['adapters:read', 'bots:read', 'adapters:manage', 'bots:manage', 'bots:create'],
  },
  {
    id: 'automation',
    title: '事件与自动化',
    description: '触发器、事件路由、步骤流水线与定时任务的关系与创建入口。',
    routes: ['/trigger', '/flow', '/job', '/schedule'],
    anyOfPermissions: ['flows:read', 'flows:create', 'flows:manage', 'bots:read', 'bots:create'],
  },
  {
    id: 'step_ref',
    title: '编排参考',
    description: '步骤类型速查，便于设计 Job / 工具链。',
    routes: ['/step'],
    anyOfPermissions: [],
  },
  {
    id: 'llm_runtime',
    title: 'LLM · 对话体',
    description: '模型连接（厂商、密钥、预置模型）与 Agent 配置。',
    routes: ['/llm/vendors', '/agents'],
    anyOfPermissions: ['agents:read', 'agents:manage'],
  },
  {
    id: 'llm_assets',
    title: 'LLM · 提示词与工具',
    description: 'Skills、Tools、MCP 服务与 Agent 的衔接方式。',
    routes: ['/llm/skills', '/llm/tools', '/llm/mcp'],
    anyOfPermissions: ['agents:read', 'agents:manage'],
  },
  {
    id: 'rbac',
    title: '系统与权限',
    description: '用户、角色与权限串；如何分配控制台能力。',
    routes: ['/users', '/roles'],
    anyOfPermissions: ['users:read', 'roles:read', 'users:manage', 'roles:manage'],
  },
  {
    id: 'profile',
    title: '个人账户',
    description: '个人资料、访问令牌等与账号安全相关项。',
    routes: ['/profile'],
    anyOfPermissions: [],
  },
  {
    id: 'platform_ext',
    title: '平台扩展',
    description: 'Discord 命令、QQ 等平台专属能力入口。',
    routes: ['/discord/commands', '/qq/settings'],
    anyOfPermissions: ['adapters:read', 'adapters:manage', 'bots:read', 'bots:manage'],
  },
];

export function getOnboardingSection(id: string): OnboardingSectionDef | undefined {
  return ONBOARDING_SECTIONS.find((s) => s.id === id);
}

export function userCanAccessOnboardingSection(
  section: OnboardingSectionDef,
  permissions: string[],
): boolean {
  if (section.anyOfPermissions.length === 0) return true;
  const p = new Set(permissions);
  return section.anyOfPermissions.some((x) => p.has(x));
}
