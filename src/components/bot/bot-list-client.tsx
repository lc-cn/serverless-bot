'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
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
  /** 默认 true；为 false 时隐藏列表顶部「添加 Bot」按钮（由页面页眉等触发创建） */
  showTopAddBar?: boolean;
  /** 与 onCreateOverlayOpenChange 同时传入时，创建弹层由外部控制 */
  createOverlayOpen?: boolean;
  onCreateOverlayOpenChange?: (open: boolean) => void;
}

export function BotListClient({
  platform,
  initialBots,
  botConfigSchema,
  showTopAddBar = true,
  createOverlayOpen,
  onCreateOverlayOpenChange,
}: BotListClientProps) {
  const t = useTranslations('Ui');
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
  const isCreateControlled =
    createOverlayOpen !== undefined && onCreateOverlayOpenChange !== undefined;
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const showCreateOverlay = isCreateControlled ? createOverlayOpen! : internalCreateOpen;
  const setShowCreateOverlay = (open: boolean) => {
    if (isCreateControlled) onCreateOverlayOpenChange!(open);
    else setInternalCreateOpen(open);
  };
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
      {showTopAddBar ? (
        <div className="mb-6 flex justify-end">
          <Button type="button" onClick={() => setShowCreateOverlay(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addBot')}
          </Button>
        </div>
      ) : null}

      {bots.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">{t('emptyBots')}</div>
          <Button type="button" onClick={() => setShowCreateOverlay(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createFirstBot')}
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
                      {bot.enabled ? t('enabled') : t('disabled')}
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
                      title={t('copyWebhookUrl')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Link href={`/adapter/${platform}/${bot.id}/edit`}>
                      <Button variant="ghost" size="icon" title={t('editConfig')}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/adapter/${platform}/${bot.id}`}>
                      <Button variant="ghost" size="icon" title={t('viewChat')}>
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
        title={t('overlayAddBot')}
      >
        <div className="min-w-0 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('botNameLabel')}</label>
            <Input
              value={newBot.name}
              onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
              placeholder={t('botNamePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('botIdOptional')}</label>
            <Input
              value={newBot.id}
              onChange={(e) => setNewBot({ ...newBot, id: e.target.value })}
              placeholder={t('botIdAuto')}
            />
            <p className="text-sm text-muted-foreground mt-1">{t('botIdHint')}</p>
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
              {t('cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('create')}</Button>
          </div>
        </div>
      </Overlay>

      {/* 删除确认 Overlay */}
      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => setShowDeleteOverlay(false)}
        title={t('titleDeleteBot')}
      >
        <div className="space-y-4">
          <p>{t('confirmDeleteNamed', { name: selectedBot?.name ?? '' })}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteOverlay(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('delete')}
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
