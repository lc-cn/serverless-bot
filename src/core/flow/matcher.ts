import type {
  BotEvent,
  MessageEvent,
  RequestEvent,
  NoticeEvent,
  MatchRule,
} from '@/types';

/**
 * 匹配器：检查事件是否匹配规则
 */

export class Matcher {
  /**
   * 检查事件是否匹配规则，并提取捕获组
   */
  static match(event: BotEvent, rule: MatchRule, variables?: Record<string, unknown>): boolean {
    const content = this.getMatchContent(event);
    
    switch (rule.type) {
      case 'always':
        return true;
      
      case 'keyword':
        // 关键词匹配：检查是否包含该关键词
        return rule.ignoreCase
          ? content.toLowerCase().includes(rule.pattern.toLowerCase())
          : content.includes(rule.pattern);
      
      case 'exact':
        return rule.ignoreCase
          ? content.toLowerCase() === rule.pattern.toLowerCase()
          : content === rule.pattern;
      
      case 'prefix':
        return rule.ignoreCase
          ? content.toLowerCase().startsWith(rule.pattern.toLowerCase())
          : content.startsWith(rule.pattern);
      
      case 'suffix':
        return rule.ignoreCase
          ? content.toLowerCase().endsWith(rule.pattern.toLowerCase())
          : content.endsWith(rule.pattern);
      
      case 'contains':
        return rule.ignoreCase
          ? content.toLowerCase().includes(rule.pattern.toLowerCase())
          : content.includes(rule.pattern);
      
      case 'regex':
        try {
          const flags = rule.ignoreCase ? 'i' : '';
          const regex = new RegExp(rule.pattern, flags);
          const match = regex.exec(content);
          if (match && variables) {
            // 提取捕获组
            match.forEach((value, index) => {
              if (index > 0) { // 跳过完整匹配
                variables[`match_${index}`] = value;
              }
            });
            variables['match_0'] = match[0]; // 完整匹配
            // 命名捕获组
            if (match.groups) {
              Object.entries(match.groups).forEach(([name, value]) => {
                variables[name] = value;
              });
            }
          }
          return !!match;
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * 获取用于匹配的内容
   */
  private static getMatchContent(event: BotEvent): string {
    switch (event.type) {
      case 'message':
        return (event as MessageEvent).rawContent;
      
      case 'request':
        return (event as RequestEvent).comment || '';
      
      case 'notice':
        return this.noticeMatchableContent(event as NoticeEvent);
      
      default:
        return '';
    }
  }

  /**
   * 通知类事件的可匹配文本：优先 `extra.matchContent` / `extra.event_type`（平台事件名），否则为 `subType`。
   */
  static noticeMatchableContent(n: NoticeEvent): string {
    const ex = n.extra;
    if (ex && typeof ex.matchContent === 'string' && ex.matchContent.length > 0) {
      return ex.matchContent;
    }
    if (ex && typeof ex.event_type === 'string' && ex.event_type.length > 0) {
      return ex.event_type;
    }
    return n.subType;
  }
}
