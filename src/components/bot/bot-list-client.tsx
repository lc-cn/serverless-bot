'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit, Copy } from 'lucide-react';
import { BotConfig } from '@/types';
import { FormUISchema, FormField } from '@/core';

interface BotListClientProps {
  platform: string;
  initialBots: BotConfig[];
  botConfigSchema?: FormUISchema;
}

export function BotListClient({ platform, initialBots, botConfigSchema }: BotListClientProps) {
  const router = useRouter();
  
  // 根据 schema 初始化配置对象
  const getInitialConfig = () => {
    if (!botConfigSchema?.fields) {
      return { accessToken: '', secret: '' }; // Fallback to Telegram defaults
    }
    const config: Record<string, string> = {};
    botConfigSchema.fields.forEach((field: FormField) => {
      config[field.name] = '';
    });
    return config;
  };

  const [bots, setBots] = useState<BotConfig[]>(initialBots);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotConfig | null>(null);
  const [newBot, setNewBot] = useState({
    name: '',
    id: '',
    config: getInitialConfig(),
  });

  const handleCreate = async () => {
    try {
      const res = await fetch(`/api/adapters/${platform}/bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBot),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        setNewBot({
          name: '',
          id: '',
          config: getInitialConfig(),
        });
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create bot:', error);
    }
  };

  const handleToggleEnabled = async (bot: BotConfig) => {
    try {
      const res = await fetch(`/api/adapters/${platform}/bots/${bot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !bot.enabled }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedBot) return;

    try {
      const res = await fetch(`/api/adapters/${platform}/bots/${selectedBot.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedBot(null);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete bot:', error);
    }
  };

  const copyWebhookUrl = (botId: string) => {
    const url = `${window.location.origin}/api/webhook/${platform}/${botId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreateOverlay(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加机器人
        </Button>
      </div>

      {bots.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">暂无机器人</div>
          <Button onClick={() => setShowCreateOverlay(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建第一个机器人
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {bots.map((bot) => (
            <Card key={bot.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{bot.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {bot.id}
                      </div>
                    </div>
                    <Badge variant={bot.enabled ? 'success' : 'secondary'}>
                      {bot.enabled ? '已启用' : '未启用'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bot.enabled}
                      onChange={() => handleToggleEnabled(bot)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyWebhookUrl(bot.id)}
                      title="复制 Webhook URL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Link href={`/adapter/${platform}/${bot.id}/edit`}>
                      <Button variant="ghost" size="icon" title="编辑配置">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/adapter/${platform}/${bot.id}`}>
                      <Button variant="ghost" size="icon" title="查看聊天">
                        📱
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedBot(bot);
                        setShowDeleteOverlay(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建机器人 Overlay */}
      <Overlay
        isOpen={showCreateOverlay}
        onClose={() => setShowCreateOverlay(false)}
        title="添加机器人"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">机器人名称 *</label>
            <Input
              value={newBot.name}
              onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
              placeholder="例如：我的机器人"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              机器人 ID（可选）
            </label>
            <Input
              value={newBot.id}
              onChange={(e) => setNewBot({ ...newBot, id: e.target.value })}
              placeholder="留空将自动生成"
            />
            <p className="text-sm text-muted-foreground mt-1">
              用于 Webhook URL 的标识符
            </p>
          </div>
          {botConfigSchema?.fields?.map((field: FormField) => (
            <div key={field.name}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <Input
                type={field.type || 'text'}
                value={(newBot.config[field.name] as string) || ''}
                onChange={(e) =>
                  setNewBot({
                    ...newBot,
                    config: { ...newBot.config, [field.name]: e.target.value },
                  })
                }
                placeholder={field.placeholder || ''}
              />
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCreateOverlay(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </div>
        </div>
      </Overlay>

      {/* 删除确认 Overlay */}
      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => setShowDeleteOverlay(false)}
        title="删除机器人"
      >
        <div className="space-y-4">
          <p>确定要删除机器人「{selectedBot?.name}」吗？此操作不可撤销。</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteOverlay(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
