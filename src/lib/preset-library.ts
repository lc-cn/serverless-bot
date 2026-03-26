/** 内置「预设」技能/工具/作业归属的系统用户 id（迁移种子与 `jobs.owner_id` 外键一致） */
export const PRESET_LIBRARY_OWNER_ID = '__preset__' as const;

export function isPresetLibraryOwner(ownerId: string | null | undefined): boolean {
  return ownerId === PRESET_LIBRARY_OWNER_ID;
}
