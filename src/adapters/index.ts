import { adapterRegistry } from '@/core';
import { TelegramAdapter } from './telegram';
import { DiscordAdapter } from './discord';
import { QQAdapter } from './qq';
import { OneBot11Adapter } from './onebot11';
import { SatoriAdapter } from './satori';
import { MilkyAdapter } from './milky';
import { WechatMpAdapter } from './wechat-mp';
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

  // OneBot 11（HTTP 上报 + HTTP API）
  adapterRegistry.register(new OneBot11Adapter());

  // Satori 通用协议（HTTP Webhook + /v1 RPC）
  adapterRegistry.register(new SatoriAdapter());

  // Milky（QQ，HTTP Webhook + /api）
  adapterRegistry.register(new MilkyAdapter());

  // 微信公众号（GET 验签 + XML POST）
  adapterRegistry.register(new WechatMpAdapter());

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
export { OneBot11Adapter } from './onebot11';
export { SatoriAdapter } from './satori';
export { MilkyAdapter } from './milky';
export { WechatMpAdapter } from './wechat-mp';
