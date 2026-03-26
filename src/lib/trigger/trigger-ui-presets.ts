import type { FlowEventType } from '@/types';

/** 与后端事件 subType 一致；展示标签见 messages `Dashboard.triggerEditor.subtypes.*` */
export const TRIGGER_SUBTYPE_OPTIONS: Record<FlowEventType, readonly { value: string }[]> = {
  message: [{ value: 'private' }, { value: 'group' }],
  request: [
    { value: 'friend' },
    { value: 'group_invite' },
    { value: 'group_join' },
  ],
  notice: [
    { value: 'group_member_increase' },
    { value: 'group_member_decrease' },
    { value: 'group_admin_change' },
    { value: 'group_ban' },
    { value: 'friend_add' },
    { value: 'poke' },
    { value: 'custom' },
  ],
};

/** 列表中始终展示的常用 platform（无仪表盘配置时也可用） */
export const DEFAULT_PLATFORM_PRESETS = ['sandbox'] as const;

export type ScopeListMode = 'all' | 'allow' | 'deny';

export function platformScopeModeFromScope(
  allow?: string[],
  deny?: string[]
): ScopeListMode {
  if (allow?.length) return 'allow';
  if (deny?.length) return 'deny';
  return 'all';
}

export function listModeFromPermission(
  allow?: string[],
  deny?: string[]
): ScopeListMode {
  if (allow?.length) return 'allow';
  if (deny?.length) return 'deny';
  return 'all';
}
