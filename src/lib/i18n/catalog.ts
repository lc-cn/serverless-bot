import { routing } from '@/i18n/routing';
import en from '@/messages/en.json';
import zhCN from '@/messages/zh-CN.json';

const catalogs = {
  'zh-CN': zhCN,
  en,
} as const;

export type MessagesCatalog = (typeof catalogs)['zh-CN'];

function getNested(obj: unknown, parts: string[]): string | undefined {
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** 同步读取文案：供 proxy / 少量非 async 路径使用 */
export function pickMessage(locale: string, keyPath: string): string {
  const loc = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? (locale as keyof typeof catalogs)
    : routing.defaultLocale;
  const primary = getNested(catalogs[loc], keyPath.split('.'));
  if (primary) return primary;
  const fb = getNested(catalogs[routing.defaultLocale as keyof typeof catalogs], keyPath.split('.'));
  return fb ?? keyPath;
}

export function localeFromRequestCookies(
  getCookie: (name: string) => string | undefined,
): string {
  const v = getCookie('NEXT_LOCALE');
  if (v && routing.locales.includes(v as (typeof routing.locales)[number])) {
    return v;
  }
  return routing.defaultLocale;
}
