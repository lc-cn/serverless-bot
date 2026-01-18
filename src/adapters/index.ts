import { adapterRegistry } from '@/core';
import { TelegramAdapter } from './telegram';
import { DiscordAdapter } from './discord';
import { QQAdapter } from './qq';

/**
 * 注册所有适配器
 * 在应用启动时调用
 */
export function registerAdapters(): void {
  // 注册 Telegram 适配器
  adapterRegistry.register(new TelegramAdapter());

  // 注册 Discord 适配器
  adapterRegistry.register(new DiscordAdapter());

  // 注册 QQ 适配器
  adapterRegistry.register(new QQAdapter());

  // 注册其他适配器...
  // adapterRegistry.register(new SlackAdapter());
  // adapterRegistry.register(new WeChatAdapter());
}

// 自动注册
registerAdapters();

// 导出适配器
export { TelegramAdapter } from './telegram';
export { DiscordAdapter } from './discord';
export { QQAdapter } from './qq';
