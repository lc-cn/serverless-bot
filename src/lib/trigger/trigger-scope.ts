import type { TriggerAdapterScope, TriggerEventScope, TriggerScope } from '@/types';

/** 去掉空数组/空对象，避免库无意义 JSON */
export function normalizeTriggerScope(scope: TriggerScope | undefined): TriggerScope | undefined {
  if (!scope) return undefined;

  const a = scope.adapter;
  const adapter =
    a &&
    ({
      ...(a.allowPlatforms?.length ? { allowPlatforms: a.allowPlatforms } : {}),
      ...(a.denyPlatforms?.length ? { denyPlatforms: a.denyPlatforms } : {}),
      ...(a.allowBotIds?.length ? { allowBotIds: a.allowBotIds } : {}),
      ...(a.denyBotIds?.length ? { denyBotIds: a.denyBotIds } : {}),
    } as TriggerAdapterScope);
  const adapterClean =
    adapter && Object.keys(adapter as object).length > 0 ? adapter : undefined;

  const e = scope.event;
  const eventPart =
    e &&
    ({
      ...(e.allowSubTypes?.length ? { allowSubTypes: e.allowSubTypes } : {}),
      ...(e.denySubTypes?.length ? { denySubTypes: e.denySubTypes } : {}),
    } as TriggerEventScope);
  const eventClean =
    eventPart && Object.keys(eventPart as object).length > 0 ? eventPart : undefined;

  if (!adapterClean && !eventClean) return undefined;
  return {
    ...(adapterClean ? { adapter: adapterClean } : {}),
    ...(eventClean ? { event: eventClean } : {}),
  };
}

/** 逗号/中文逗号/换行分隔，trim，去空 */
export function splitIdList(raw: string): string[] | undefined {
  const xs = raw
    .split(/[,，\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return xs.length ? xs : undefined;
}
