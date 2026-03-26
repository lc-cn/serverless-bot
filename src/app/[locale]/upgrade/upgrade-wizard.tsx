'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { InstallPhase } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export function UpgradeWizard({ initialLastAppliedMigration }: { initialLastAppliedMigration: string | null }) {
  const t = useTranslations('UpgradeWizard');
  const router = useRouter();
  const [lastAppliedMigration, setLastAppliedMigration] = useState<string | null>(initialLastAppliedMigration);
  const [installSecret, setInstallSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const installAuthHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (installSecret.trim()) h['x-install-secret'] = installSecret.trim();
    return h;
  }, [installSecret]);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/install/status', { cache: 'no-store' });
    const d = await r.json();
    const p = d.phase as InstallPhase | undefined;
    if (p === 'installed') {
      router.replace('/');
      return;
    }
    if (p === 'no_database' || p === 'needs_install') {
      router.replace('/install');
      return;
    }
    if (typeof d.lastAppliedMigration === 'string' || d.lastAppliedMigration === null) {
      setLastAppliedMigration(d.lastAppliedMigration);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runUpgrade() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/install/complete', { method: 'POST', headers: installAuthHeaders });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.message || data.error || (data.errors && data.errors.join?.('\n')) || JSON.stringify(data));
        return;
      }
      setMsg(data.message || t('upgradeSuccess'));
      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const codeCls = 'text-xs font-mono';

  return (
    <Card className="max-w-lg w-full">
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium mb-1">{t('migrationHeading')}</p>
          <p className="text-muted-foreground font-mono text-xs break-all">
            {lastAppliedMigration ?? t('migrationUnknown')}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('installSecretLabel')}</p>
          <Input
            placeholder={t('installSecretPlaceholder')}
            value={installSecret}
            onChange={(e) => setInstallSecret(e.target.value)}
            type="password"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {t.rich('installSecretHint', {
              path: (chunks) => <code className={codeCls}>{chunks}</code>,
              c1: (chunks) => <code className={codeCls}>{chunks}</code>,
              c2: (chunks) => <code className={codeCls}>{chunks}</code>,
            })}
          </p>
        </div>

        {msg && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{msg}</p>
        )}
        {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={busy}>
          {t('refreshStatus')}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void runUpgrade()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t('runUpgrade')}
        </Button>
      </CardFooter>
    </Card>
  );
}
