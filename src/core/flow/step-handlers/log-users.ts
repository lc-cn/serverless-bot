import type { FlowAction } from '@/types';
import type { MessageEvent } from '@/types';
import type { JobContext } from '../types';
import { interpolate } from '../step-template';

export async function executeLog(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    level?: 'debug' | 'info' | 'warn' | 'error';
    message: string;
  };

  const message = interpolate(config.message, context);
  const level = config.level || 'info';

  const logEntry = {
    level,
    message,
    flowId: context.flow.id,
    eventId: context.event.id,
    timestamp: Date.now(),
  };

  console[level]('[Flow Log]', logEntry);

  return logEntry;
}

export async function executeGetUserInfo(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    userId?: string;
    groupId?: string;
    saveAs?: string;
  };

  const userId = config.userId ? interpolate(config.userId, context) : context.event.sender.userId;

  const groupId = config.groupId ? interpolate(config.groupId, context) : undefined;

  console.debug('[get_user_info] Fetching user detail', {
    userId,
    groupId,
    saveAs: config.saveAs,
  });

  let userInfo = await context.bot.getUserDetail(userId, groupId);

  if (!userInfo && !groupId && userId === context.event.sender.userId) {
    console.debug('[get_user_info] API returned null, using event sender info');
    userInfo = {
      id: context.event.sender.userId,
      name: context.event.sender.nickname || context.event.sender.userId,
      nickname: context.event.sender.nickname || context.event.sender.userId,
      role: context.event.sender.role || 'normal',
      extra: { fromEvent: true },
    };
  }

  console.debug('[get_user_info] Got user info', {
    userInfo,
    type: typeof userInfo,
    isNull: userInfo === null,
    isUndefined: userInfo === undefined,
    keys: userInfo ? Object.keys(userInfo as unknown as Record<string, unknown>) : 'N/A',
    stringified: JSON.stringify(userInfo)?.substring(0, 200),
  });

  if (config.saveAs) {
    console.debug('[get_user_info] Saving to context.variables', {
      varName: config.saveAs,
      beforeCount: Object.keys(context.variables).length,
    });
    context.variables[config.saveAs] = userInfo;
    console.debug('[get_user_info] After save, context.variables keys:', {
      keys: Object.keys(context.variables),
      newVarValue: JSON.stringify(context.variables[config.saveAs])?.substring(0, 200),
    });
  }

  return userInfo;
}

export async function executeGetGroupInfo(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    groupId?: string;
    saveAs?: string;
  };

  let groupId = config.groupId ? interpolate(config.groupId, context) : undefined;

  if (!groupId && context.event.type === 'message') {
    groupId = (context.event as MessageEvent).groupId;
  }

  if (!groupId) {
    throw new Error('Group ID not found');
  }

  const groupInfo = await context.bot.getGroupDetail(groupId);

  if (config.saveAs) {
    context.variables[config.saveAs] = groupInfo;
  }

  return groupInfo;
}
