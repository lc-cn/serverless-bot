/**
 * 与 {@link getRequestConfig}、{@link NextIntlClientProvider} 保持一致，避免未配置
 * timeZone 时 next-intl 在服务端与浏览器走不同分支，引发 Radix useId 与 hydration 错位。
 */
export const APP_TIME_ZONE = 'UTC';
