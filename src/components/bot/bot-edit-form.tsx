'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Save, Copy } from 'lucide-react';
import { BotConfig } from '@/types';
import { FormUISchema, FormField } from '@/core';

interface BotEditFormProps {
  platform: string;
  bot: BotConfig;
  botConfigSchema?: FormUISchema;
}

export function BotEditForm({ platform, bot, botConfigSchema }: BotEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>(bot.config || {});
  const [name, setName] = useState(bot.name);
  const [enabled, setEnabled] = useState(bot.enabled);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/adapters/${platform}/bots/${bot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled, config }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to save bot:', error);
    } finally {
      setSaving(false);
    }
  };

  const getWebhookUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/webhook/${platform}/${bot.id}`;
    }
    return `/api/webhook/${platform}/${bot.id}`;
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded-md bg-muted text-sm break-all">
              {getWebhookUrl()}
            </code>
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            将此 URL 配置到对应平台的 Webhook 设置中
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">机器人名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="机器人名称"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">启用机器人</div>
              <div className="text-sm text-muted-foreground">
                禁用后将不再处理该机器人的事件
              </div>
            </div>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>机器人配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {botConfigSchema?.fields?.map((field: FormField) => (
            <div key={field.name}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </label>
              <Input
                type={field.type || 'text'}
                value={(config[field.name] as string) || ''}
                onChange={(e) =>
                  setConfig({ ...config, [field.name]: e.target.value })
                }
                placeholder={field.placeholder || ''}
              />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存配置'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
