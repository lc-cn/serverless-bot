import { cookies } from 'next/headers';
import { localeFromRequestCookies } from '@/lib/i18n/catalog';

export async function getServerApiLocale(): Promise<string> {
  const store = await cookies();
  return localeFromRequestCookies((name) => store.get(name)?.value);
}
