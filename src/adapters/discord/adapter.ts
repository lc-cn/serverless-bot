import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature, WebhookResponse } from '@/core/adapter';
import { DiscordBot } from './bot';
import { BotConfig, BotEvent, MessageEvent, UserRole } from '@/types';
import { generateId } from '@/lib/utils';
import { DiscordEd25519 } from '@/lib/ed25519';

export class DiscordAdapter extends Adapter {
  constructor() {
    super('discord', 'Discord', 'Discord Bot API 适配器', '🎮');
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      token: z.string().min(1),
      publicKey: z.string().min(1),
    });
  }

  getAdapterConfigUISchema(): FormUISchema {
    return { fields: [] };
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'token',
          label: 'Bot Token',
          type: 'password',
          required: true,
          placeholder: '从 Discord Developer Portal 获取',
        },
        {
          name: 'publicKey',
          label: 'Public Key',
          type: 'password',
          required: true,
          placeholder: '从 Discord Developer Portal 获取',
        },
      ],
    };
  }

  createBot(config: BotConfig): DiscordBot {
    return new DiscordBot(config);
  }

  async parseEvent(botId: string, rawData: unknown, headers: Record<string, string>): Promise<BotEvent | null> {
    const interaction = rawData as any;

    if (interaction.type === 1) return null; // PING
    if (interaction.type === 2 && interaction.data?.type === 1) {
      return this.parseCommandEvent(botId, interaction);
    }
    if (interaction.type === 3) {
      return this.parseComponentEvent(botId, interaction);
    }
    return null;
  }

  private parseCommandEvent(botId: string, interaction: any): MessageEvent {
    const isGroup = !!interaction.guild_id;
    const cmdName = interaction.data?.name || '';
    const optVal = interaction.data?.options?.[0]?.value as string || '';

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'discord',
      botId,
      timestamp: new Date().getTime(),
      sender: {
        userId: interaction.member?.user.id || interaction.user?.id || '',
        nickname: interaction.member?.user.username || interaction.user?.username || '',
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: `/${cmdName} ${optVal}`.trim() } }],
      rawContent: `/${cmdName} ${optVal}`.trim(),
      groupId: isGroup ? interaction.guild_id : undefined,
      messageId: interaction.id,
      raw: interaction,
    };
  }

  private parseComponentEvent(botId: string, interaction: any): MessageEvent {
    const isGroup = !!interaction.guild_id;

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'discord',
      botId,
      timestamp: new Date().getTime(),
      sender: {
        userId: interaction.member?.user.id || interaction.user?.id || '',
        nickname: interaction.member?.user.username || interaction.user?.username || '',
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: interaction.data?.custom_id || '' } }],
      rawContent: interaction.data?.custom_id || '',
      groupId: isGroup ? interaction.guild_id : undefined,
      messageId: interaction.id,
      raw: interaction,
    };
  }

  async verifyWebhook(rawData: unknown, headers: Record<string, string>, config: Record<string, unknown>): Promise<boolean> {
    try {
      console.log('[Discord] verifyWebhook called with config:', JSON.stringify(config, null, 2));
      console.log('[Discord] config keys:', Object.keys(config));
      console.log('[Discord] config.publicKey:', config.publicKey);
      console.log('[Discord] config.token:', config.token);
      
      const publicKey = config.publicKey as string;
      
      // 如果没有配置 publicKey，允许通过（可能是初始设置）
      if (!publicKey) {
        console.warn('[Discord] Public Key not configured, allowing request');
        console.warn('[Discord] Full config received:', config);
        return true;
      }
      
      // 实现 Ed25519 签名验证
      // 参考: https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
      const signature = headers['x-signature-ed25519'] as string;
      const timestamp = headers['x-signature-timestamp'] as string;
      
      if (!signature || !timestamp) {
        console.error('[Discord] Missing signature or timestamp headers');
        return false;
      }
      
      // rawData 必须是原始的 JSON 字符串，不能是解析后的对象
      const body = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
      
      console.log('[Discord] Verifying signature with:');
      console.log('  timestamp:', timestamp);
      console.log('  signature (first 20 chars):', signature.substring(0, 20) + '...');
      console.log('  body length:', body.length);
      
      // 使用 @noble/curves 的 Ed25519 验证签名
      const isValid = DiscordEd25519.verify(publicKey, signature, timestamp, body);
      
      if (isValid) {
        console.log('[Discord] ✓ Webhook signature verification PASSED');
        return true;
      } else {
        console.error('[Discord] ✗ Webhook signature verification FAILED: signature mismatch');
        return false;
      }
    } catch (error) {
      console.error('[Discord] Webhook verification error:', error);
      return false;
    }
  }

  getWebhookResponse(interaction?: any): WebhookResponse {
    // Discord PING 事件需要返回特定格式
    console.log('[Discord] getWebhookResponse called with interaction:', interaction);
    console.log('[Discord] interaction.type:', interaction?.type);
    
    if (interaction?.type === 1) {
      // 返回 PONG (type: 1) - 这是 Discord 文档中 PING 的标准响应
      // 参考: https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction
      const response = {
        status: 200,
        body: { type: 1 },
        headers: { 'Content-Type': 'application/json' },
      };
      console.log('[Discord] Returning PONG response to PING:', response);
      return response;
    }
    // 其他交互返回 5 (ACK with defer - 延迟响应)
    const response = {
      status: 200,
      body: { type: 5 },
      headers: { 'Content-Type': 'application/json' },
    };
    console.log('[Discord] Returning default response:', response);
    return response;
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user'];
  }
}
