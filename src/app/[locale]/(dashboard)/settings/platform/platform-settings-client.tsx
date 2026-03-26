'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { PlatformSettings } from '@/lib/platform-settings';

export function PlatformSettingsClient() {
  const t = useTranslations('PlatformSettingsPage');
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/platform-settings');
      const d = await r.json();
      if (r.ok) {
        setDraft(d.settings as PlatformSettings);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowProcessBudgetMs: draft.flowProcessBudgetMs,
          flowStopAfterFirstMatch: draft.flowStopAfterFirstMatch,
          webhookMaxDurationSec: draft.webhookMaxDurationSec,
          webhookFlowAsync: draft.webhookFlowAsync,
          webhookFlowDedupeOnSuccessOnly: draft.webhookFlowDedupeOnSuccessOnly,
          webhookFlowQueueMax: draft.webhookFlowQueueMax,
          flowWorkerDlqMax: draft.flowWorkerDlqMax,
          flowWorkerMaxAttempts: draft.flowWorkerMaxAttempts,
          flowWorkerRetryDelayMs: draft.flowWorkerRetryDelayMs,
          webhookFlowDedupeTtlSec: draft.webhookFlowDedupeTtlSec,
          flowWorkerBatch: draft.flowWorkerBatch,
          callApiDefaultTimeoutMs: draft.callApiDefaultTimeoutMs,
          callApiMaxTimeoutMs: draft.callApiMaxTimeoutMs,
          llmAgentMaxToolRounds: draft.llmAgentMaxToolRounds,
          chatSqlRequired: draft.chatSqlRequired,
          sessionUserCheckIntervalMs: draft.sessionUserCheckIntervalMs,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || t('saveFailed'));
        return;
      }
      setDraft(d.settings);
      setMsg(t('saved'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const n = (key: keyof PlatformSettings, v: string, min: number, max: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return;
    setDraft((d) => (d ? { ...d, [key]: Math.min(max, Math.max(min, Math.floor(x))) } : d));
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t('flowTitle')}</CardTitle>
          <CardDescription>{t('flowDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('flowProcessBudgetMs')}</Label>
            <Input
              type="number"
              min={0}
              value={draft.flowProcessBudgetMs}
              onChange={(e) => n('flowProcessBudgetMs', e.target.value, 0, 86_400_000)}
            />
          </div>
          <div className="flex items-center justify-between sm:col-span-2">
            <Label htmlFor="fs">{t('flowStopAfterFirstMatch')}</Label>
            <Switch
              id="fs"
              checked={draft.flowStopAfterFirstMatch}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, flowStopAfterFirstMatch: v } : d))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('webhookTitle')}</CardTitle>
          <CardDescription>{t('webhookDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('webhookMaxDurationSec')}</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={draft.webhookMaxDurationSec}
              onChange={(e) => n('webhookMaxDurationSec', e.target.value, 1, 300)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="wfa">{t('webhookFlowAsync')}</Label>
            <Switch
              id="wfa"
              checked={draft.webhookFlowAsync}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, webhookFlowAsync: v } : d))}
            />
          </div>
          <div className="flex items-center justify-between sm:col-span-2">
            <Label htmlFor="wfd">{t('webhookFlowDedupeOnSuccessOnly')}</Label>
            <Switch
              id="wfd"
              checked={draft.webhookFlowDedupeOnSuccessOnly}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, webhookFlowDedupeOnSuccessOnly: v } : d))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('webhookFlowQueueMax')}</Label>
            <Input
              type="number"
              min={11}
              value={draft.webhookFlowQueueMax}
              onChange={(e) => n('webhookFlowQueueMax', e.target.value, 11, 1_000_000)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('flowWorkerDlqMax')}</Label>
            <Input
              type="number"
              min={11}
              value={draft.flowWorkerDlqMax}
              onChange={(e) => n('flowWorkerDlqMax', e.target.value, 11, 500_000)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('flowWorkerMaxAttempts')}</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={draft.flowWorkerMaxAttempts}
              onChange={(e) => n('flowWorkerMaxAttempts', e.target.value, 1, 50)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('flowWorkerRetryDelayMs')}</Label>
            <Input
              type="number"
              min={0}
              value={draft.flowWorkerRetryDelayMs}
              onChange={(e) => n('flowWorkerRetryDelayMs', e.target.value, 0, 3_600_000)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('webhookFlowDedupeTtlSec')}</Label>
            <Input
              type="number"
              min={61}
              value={draft.webhookFlowDedupeTtlSec}
              onChange={(e) => n('webhookFlowDedupeTtlSec', e.target.value, 61, 86_400 * 30)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('flowWorkerBatch')}</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={draft.flowWorkerBatch}
              onChange={(e) => n('flowWorkerBatch', e.target.value, 1, 50)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('stepsTitle')}</CardTitle>
          <CardDescription>{t('stepsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('callApiDefaultTimeoutMs')}</Label>
            <Input
              type="number"
              min={1}
              value={draft.callApiDefaultTimeoutMs}
              onChange={(e) => n('callApiDefaultTimeoutMs', e.target.value, 1, 3_600_000)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('callApiMaxTimeoutMs')}</Label>
            <Input
              type="number"
              min={1}
              placeholder={t('callApiMaxPlaceholder')}
              value={draft.callApiMaxTimeoutMs ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        callApiMaxTimeoutMs:
                          v === '' ? null : Math.min(3_600_000, Math.max(1, Math.floor(Number(v)))),
                      }
                    : d,
                );
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('llmAgentMaxToolRounds')}</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={draft.llmAgentMaxToolRounds}
              onChange={(e) => n('llmAgentMaxToolRounds', e.target.value, 1, 100)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sessionTitle')}</CardTitle>
          <CardDescription>{t('sessionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('sessionUserCheckIntervalMs')}</Label>
            <Input
              type="number"
              min={10000}
              value={draft.sessionUserCheckIntervalMs}
              onChange={(e) => n('sessionUserCheckIntervalMs', e.target.value, 10_000, 86_400_000)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="csr">{t('chatSqlRequired')}</Label>
            <Switch
              id="csr"
              checked={draft.chatSqlRequired}
              onCheckedChange={(v) => setDraft((d) => (d ? { ...d, chatSqlRequired: v } : d))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('save')}
        </Button>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
          {t('reload')}
        </Button>
      </div>
    </div>
  );
}
