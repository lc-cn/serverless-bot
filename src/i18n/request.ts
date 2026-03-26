import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { APP_TIME_ZONE } from './constants';
import en from '../messages/en.json';
import zhCN from '../messages/zh-CN.json';
import stepFieldsZhCN from '../messages/step-fields.zh-CN.json';

const messagesByLocale = {
  'zh-CN': { ...zhCN, StepFields: stepFieldsZhCN },
  en,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale as keyof typeof messagesByLocale] ?? messagesByLocale['zh-CN'],
    timeZone: APP_TIME_ZONE,
  };
});
