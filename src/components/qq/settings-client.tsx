'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check, ExternalLink } from 'lucide-react';

type BotItem = { id: string; name: string; config: Record<string, unknown> };

type Props = {
  bots: BotItem[];
};

export function QQSettingsClient({ bots }: Props) {
  const t = useTranslations('QQSettings');
  const [selectedBot, setSelectedBot] = useState(bots[0]?.id || '');
  const [copied, setCopied] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhook/qq/${selectedBot}`
      : `/api/webhook/qq/${selectedBot}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('selectBot')}</label>
        <select
          className="w-full rounded border px-3 py-2 bg-background"
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.id})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">{t('webhookHeading')}</h3>
        <p className="text-sm text-muted-foreground">{t('webhookHint')}</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            className="flex-1 rounded border bg-muted px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded border px-3 py-2 hover:bg-muted transition-colors"
            aria-label={t('webhookHeading')}
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">{t('intentsHeading')}</h3>
        <p className="text-sm text-muted-foreground">{t('intentsIntro')}</p>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">GROUP_AND_C2C_EVENT</code>
            <span className="text-muted-foreground">{t('intentGroupC2c')}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">PUBLIC_GUILD_MESSAGES</code>
            <span className="text-muted-foreground">{t('intentGuildMessages')}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">DIRECT_MESSAGE</code>
            <span className="text-muted-foreground">{t('intentDirectMessage')}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">INTERACTION</code>
            <span className="text-muted-foreground">{t('intentInteraction')}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">{t('limitsHeading')}</h3>
        <div className="text-sm space-y-2 text-muted-foreground">
          <p>{t('limitDm')}</p>
          <p>{t('limitGroup')}</p>
          <p>{t('limitGuild')}</p>
          <p className="text-xs">{t('limitDeprecated')}</p>
        </div>
      </div>

      <a
        href="https://q.qq.com/qqbot/#/developer/webhook-setting"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        {t('openConsole')}
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
