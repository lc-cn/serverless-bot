import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { MilkyBot } from './bot';
import type { BotConfig, BotEvent, Message, MessageEvent, UserRole } from '@/types';
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
  data?: MilkyMessageReceiveData;
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
    if (ev.event_type !== 'message_receive' || !ev.data) {
      return null;
    }
    const d = ev.data;
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
    return ['message', 'group', 'user'];
  }
}
