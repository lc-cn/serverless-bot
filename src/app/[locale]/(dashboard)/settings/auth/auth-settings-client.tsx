'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import type { AuthSettings } from '@/lib/auth';

const TEMPLATE_KEYS = ['verification', 'passwordReset', 'generic'] as const;
type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function AuthSettingsClient() {
  const t = useTranslations('AuthSettingsPage');
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [ghClientId, setGhClientId] = useState('');
  const [ghClientSecret, setGhClientSecret] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/auth-settings');
      const d = await r.json();
      if (r.ok) {
        setSettings(d.settings);
        setSmtpPassword('');
        setGhClientId(d.settings?.providers?.github?.clientId ?? '');
        setGhClientSecret('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/auth-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || t('saveFailed'));
        return;
      }
      setSettings(d.settings);
      setSmtpPassword('');
      setGhClientId(d.settings?.providers?.github?.clientId ?? '');
      setGhClientSecret('');
      setMsg(t('saved'));
    } finally {
      setSaving(false);
    }
  };

  const saveEmailBlock = async (email: AuthSettings['email']) => {
    const smtp: Record<string, unknown> = {
      host: email.smtp.host,
      port: email.smtp.port,
      secure: email.smtp.secure,
      user: email.smtp.user,
      fromEmail: email.smtp.fromEmail,
      fromName: email.smtp.fromName,
    };
    if (smtpPassword.trim().length > 0) {
      smtp.password = smtpPassword;
    }
    await patch({
      email: {
        enabled: email.enabled,
        smtp,
        templates: email.templates,
      },
    });
  };

  const sendTest = async () => {
    setTestMsg(null);
    if (!testTo.trim()) {
      setTestMsg(t('testEmailNeedTo'));
      return;
    }
    setTestSending(true);
    try {
      const r = await fetch('/api/admin/auth-settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setTestMsg(d.detail || d.error || t('testEmailFailed'));
        return;
      }
      setTestMsg(t('testEmailOk'));
    } finally {
      setTestSending(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const gh = settings.providers.github;
  const pk = settings.providers.passkey;

  const saveGithubOAuth = () => {
    void patch({
      providers: {
        github: {
          clientId: ghClientId.trim() || null,
          ...(ghClientSecret.trim() ? { clientSecret: ghClientSecret.trim() } : {}),
        },
      },
    });
  };
  const em = settings.email;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t('globalTitle')}</CardTitle>
          <CardDescription>{t('globalDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="reg">{t('registrationEnabled')}</Label>
            <Switch
              id="reg"
              checked={settings.registrationEnabled}
              onCheckedChange={(v) => void patch({ registrationEnabled: v })}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <EmailSettingsCard
        em={em}
        saving={saving}
        smtpPassword={smtpPassword}
        setSmtpPassword={setSmtpPassword}
        testTo={testTo}
        setTestTo={setTestTo}
        testSending={testSending}
        testMsg={testMsg}
        onPatch={patch}
        onSaveBlock={saveEmailBlock}
        onSendTest={sendTest}
        t={t}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('githubTitle')}</CardTitle>
          <CardDescription>{t('githubDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ghe">{t('providerEnabled')}</Label>
            <Switch
              id="ghe"
              checked={gh.enabled}
              onCheckedChange={(v) =>
                void patch({ providers: { github: { enabled: v } } })
              }
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ghb">{t('allowBind')}</Label>
            <Switch
              id="ghb"
              checked={gh.allowBind}
              onCheckedChange={(v) =>
                void patch({ providers: { github: { allowBind: v } } })
              }
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ghs">{t('allowSignup')}</Label>
            <Switch
              id="ghs"
              checked={gh.allowSignup}
              onCheckedChange={(v) =>
                void patch({ providers: { github: { allowSignup: v } } })
              }
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-client-id">{t('githubClientId')}</Label>
            <Input
              id="gh-client-id"
              value={ghClientId}
              onChange={(e) => setGhClientId(e.target.value)}
              placeholder={t('githubClientIdPlaceholder')}
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-client-secret">{t('githubClientSecret')}</Label>
            <Input
              id="gh-client-secret"
              type="password"
              value={ghClientSecret}
              onChange={(e) => setGhClientSecret(e.target.value)}
              placeholder={t('githubClientSecretPlaceholder')}
              autoComplete="new-password"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{t('githubClientSecretHint')}</p>
          </div>
          <Button type="button" variant="secondary" onClick={saveGithubOAuth} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('saveGithubOAuth')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('passkeyTitle')}</CardTitle>
          <CardDescription>{t('passkeyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="pke">{t('providerEnabled')}</Label>
            <Switch
              id="pke"
              checked={pk.enabled}
              onCheckedChange={(v) =>
                void patch({ providers: { passkey: { enabled: v } } })
              }
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pkb">{t('allowBind')}</Label>
            <Switch
              id="pkb"
              checked={pk.allowBind}
              onCheckedChange={(v) =>
                void patch({ providers: { passkey: { allowBind: v } } })
              }
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pks">{t('allowSignup')}</Label>
            <Switch
              id="pks"
              checked={pk.allowSignup}
              onCheckedChange={(v) =>
                void patch({ providers: { passkey: { allowSignup: v } } })
              }
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={() => void load()} disabled={saving}>
          {t('reload')}
        </Button>
        <p className="text-sm text-muted-foreground">
          <Link href="/settings/platform" className="text-primary underline-offset-4 hover:underline">
            {t('linkToPlatform')}
          </Link>
        </p>
      </div>
    </div>
  );
}

function EmailSettingsCard({
  em,
  saving,
  smtpPassword,
  setSmtpPassword,
  testTo,
  setTestTo,
  testSending,
  testMsg,
  onPatch,
  onSaveBlock,
  onSendTest,
  t,
}: {
  em: AuthSettings['email'];
  saving: boolean;
  smtpPassword: string;
  setSmtpPassword: (v: string) => void;
  testTo: string;
  setTestTo: (v: string) => void;
  testSending: boolean;
  testMsg: string | null;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onSaveBlock: (email: AuthSettings['email']) => Promise<void>;
  onSendTest: () => Promise<void>;
  t: (key: string) => string;
}) {
  const [draft, setDraft] = useState(em);

  useEffect(() => {
    setDraft(em);
  }, [em]);

  const setTpl = (key: TemplateKey, field: 'subject' | 'html' | 'text', value: string) => {
    setDraft((d) => ({
      ...d,
      templates: {
        ...d.templates,
        [key]: { ...d.templates[key], [field]: value },
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('emailTitle')}</CardTitle>
        <CardDescription>{t('emailDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="em-enabled">{t('emailEnabled')}</Label>
          <Switch
            id="em-enabled"
            checked={draft.enabled}
            onCheckedChange={(v) => {
              setDraft((d) => ({ ...d, enabled: v }));
              void onPatch({ email: { enabled: v } });
            }}
            disabled={saving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="smtp-host">{t('smtpHost')}</Label>
            <Input
              id="smtp-host"
              value={draft.smtp.host}
              onChange={(e) =>
                setDraft((d) => ({ ...d, smtp: { ...d.smtp, host: e.target.value } }))
              }
              placeholder="smtp.example.com"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-port">{t('smtpPort')}</Label>
            <Input
              id="smtp-port"
              type="number"
              min={1}
              max={65535}
              value={draft.smtp.port}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  smtp: { ...d.smtp, port: Number(e.target.value) || 587 },
                }))
              }
              disabled={saving}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Switch
              id="smtp-secure"
              checked={draft.smtp.secure}
              onCheckedChange={(v) =>
                setDraft((d) => ({ ...d, smtp: { ...d.smtp, secure: v } }))
              }
              disabled={saving}
            />
            <Label htmlFor="smtp-secure">{t('smtpSecure')}</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">{t('smtpUser')}</Label>
            <Input
              id="smtp-user"
              value={draft.smtp.user}
              onChange={(e) =>
                setDraft((d) => ({ ...d, smtp: { ...d.smtp, user: e.target.value } }))
              }
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-pass">{t('smtpPassword')}</Label>
            <Input
              id="smtp-pass"
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder={t('smtpPasswordPlaceholder')}
              autoComplete="new-password"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">{t('smtpPasswordHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-from">{t('smtpFromEmail')}</Label>
            <Input
              id="smtp-from"
              type="email"
              value={draft.smtp.fromEmail}
              onChange={(e) =>
                setDraft((d) => ({ ...d, smtp: { ...d.smtp, fromEmail: e.target.value } }))
              }
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-from-name">{t('smtpFromName')}</Label>
            <Input
              id="smtp-from-name"
              value={draft.smtp.fromName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, smtp: { ...d.smtp, fromName: e.target.value } }))
              }
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('emailTemplates')}</Label>
          <Tabs defaultValue="verification" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              {TEMPLATE_KEYS.map((key) => (
                <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                  {t(`templateTab_${key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {TEMPLATE_KEYS.map((key) => (
              <TabsContent key={key} value={key} className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">{t(`templateHint_${key}`)}</p>
                <div className="space-y-2">
                  <Label htmlFor={`sub-${key}`}>{t('templateSubject')}</Label>
                  <Input
                    id={`sub-${key}`}
                    value={draft.templates[key].subject}
                    onChange={(e) => setTpl(key, 'subject', e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`html-${key}`}>{t('templateHtml')}</Label>
                  <Textarea
                    id={`html-${key}`}
                    rows={6}
                    value={draft.templates[key].html}
                    onChange={(e) => setTpl(key, 'html', e.target.value)}
                    disabled={saving}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`text-${key}`}>{t('templateText')}</Label>
                  <Textarea
                    id={`text-${key}`}
                    rows={4}
                    value={draft.templates[key].text}
                    onChange={(e) => setTpl(key, 'text', e.target.value)}
                    disabled={saving}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void onSaveBlock(draft)} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('saveEmail')}
              </>
            ) : (
              t('saveEmail')
            )}
          </Button>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">{t('testEmailTitle')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="test-to">{t('testEmailTo')}</Label>
              <Input
                id="test-to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                disabled={testSending || saving}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onSendTest()}
              disabled={testSending || saving || !draft.enabled}
            >
              {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('testEmailSend')}
            </Button>
          </div>
          {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}
          <p className="text-xs text-muted-foreground">{t('testEmailHint')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
