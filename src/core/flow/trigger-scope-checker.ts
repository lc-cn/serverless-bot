import type { BotEvent, TriggerScope } from '@/types';
import type { Bot } from '../bot';

/**
 * 触发器 scope：适配器维度（platform / bot 实例）与事件子类型。
 * 在内容匹配（Matcher）之前执行，避免无意义的正则计算。
 */
export class TriggerScopeChecker {
  static passes(event: BotEvent, bot: Bot, scope: TriggerScope | undefined): boolean {
    if (!scope) return true;

    if (scope.adapter && !this.checkAdapter(event, bot, scope.adapter)) {
      return false;
    }
    if (scope.event && !this.checkEventSubTypes(event, scope.event)) {
      return false;
    }
    return true;
  }

  private static checkAdapter(
    event: BotEvent,
    bot: Bot,
    adapter: NonNullable<TriggerScope['adapter']>
  ): boolean {
    const platform = event.platform || bot.platform;
    const botId = event.botId || bot.id;

    if (adapter.denyPlatforms?.length) {
      if (adapter.denyPlatforms.includes(platform)) return false;
    }
    if (adapter.allowPlatforms?.length) {
      if (!adapter.allowPlatforms.includes(platform)) return false;
    }
    if (adapter.denyBotIds?.length) {
      if (adapter.denyBotIds.includes(botId)) return false;
    }
    if (adapter.allowBotIds?.length) {
      if (!adapter.allowBotIds.includes(botId)) return false;
    }
    return true;
  }

  private static checkEventSubTypes(
    event: BotEvent,
    ev: NonNullable<TriggerScope['event']>
  ): boolean {
    const sub = event.subType;
    if (ev.denySubTypes?.length && ev.denySubTypes.includes(sub)) {
      return false;
    }
    if (ev.allowSubTypes?.length && !ev.allowSubTypes.includes(sub)) {
      return false;
    }
    return true;
  }
}
