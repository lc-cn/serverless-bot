'use client';

import { useLocale, useTranslations } from 'next-intl';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from '@/i18n/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Github, Shield, Fingerprint, Loader2 } from 'lucide-react';

interface ProfileClientProps {
  user: {
    id: string;
    name: string;
    username?: string;
    email?: string;
    image?: string;
    roleIds: string[];
    roles: string[];
    hasGithub: boolean;
  };
  passkeys: { id: string; deviceName: string | null; createdAt: string | null }[];
}

export function ProfileClient({ user, passkeys: initialPasskeys }: ProfileClientProps) {
  const locale = useLocale();
  const router = useRouter();
  const tProfile = useTranslations('Dashboard.profile');
  const tCommon = useTranslations('Common');
  const ui = useTranslations('Ui');
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [busy, setBusy] = useState<string | null>(null);
  const [cfg, setCfg] = useState<{
    github: { enabled: boolean; allowBind: boolean };
    passkey: { enabled: boolean; allowBind: boolean };
  } | null>(null);

  const refreshPasskeys = useCallback(async () => {
    const r = await fetch('/api/webauthn/credentials');
    if (!r.ok) return;
    const d = await r.json();
    setPasskeys(
      (d.credentials || []).map(
        (c: { id: string; deviceName: string | null; createdAt: string | null }) => ({
          id: c.id,
          deviceName: c.deviceName,
          createdAt: c.createdAt,
        }),
      ),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/auth/public-config', { cache: 'no-store' });
        const d = await r.json();
        setCfg({ github: d.github, passkey: d.passkey });
      } catch {
        setCfg(null);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: `/${locale}/sign-in` });
  };

  const bindGithub = async () => {
    setBusy('gh');
    try {
      const r = await fetch('/api/auth/prepare-github-link', { method: 'POST' });
      if (!r.ok) return;
      await signIn('github', { callbackUrl: `/${locale}/profile` });
    } finally {
      setBusy(null);
    }
  };

  const unlinkGithub = async () => {
    setBusy('ghu');
    try {
      await fetch('/api/auth/oauth/github', { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const addPasskey = async () => {
    setBusy('pk');
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/webauthn/register/options', { method: 'POST' });
      if (!optRes.ok) return;
      const optionsJSON = await optRes.json();
      const att = await startRegistration({ optionsJSON });
      const v = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(att),
      });
      if (v.ok) await refreshPasskeys();
    } finally {
      setBusy(null);
    }
  };

  const removePasskey = async (id: string) => {
    setBusy(`pk-${id}`);
    try {
      await fetch(`/api/webauthn/credentials/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshPasskeys();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{tProfile('personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {user.image ? (
              <img src={user.image} alt={user.name} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold">{user.name}</h3>
              {user.username && (
                <p className="text-sm text-muted-foreground">
                  {tProfile('username')}: {user.username}
                </p>
              )}
              <p className="text-muted-foreground">{user.email || ui('noEmail')}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {user.roles.map((role) => (
                  <Badge key={role} variant="outline">
                    <Shield className="w-3 h-3 mr-1" />
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tProfile('loginMethod')}</CardTitle>
          <CardDescription>{tProfile('loginCredentialsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Github className="w-5 h-5" />
              <div>
                <div className="font-medium">GitHub</div>
                <div className="text-sm text-muted-foreground">
                  {user.hasGithub ? tProfile('githubLinkedHint') : tProfile('githubNotLinkedHint')}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant={user.hasGithub ? 'success' : 'secondary'}>
                {user.hasGithub ? tProfile('githubLinked') : tProfile('githubNotLinked')}
              </Badge>
              {cfg?.github.enabled && cfg.github.allowBind && !user.hasGithub && (
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void bindGithub()}>
                  {busy === 'gh' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {tProfile('bindGithub')}
                </Button>
              )}
              {user.hasGithub && (
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void unlinkGithub()}>
                  {busy === 'ghu' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {tProfile('unlinkGithub')}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-lg border">
            <div className="flex items-center gap-2 font-medium">
              <Fingerprint className="w-5 h-5" />
              {tProfile('passkeysTitle')}
            </div>
            {cfg?.passkey.enabled && cfg.passkey.allowBind && (
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void addPasskey()}>
                {busy === 'pk' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {tProfile('addPasskey')}
              </Button>
            )}
            <ul className="text-sm space-y-1 mt-2">
              {passkeys.length === 0 ? (
                <li className="text-muted-foreground">{tProfile('noPasskeys')}</li>
              ) : (
                passkeys.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                    <span>{p.deviceName || p.id.slice(0, 8)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void removePasskey(p.id)}
                    >
                      {busy === `pk-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : ui('delete')}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            {tCommon('signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
