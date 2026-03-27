'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { InstallPhase } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

function randomBase64Url(length: number): string {
  const a = new Uint8Array(length);
  crypto.getRandomValues(a);
  let s = '';
  const tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < a.length; i++) {
    s += tab[a[i] % tab.length];
  }
  return s;
}

type LibsqlEnvInfo = {
  binding: 'libsql' | 'turso' | null;
  tokenPresent: boolean;
  canConnect: boolean;
};

export function InstallWizard({
  initialPhase,
  initialLibsqlEnv,
}: {
  initialPhase: InstallPhase;
  initialLibsqlEnv?: LibsqlEnvInfo;
}) {
  const t = useTranslations('InstallWizard');
  const router = useRouter();
  const [phase, setPhase] = useState<InstallPhase>(initialPhase);
  const [installSecret, setInstallSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [libsqlEnv, setLibsqlEnv] = useState<LibsqlEnvInfo | null>(() => initialLibsqlEnv ?? null);

  const [nextAuthUrl, setNextAuthUrl] = useState('');
  const [nextAuthSecret, setNextAuthSecret] = useState('');
  const [libsqlUrl, setLibsqlUrl] = useState('');
  const [libsqlToken, setLibsqlToken] = useState('');
  const [sqlitePath, setSqlitePath] = useState('file:./data.db');
  const [redisUrl, setRedisUrl] = useState('');
  const [redisToken, setRedisToken] = useState('');
  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjectId, setVercelProjectId] = useState('');
  const [vercelTeamId, setVercelTeamId] = useState('');
  const [useRemoteLibsql, setUseRemoteLibsql] = useState(true);

  useEffect(() => {
    setNextAuthUrl((u) => u || (typeof window !== 'undefined' ? window.location.origin : ''));
  }, []);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/install/status', { cache: 'no-store' });
    const d = await r.json();
    const p = d.phase as InstallPhase | undefined;
    setLibsqlEnv(
      (d.libsqlEnv as LibsqlEnvInfo | undefined) ?? {
        binding: null,
        tokenPresent: false,
        canConnect: Boolean(d.databaseConfigured),
      },
    );
    if (p === 'needs_upgrade') {
      router.replace('/upgrade');
      return;
    }
    if (p === 'installed' || p === 'needs_install' || p === 'no_database') {
      setPhase(p);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const installAuthHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (installSecret.trim()) h['x-install-secret'] = installSecret.trim();
    return h;
  }, [installSecret]);

  const dbFromPlatform = Boolean(libsqlEnv?.binding);

  const envBlock = useMemo(() => {
    const lines: string[] = [];
    if (dbFromPlatform) {
      lines.push(
        libsqlEnv?.binding === 'turso'
          ? '# DB: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN（已由平台注入时可省略）'
          : '# DB: LIBSQL_URL + LIBSQL_AUTH_TOKEN（已由平台注入时可省略）',
      );
    } else if (useRemoteLibsql && libsqlUrl.trim()) {
      lines.push(`TURSO_DATABASE_URL=${libsqlUrl.trim()}`);
      if (libsqlToken.trim()) lines.push(`TURSO_AUTH_TOKEN=${libsqlToken.trim()}`);
    } else if (!useRemoteLibsql && sqlitePath.trim()) {
      lines.push('DATABASE_ENGINE=nodejs-sqlite');
      lines.push(`SQLITE_PATH=${sqlitePath.trim()}`);
    }
    if (nextAuthUrl.trim()) lines.push(`NEXTAUTH_URL=${nextAuthUrl.trim()}`);
    if (nextAuthSecret.trim()) lines.push(`NEXTAUTH_SECRET=${nextAuthSecret.trim()}`);
    if (redisUrl.trim()) lines.push(`KV_REST_API_URL=${redisUrl.trim()}`);
    if (redisToken.trim()) lines.push(`KV_REST_API_TOKEN=${redisToken.trim()}`);
    return lines.join('\n');
  }, [
    dbFromPlatform,
    libsqlEnv?.binding,
    useRemoteLibsql,
    libsqlUrl,
    libsqlToken,
    sqlitePath,
    nextAuthUrl,
    nextAuthSecret,
    redisUrl,
    redisToken,
  ]);

  const genSecret = () => setNextAuthSecret(randomBase64Url(43));

  async function runVercelPush() {
    setBusy('vercel');
    setErr(null);
    setMsg(null);
    try {
      const variables: Record<string, string> = {};
      if (!dbFromPlatform && useRemoteLibsql && libsqlUrl.trim()) {
        variables.TURSO_DATABASE_URL = libsqlUrl.trim();
      }
      if (!dbFromPlatform && useRemoteLibsql && libsqlToken.trim()) {
        variables.TURSO_AUTH_TOKEN = libsqlToken.trim();
      }
      if (!dbFromPlatform && !useRemoteLibsql && sqlitePath.trim()) {
        variables.DATABASE_ENGINE = 'nodejs-sqlite';
        variables.SQLITE_PATH = sqlitePath.trim();
      }
      if (nextAuthUrl.trim()) variables.NEXTAUTH_URL = nextAuthUrl.trim();
      if (nextAuthSecret.trim()) variables.NEXTAUTH_SECRET = nextAuthSecret.trim();
      if (redisUrl.trim()) variables.KV_REST_API_URL = redisUrl.trim();
      if (redisToken.trim()) variables.KV_REST_API_TOKEN = redisToken.trim();
      const r = await fetch('/api/install/vercel-env', {
        method: 'POST',
        headers: { ...installAuthHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: vercelToken.trim(),
          projectId: vercelProjectId.trim(),
          teamId: vercelTeamId.trim() || undefined,
          variables,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErr(
          Array.isArray(data.details)
            ? data.details.join('\n')
            : data.error || data.message || t('requestFailed'),
        );
        return;
      }
      setMsg(data.message || t('synced'));
    } finally {
      setBusy(null);
    }
  }

  async function runBootstrap() {
    setBusy('db');
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/install/complete', { method: 'POST', headers: installAuthHeaders });
      const data = await r.json();
      if (!r.ok) {
        setErr(data.message || data.error || (data.errors && data.errors.join?.('\n')) || JSON.stringify(data));
        return;
      }
      setMsg(data.message || t('installSuccess'));
      setPhase('installed');
      router.push(`/sign-in?${new URLSearchParams({ callbackUrl: '/dashboard' }).toString()}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (phase === 'installed') {
    return (
      <Card className="max-w-lg w-full border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <CardHeader>
          <CardTitle>{t('titleDone')}</CardTitle>
          <CardDescription>{t('descRedirecting')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const canRunDb = phase === 'needs_install';

  const codeCls = 'text-xs font-mono';

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle className="text-2xl">{t('titleWelcome')}</CardTitle>
        <CardDescription>
          {t.rich('intro', {
            first: (chunks) => <strong>{chunks}</strong>,
            second: (chunks) => <strong>{chunks}</strong>,
            upgrade: (chunks) => <span className="font-medium">{chunks}</span>,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium mb-1">{t('statusHeading')}</p>
          <p className="text-muted-foreground">
            {phase === 'no_database' && t('phaseNoDb')}
            {phase === 'needs_install' && t('phaseNeedsInstall')}
            {phase === 'needs_upgrade' && t('phaseNeedsUpgrade')}
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
              c1: (chunks) => <code className={codeCls}>{chunks}</code>,
              c2: (chunks) => <code className={codeCls}>{chunks}</code>,
              c3: (chunks) => <code className={codeCls}>{chunks}</code>,
            })}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('databaseHeading')}</p>
          {dbFromPlatform ? (
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-3 text-sm space-y-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="font-medium text-foreground">
                {libsqlEnv?.binding === 'turso' ? t('dbInjectedTursoTitle') : t('dbInjectedLibsqlTitle')}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {libsqlEnv?.binding === 'turso' ? t('dbInjectedTursoBody') : t('dbInjectedLibsqlBody')}
              </p>
              {!libsqlEnv?.canConnect && (
                <p className="text-destructive text-xs font-medium">{t('dbInjectedMissingToken')}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={useRemoteLibsql} onChange={() => setUseRemoteLibsql(true)} />
                  {t('dbLibsql')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!useRemoteLibsql} onChange={() => setUseRemoteLibsql(false)} />
                  {t('dbSqlite')}
                </label>
              </div>
              {useRemoteLibsql ? (
                <div className="space-y-2">
                  <Input
                    placeholder={t('placeholderLibsqlUrl')}
                    value={libsqlUrl}
                    onChange={(e) => setLibsqlUrl(e.target.value)}
                  />
                  <Input
                    placeholder={t('placeholderLibsqlToken')}
                    value={libsqlToken}
                    onChange={(e) => setLibsqlToken(e.target.value)}
                    type="password"
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder={t('placeholderSqlitePath')}
                    value={sqlitePath}
                    onChange={(e) => setSqlitePath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('sqliteHint')}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('nextAuthHeading')}</p>
          <Input
            placeholder={t('placeholderNextAuthUrl')}
            value={nextAuthUrl}
            onChange={(e) => setNextAuthUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder={t('placeholderNextAuthSecret')}
              value={nextAuthSecret}
              onChange={(e) => setNextAuthSecret(e.target.value)}
              type="password"
              autoComplete="off"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={genSecret}>
              {t('generateSecret')}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('redisHeading')}</p>
          <Input
            placeholder={t('placeholderRedisUrl')}
            value={redisUrl}
            onChange={(e) => setRedisUrl(e.target.value)}
          />
          <Input
            placeholder={t('placeholderRedisToken')}
            value={redisToken}
            onChange={(e) => setRedisToken(e.target.value)}
            type="password"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('envBlockHeading')}</p>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            readOnly
            value={envBlock || t('envBlockEmpty')}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">{t('vercelHeading')}</p>
          <p className="text-xs text-muted-foreground">{t('vercelHint')}</p>
          {dbFromPlatform && (
            <p className="text-xs text-emerald-800 dark:text-emerald-300">{t('vercelSkipDb')}</p>
          )}
          <Input
            placeholder={t('placeholderVercelToken')}
            value={vercelToken}
            onChange={(e) => setVercelToken(e.target.value)}
            type="password"
            autoComplete="off"
          />
          <Input
            placeholder={t('placeholderProjectId')}
            value={vercelProjectId}
            onChange={(e) => setVercelProjectId(e.target.value)}
          />
          <Input
            placeholder={t('placeholderTeamId')}
            value={vercelTeamId}
            onChange={(e) => setVercelTeamId(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!!busy}
            className="inline-flex items-center gap-2"
            onClick={() => void runVercelPush()}
          >
            {busy === 'vercel' ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
            {t('pushVercel')}
          </Button>
        </div>

        {msg && <p className="text-sm text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{msg}</p>}
        {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={!!busy}>
          {t('refreshStatus')}
        </Button>
        <Button type="button" disabled={!canRunDb || !!busy} onClick={() => void runBootstrap()}>
          {busy === 'db' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t('bootstrapDb')}
        </Button>
      </CardFooter>
    </Card>
  );
}
