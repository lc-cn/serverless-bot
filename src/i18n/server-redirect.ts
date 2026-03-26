import { redirect as intlRedirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

/** Server Components：带当前 locale 前缀的重定向（next-intl 要求显式 locale） */
export async function localizedRedirect(href: string): Promise<never> {
  const locale = await getLocale();
  return intlRedirect({ href, locale });
}
