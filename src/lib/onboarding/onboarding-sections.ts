import {
  ONBOARDING_SECTION_IDS,
  type OnboardingSectionId,
} from './onboarding-registry';

export type SectionProgressStatus = 'pending' | 'done' | 'skipped';

export type SectionProgressEntry = {
  status: SectionProgressStatus;
  at?: number;
};

export type OnboardingSectionsState = Record<string, SectionProgressEntry>;

function isValidStatus(s: unknown): s is SectionProgressStatus {
  return s === 'pending' || s === 'done' || s === 'skipped';
}

/** 从 DB 原始 JSON 解析；非法则视为空对象 */
export function parseOnboardingSectionsJson(raw: string | null | undefined): OnboardingSectionsState {
  if (raw == null || String(raw).trim() === '') return {};
  try {
    const o = JSON.parse(String(raw)) as Record<string, unknown>;
    const out: OnboardingSectionsState = {};
    for (const id of ONBOARDING_SECTION_IDS) {
      const v = o[id];
      if (v && typeof v === 'object' && v !== null && 'status' in v) {
        const st = (v as { status?: unknown }).status;
        if (isValidStatus(st)) {
          const at = (v as { at?: unknown }).at;
          out[id] = {
            status: st,
            at: typeof at === 'number' && Number.isFinite(at) ? at : undefined,
          };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 合并逻辑：
 * - 若已写入 JSON，以 JSON 为准（按 id 补默认 pending）。
 * - 若 JSON 为空且 hub 已毕业（legacy onboarding_completed_at），视为全板块 done（避免升级后老用户被打扰）。
 */
export function resolveOnboardingSectionsState(
  rawJson: string | null | undefined,
  hubCompletedAt: number | null | undefined,
): OnboardingSectionsState {
  const parsed = parseOnboardingSectionsJson(rawJson);
  const hasAnyStored = ONBOARDING_SECTION_IDS.some((id) => parsed[id] != null);

  if (hasAnyStored) {
    const merged: OnboardingSectionsState = {};
    const at = Date.now();
    for (const id of ONBOARDING_SECTION_IDS) {
      merged[id] = parsed[id] ?? { status: 'pending', at: undefined };
    }
    return merged;
  }

  if (hubCompletedAt != null) {
    const merged: OnboardingSectionsState = {};
    for (const id of ONBOARDING_SECTION_IDS) {
      merged[id] = { status: 'done', at: hubCompletedAt };
    }
    return merged;
  }

  const merged: OnboardingSectionsState = {};
  for (const id of ONBOARDING_SECTION_IDS) {
    merged[id] = { status: 'pending' };
  }
  return merged;
}

export function serializeOnboardingSectionsState(state: OnboardingSectionsState): string {
  const o: Record<string, SectionProgressEntry> = {};
  for (const id of ONBOARDING_SECTION_IDS) {
    const e = state[id];
    if (e && (e.status === 'done' || e.status === 'skipped')) {
      o[id] = { status: e.status, at: e.at ?? Date.now() };
    }
  }
  return JSON.stringify(o);
}

export function applySectionAction(
  state: OnboardingSectionsState,
  sectionId: OnboardingSectionId,
  action: 'complete' | 'skip',
): OnboardingSectionsState {
  const at = Date.now();
  const next = { ...state };
  next[sectionId] = { status: action === 'complete' ? 'done' : 'skipped', at };
  return next;
}

export function countSectionPending(state: OnboardingSectionsState): number {
  return ONBOARDING_SECTION_IDS.filter((id) => {
    const s = state[id]?.status ?? 'pending';
    return s === 'pending';
  }).length;
}
