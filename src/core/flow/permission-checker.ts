import type {
  BotEvent,
  MessageEvent,
  RequestEvent,
  NoticeEvent,
  PermissionRule,
} from '@/types';

/**
 * 权限检查器
 */

export class PermissionChecker {
  /**
   * 检查事件是否满足权限要求
   */
  static check(event: BotEvent, permission: PermissionRule): boolean {
    // 检查角色
    if (!permission.allowRoles.includes(event.sender.role)) {
      return false;
    }

    // 检查环境
    const environment = this.getEnvironment(event);
    if (!permission.allowEnvironments.includes(environment)) {
      return false;
    }

    // 检查用户黑名单
    if (permission.denyUsers?.includes(event.sender.userId)) {
      return false;
    }

    // 检查用户白名单
    if (permission.allowUsers && permission.allowUsers.length > 0) {
      if (!permission.allowUsers.includes(event.sender.userId)) {
        return false;
      }
    }

    // 检查群组相关权限
    const groupId = this.getGroupId(event);
    if (groupId) {
      if (permission.denyGroups?.includes(groupId)) {
        return false;
      }
      if (permission.allowGroups && permission.allowGroups.length > 0) {
        if (!permission.allowGroups.includes(groupId)) {
          return false;
        }
      }
    }

    return true;
  }

  private static getEnvironment(event: BotEvent): 'private' | 'group' {
    if (event.type === 'message') {
      return (event as MessageEvent).subType === 'group' ? 'group' : 'private';
    }
    // 对于其他类型的事件，有 groupId 就视为群组环境
    const groupId = this.getGroupId(event);
    return groupId ? 'group' : 'private';
  }

  private static getGroupId(event: BotEvent): string | undefined {
    switch (event.type) {
      case 'message':
        return (event as MessageEvent).groupId;
      case 'request':
        return (event as RequestEvent).groupId;
      case 'notice':
        return (event as NoticeEvent).groupId;
      default:
        return undefined;
    }
  }
}
