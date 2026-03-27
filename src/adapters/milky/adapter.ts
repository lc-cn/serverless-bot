import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { MilkyBot } from './bot';
import type { BotConfig, BotEvent, Message, MessageEvent, NoticeEvent, RequestEvent, UserRole } from '@/types';
import { generateId } from '@/lib/shared/utils';

function headerGet(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** Milky WebHook / WebSocket 事件（节选） @see https://milky.ntqqrev.org/struct/Event */
interface MilkyMessageReceiveData {
  message_scene: string;
  peer_id: number;
  message_seq: number;
  sender_id: number;
  time: number;
  segments?: Array<{ type?: string; data?: Record<string, unknown> }>;
  friend?: { nickname?: string; remark?: string };
  group?: { group_id?: number; group_name?: string };
  group_member?: { nickname?: string; card?: string; role?: string };
}

interface MilkyWebhookEnvelope {
  time?: number;
  self_id?: number;
  event_type?: string;
  data?: MilkyMessageReceiveData & Record<string, unknown>;
}

export class MilkyAdapter extends Adapter {
  constructor() {
    super(
      'milky',
      'Milky',
      'Milky QQ 协议：HTTP Webhook 收事件 + 协议端 /api 发消息（需 Milky 协议端）',
      '🥛',
    );
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      apiBaseUrl: z.string().min(1, '协议端 HTTP 根地址不能为空'),
      accessToken: z.string().optional(),
      webhookSecret: z.string().optional(),
    });
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'apiBaseUrl',
          label: '协议端 HTTP 根地址',
          type: 'text',
          required: true,
          placeholder: 'http://127.0.0.1:8080',
          description:
            'Milky 协议端监听地址，无尾斜杠。API 路径为 /api/<方法名>，与文档一致。',
        },
        {
          name: 'accessToken',
          label: 'access_token（可选）',
          type: 'password',
          required: false,
          placeholder: '与协议端配置一致',
          description:
            '调用 /api 时在 Authorization: Bearer 中携带；若协议端未启用可留空。',
        },
        {
          name: 'webhookSecret',
          label: 'Webhook 密钥（可选）',
          type: 'password',
          required: false,
          placeholder: '与协议端 WebHook 配置一致',
          description:
            '若填写：协议端 POST WebHook 须带 Authorization: Bearer 且值相同（见 Milky 通信说明）。',
        },
      ],
    };
  }

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'milky',
      sectionTitleKey: 'setupTitle',
      steps: [
        { titleKey: 'step1Title', border: 'indigo', body: { kind: 'rich', messageKey: 'step1Body' } },
        { titleKey: 'step2Title', border: 'indigo', body: { kind: 'rich', messageKey: 'step2Body' } },
        {
          titleKey: 'step3Title',
          border: 'green',
          body: {
            kind: 'paragraphAndCodeBlock',
            paragraphKey: 'step3Body',
            codeBlockMessageKey: 'step3ExampleUrl',
          },
        },
        { titleKey: 'step4Title', border: 'green', body: { kind: 'plain', messageKey: 'step4Body' } },
      ],
      tipKey: 'tip',
      usage: {
        lines: [
          { kind: 'lead', key: 'usage1' },
          { kind: 'lead', key: 'usage2' },
          { kind: 'field', key: 'usageFieldApi' },
          { kind: 'field', key: 'usageFieldToken' },
          { kind: 'field', key: 'usageFieldSecret' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'lead', key: 'usage4' },
        ],
      },
    };
  }

  createBot(config: BotConfig): MilkyBot {
    return new MilkyBot(config);
  }

  private normalizeSegments(
    segments: MilkyMessageReceiveData['segments'],
  ): { content: Message; rawText: string } {
    if (!Array.isArray(segments) || segments.length === 0) {
      return { content: [], rawText: '' };
    }
    const content: Message = [];
    const textParts: string[] = [];
    for (const seg of segments) {
      const ty = seg.type;
      const data = seg.data || {};
      if (ty === 'text') {
        const text = String((data as { text?: string }).text ?? '');
        content.push({ type: 'text', data: { text } });
        textParts.push(text);
      } else if (ty === 'mention') {
        const uid = (data as { user_id?: number }).user_id;
        content.push({
          type: 'at',
          data: { userId: uid != null ? String(uid) : '', name: undefined },
        });
        textParts.push(uid != null ? `@${uid}` : '');
      } else if (ty === 'mention_all') {
        content.push({ type: 'at', data: { userId: 'all', name: '全体成员' } });
        textParts.push('@全体成员');
      } else if (ty === 'face') {
        const fid = (data as { face_id?: string }).face_id;
        textParts.push(fid ? `[表情:${fid}]` : '');
      } else if (ty === 'image') {
        const url = (data as { temp_url?: string }).temp_url;
        if (url) content.push({ type: 'image', data: { url } });
      }
    }
    return { content, rawText: textParts.join('') };
  }

  private mapMemberRole(r?: string): UserRole {
    if (r === 'owner') return 'owner';
    if (r === 'admin' || r === 'administrator') return 'admin';
    return 'normal';
  }

  async parseEvent(botId: string, rawData: unknown, _headers: Record<string, string>): Promise<BotEvent | null> {
    const ev = rawData as MilkyWebhookEnvelope;
    if (!ev.data || !ev.event_type) return null;

    switch (ev.event_type) {
      case 'message_receive':
        return this.parseMessageReceive(botId, ev);
      case 'message_recall':
        return this.parseMessageRecall(botId, ev);
      case 'friend_request':
        return this.parseFriendRequest(botId, ev);
      case 'group_join_request':
        return this.parseGroupJoinRequest(botId, ev);
      case 'group_invited_join_request':
        return this.parseGroupInvitedJoinRequest(botId, ev);
      case 'group_invitation':
        return this.parseGroupInvitation(botId, ev);
      case 'friend_nudge':
        return this.parseFriendNudge(botId, ev);
      case 'group_nudge':
        return this.parseGroupNudge(botId, ev);
      case 'group_member_increase':
        return this.parseGroupMemberIncrease(botId, ev);
      case 'group_member_decrease':
        return this.parseGroupMemberDecrease(botId, ev);
      case 'group_admin_change':
        return this.parseGroupAdminChange(botId, ev);
      case 'group_mute':
      case 'group_whole_mute':
        return this.parseGroupMuteNotice(botId, ev);
      case 'bot_offline':
        return this.parseBotOffline(botId, ev);
      case 'group_essence_message_change':
        return this.parseGroupEssenceChange(botId, ev);
      case 'group_message_reaction':
        return this.parseGroupMessageReaction(botId, ev);
      case 'group_name_change':
        return this.parseGroupNameChange(botId, ev);
      case 'group_file_upload':
        return this.parseGroupFileUpload(botId, ev);
      case 'friend_file_upload':
        return this.parseFriendFileUpload(botId, ev);
      default:
        return null;
    }
  }

  private tsMs(ev: MilkyWebhookEnvelope): number {
    const sec = (ev.data as { time?: number })?.time ?? ev.time ?? Math.floor(Date.now() / 1000);
    return (typeof sec === 'number' ? sec : Math.floor(Date.now() / 1000)) * 1000;
  }

  private parseMessageReceive(botId: string, ev: MilkyWebhookEnvelope): MessageEvent | null {
    const d = ev.data as MilkyMessageReceiveData;
    const scene = d.message_scene;
    if (scene !== 'friend' && scene !== 'group' && scene !== 'temp') {
      return null;
    }
    const subType = scene === 'group' ? 'group' : 'private';
    const { content, rawText } = this.normalizeSegments(d.segments);
    const tsSec = d.time ?? ev.time ?? Math.floor(Date.now() / 1000);
    const ts = tsSec * 1000;

    let nickname: string | undefined;
    if (scene === 'group' && d.group_member) {
      nickname = d.group_member.card || d.group_member.nickname;
    } else if (scene === 'friend' && d.friend) {
      nickname = d.friend.remark || d.friend.nickname;
    }

    const role = scene === 'group' ? this.mapMemberRole(d.group_member?.role) : 'normal';

    return {
      id: generateId(),
      type: 'message',
      subType,
      platform: 'milky',
      botId,
      timestamp: ts,
      sender: {
        userId: String(d.sender_id),
        nickname,
        role,
      },
      content,
      rawContent: rawText,
      groupId: subType === 'group' ? String(d.peer_id) : undefined,
      messageId: String(d.message_seq),
      raw: ev,
    } satisfies MessageEvent;
  }

  private parseMessageRecall(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      message_scene?: string;
      peer_id?: number;
      message_seq?: number;
      sender_id?: number;
      operator_id?: number;
    };
    const isGroup = d.message_scene === 'group';
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: {
        userId: String(d.operator_id ?? d.sender_id ?? 0),
        role: 'normal',
      },
      groupId: isGroup && d.peer_id != null ? String(d.peer_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      targetId: d.sender_id != null ? String(d.sender_id) : undefined,
      extra: { event_type: 'message_recall', matchContent: 'message_recall', message_seq: d.message_seq },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseFriendRequest(botId: string, ev: MilkyWebhookEnvelope): RequestEvent {
    const d = ev.data as { initiator_id?: number; comment?: string; via?: string };
    const uid = d.initiator_id ?? 0;
    return {
      id: generateId(),
      type: 'request',
      subType: 'friend',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(uid), role: 'normal' },
      comment: d.comment,
      flag: `milky:friend:${uid}:${d.via ?? ''}`,
      raw: ev,
    } satisfies RequestEvent;
  }

  private parseGroupJoinRequest(botId: string, ev: MilkyWebhookEnvelope): RequestEvent {
    const d = ev.data as {
      group_id?: number;
      initiator_id?: number;
      comment?: string;
      notification_seq?: number;
    };
    const uid = d.initiator_id ?? 0;
    return {
      id: generateId(),
      type: 'request',
      subType: 'group_join',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(uid), role: 'normal' },
      comment: d.comment,
      flag: String(d.notification_seq ?? `join:${d.group_id}:${uid}`),
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      raw: ev,
    } satisfies RequestEvent;
  }

  private parseGroupInvitedJoinRequest(botId: string, ev: MilkyWebhookEnvelope): RequestEvent {
    const d = ev.data as {
      group_id?: number;
      initiator_id?: number;
      target_user_id?: number;
      notification_seq?: number;
    };
    const uid = d.initiator_id ?? 0;
    return {
      id: generateId(),
      type: 'request',
      subType: 'group_invite',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(uid), role: 'normal' },
      flag: String(d.notification_seq ?? `invreq:${d.group_id}:${uid}:${d.target_user_id ?? ''}`),
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      raw: ev,
    } satisfies RequestEvent;
  }

  private parseGroupInvitation(botId: string, ev: MilkyWebhookEnvelope): RequestEvent {
    const d = ev.data as { group_id?: number; initiator_id?: number; invitation_seq?: number };
    const uid = d.initiator_id ?? 0;
    return {
      id: generateId(),
      type: 'request',
      subType: 'group_invite',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(uid), role: 'normal' },
      flag: String(d.invitation_seq ?? `inv:${d.group_id}:${uid}`),
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      raw: ev,
    } satisfies RequestEvent;
  }

  private parseFriendNudge(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { user_id?: number };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'poke',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      targetId: d.user_id != null ? String(d.user_id) : undefined,
      extra: { event_type: 'friend_nudge', matchContent: 'friend_nudge' },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupNudge(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { group_id?: number; sender_id?: number; receiver_id?: number };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'poke',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.sender_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.sender_id != null ? String(d.sender_id) : undefined,
      targetId: d.receiver_id != null ? String(d.receiver_id) : undefined,
      extra: { event_type: 'group_nudge', matchContent: 'group_nudge' },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupMemberIncrease(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { group_id?: number; user_id?: number; operator_id?: number; invitor_id?: number };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'group_member_increase',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      targetId: d.user_id != null ? String(d.user_id) : undefined,
      extra: {
        event_type: 'group_member_increase',
        matchContent: 'group_member_increase',
        invitor_id: d.invitor_id,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupMemberDecrease(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { group_id?: number; user_id?: number; operator_id?: number };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'group_member_decrease',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      targetId: d.user_id != null ? String(d.user_id) : undefined,
      extra: { event_type: 'group_member_decrease', matchContent: 'group_member_decrease' },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupAdminChange(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { group_id?: number; user_id?: number; operator_id?: number; is_set?: boolean };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'group_admin_change',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      targetId: d.user_id != null ? String(d.user_id) : undefined,
      extra: { event_type: 'group_admin_change', matchContent: 'group_admin_change', is_set: d.is_set },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupMuteNotice(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      group_id?: number;
      user_id?: number;
      operator_id?: number;
      duration?: number;
      is_mute?: boolean;
    };
    const isWhole = ev.event_type === 'group_whole_mute';
    return {
      id: generateId(),
      type: 'notice',
      subType: 'group_ban',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? d.operator_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      targetId: !isWhole && d.user_id != null ? String(d.user_id) : undefined,
      extra: {
        event_type: ev.event_type,
        matchContent: ev.event_type,
        duration: d.duration,
        is_mute: d.is_mute,
        whole_mute: isWhole,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseBotOffline(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { reason?: string };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(ev.self_id ?? 0), role: 'normal' },
      extra: { event_type: 'bot_offline', matchContent: 'bot_offline', reason: d.reason },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupEssenceChange(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      group_id?: number;
      message_seq?: number;
      operator_id?: number;
      is_set?: boolean;
    };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.operator_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      extra: {
        event_type: 'group_essence_message_change',
        matchContent: 'group_essence_message_change',
        message_seq: d.message_seq,
        is_set: d.is_set,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupMessageReaction(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      group_id?: number;
      user_id?: number;
      message_seq?: number;
      face_id?: string;
      is_add?: boolean;
    };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      extra: {
        event_type: 'group_message_reaction',
        matchContent: 'group_message_reaction',
        message_seq: d.message_seq,
        face_id: d.face_id,
        is_add: d.is_add,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupNameChange(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as { group_id?: number; new_group_name?: string; operator_id?: number };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.operator_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      operatorId: d.operator_id != null ? String(d.operator_id) : undefined,
      extra: {
        event_type: 'group_name_change',
        matchContent: 'group_name_change',
        new_group_name: d.new_group_name,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseGroupFileUpload(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      group_id?: number;
      user_id?: number;
      file_id?: string;
      file_name?: string;
      file_size?: number;
    };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      groupId: d.group_id != null ? String(d.group_id) : undefined,
      extra: {
        event_type: 'group_file_upload',
        matchContent: 'group_file_upload',
        file_id: d.file_id,
        file_name: d.file_name,
        file_size: d.file_size,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  private parseFriendFileUpload(botId: string, ev: MilkyWebhookEnvelope): NoticeEvent {
    const d = ev.data as {
      user_id?: number;
      file_id?: string;
      file_name?: string;
      file_size?: number;
      is_self?: boolean;
    };
    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'milky',
      botId,
      timestamp: this.tsMs(ev),
      sender: { userId: String(d.user_id ?? 0), role: 'normal' },
      extra: {
        event_type: 'friend_file_upload',
        matchContent: 'friend_file_upload',
        file_id: d.file_id,
        file_name: d.file_name,
        file_size: d.file_size,
        is_self: d.is_self,
      },
      raw: ev,
    } satisfies NoticeEvent;
  }

  async verifyWebhook(
    _rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>,
    _query?: Record<string, string>
  ): Promise<boolean> {
    const secret = (config.webhookSecret as string | undefined)?.trim();
    if (!secret) return true;
    const auth = headerGet(headers, 'authorization');
    const token = auth?.replace(/^Bearer\s+/i, '').trim();
    return token === secret;
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user', 'notice', 'request', 'recall', 'reaction', 'file'];
  }
}
