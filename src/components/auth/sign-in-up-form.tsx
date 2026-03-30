'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Github, Gitlab, Chrome, Loader2, Fingerprint } from 'lucide-react';

export type PublicAuthConfig = {
  registrationEnabled: boolean;
  passwordLoginEnabled: boolean;
  github: { enabled: boolean; allowBind: boolean; allowSignup: boolean };
  google: { enabled: boolean; allowBind: boolean; allowSignup: boolean };
  gitlab: { enabled: boolean; allowBind: boolean; allowSignup: boolean };
  passkey: { enabled: boolean; allowBind: boolean; allowSignup: boolean };
  databaseConfigured: boolean;
  sponsor?: {
    enabled: boolean;
    primaryUrl: string | null;
    links: { url: string; label?: string }[];
  };
};

const FALLBACK_CFG: PublicAuthConfig = {
  registrationEnabled: false,
  passwordLoginEnabled: true,
  github: { enabled: false, allowBind: true, allowSignup: true },
  google: { enabled: false, allowBind: true, allowSignup: true },
  gitlab: { enabled: false, allowBind: true, allowSignup: true },
  passkey: { enabled: false, allowBind: true, allowSignup: false },
  databaseConfigured: false,
};

function usePublicAuthConfig(): PublicAuthConfig | null {
  const [cfg, setCfg] = useState<PublicAuthConfig | null>(null);

  const loadCfg = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/public-config', { cache: 'no-store' });
      const d = await r.json();
      setCfg(d as PublicAuthConfig);
    } catch {
      setCfg(FALLBACK_CFG);
    }
  }, []);

  useEffect(() => {
    void loadCfg();
  }, [loadCfg]);

  return cfg;
}

function authHref(path: '/sign-in' | '/sign-up', callbackUrl: string): string {
  if (!callbackUrl || callbackUrl === '/') return path;
  return `${path}?${new URLSearchParams({ callbackUrl }).toString()}`;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tForm = useTranslations('SignInUpForm');
  const tPage = useTranslations('SignInPage');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const cfg = usePublicAuthConfig();

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleGithubSignIn = async () => {
    setLoading('github');
    setError(null);
    try {
      await signIn('github', { callbackUrl });
    } catch {
      setError(tForm('errGithub'));
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading('google');
    setError(null);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setError(tForm('errGoogle'));
      setLoading(null);
    }
  };

  const handleGitlabSignIn = async () => {
    setLoading('gitlab');
    setError(null);
    try {
      await signIn('gitlab', { callbackUrl });
    } catch {
      setError(tForm('errGitlab'));
      setLoading(null);
    }
  };

  const handlePasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError(tForm('errPasswordFields'));
      return;
    }
    setLoading('password');
    setError(null);
    try {
      const res = await signIn('credentials-password', {
        identifier: identifier.trim(),
        password,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError(tForm('errPasswordInvalid'));
        setLoading(null);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(tForm('errPasswordFailed'));
      setLoading(null);
    }
  };

  const handlePasskeySignIn = async () => {
    setLoading('passkey');
    setError(null);
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!optRes.ok) {
        let msg = tForm('errPasskeyOptions');
        try {
          const j = (await optRes.json()) as { error?: string };
          if (optRes.status === 403 && j?.error === 'passkey_disabled') {
            msg = tForm('errPasskeyDisabled');
          }
        } catch {
          /* 非 JSON 等忽略 */
        }
        setError(msg);
        setLoading(null);
        return;
      }
      const optionsJSON = await optRes.json();
      const as = await startAuthentication({ optionsJSON });
      const res = await signIn('passkey', {
        payload: JSON.stringify(as),
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError(tForm('errPasskeyVerify'));
        setLoading(null);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(tForm('errPasskeyFailed'));
      setLoading(null);
    }
  };

  if (!cfg) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 p-5 text-center sm:space-y-1.5 sm:p-6">
        <CardTitle className="text-xl sm:text-2xl">{tPage('title')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{tForm('chooseMethod')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-6 sm:px-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {!cfg.databaseConfigured && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{tForm('noDatabase')}</p>
        )}

        <div className="space-y-4">
          {cfg.passwordLoginEnabled && cfg.databaseConfigured && (
            <form onSubmit={handlePasswordSignIn} className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="signin-id" className="text-xs font-medium sm:text-sm">
                  {tForm('identifierLabel')}
                </label>
                <Input
                  id="signin-id"
                  autoComplete="username"
                  placeholder={tForm('identifierPlaceholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading !== null}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="signin-pw" className="text-xs font-medium sm:text-sm">
                  {tForm('passwordLabel')}
                </label>
                <Input
                  id="signin-pw"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading !== null}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading !== null}>
                {loading === 'password' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tForm('passwordSubmit')}
              </Button>
            </form>
          )}

          {cfg.passwordLoginEnabled &&
            cfg.databaseConfigured &&
            (cfg.passkey.enabled || cfg.github.enabled || cfg.google.enabled || cfg.gitlab.enabled) && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{tForm('or')}</span>
                </div>
              </div>
            )}

          {(cfg.passkey.enabled && cfg.databaseConfigured) ||
          cfg.github.enabled ||
          cfg.google.enabled ||
          cfg.gitlab.enabled ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {cfg.passkey.enabled && cfg.databaseConfigured && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 [&_svg]:size-[1.125rem]"
                  aria-label={tForm('passkeySubmit')}
                  title={tForm('passkeySubmit')}
                  onClick={() => void handlePasskeySignIn()}
                  disabled={loading !== null}
                >
                  {loading === 'passkey' ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Fingerprint aria-hidden />
                  )}
                </Button>
              )}
              {cfg.github.enabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 [&_svg]:size-[1.125rem]"
                  aria-label={tForm('github')}
                  title={tForm('github')}
                  onClick={() => void handleGithubSignIn()}
                  disabled={loading !== null}
                >
                  {loading === 'github' ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Github aria-hidden />
                  )}
                </Button>
              )}
              {cfg.google.enabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 [&_svg]:size-[1.125rem]"
                  aria-label={tForm('google')}
                  title={tForm('google')}
                  onClick={() => void handleGoogleSignIn()}
                  disabled={loading !== null}
                >
                  {loading === 'google' ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Chrome aria-hidden />
                  )}
                </Button>
              )}
              {cfg.gitlab.enabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 [&_svg]:size-[1.125rem]"
                  aria-label={tForm('gitlab')}
                  title={tForm('gitlab')}
                  onClick={() => void handleGitlabSignIn()}
                  disabled={loading !== null}
                >
                  {loading === 'gitlab' ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Gitlab aria-hidden />
                  )}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>
      {cfg.registrationEnabled || cfg.github.enabled || cfg.google.enabled || cfg.gitlab.enabled ? (
        <CardFooter className="flex flex-col gap-3 border-t border-border/50 px-5 pb-6 pt-4 sm:px-6">
          {cfg.registrationEnabled ? (
            <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-1 sm:text-sm">
              <span className="shrink-0">{tForm('noAccountPrefix')}</span>
              <Link
                href={authHref('/sign-up', callbackUrl)}
                className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
              >
                {tForm('noAccountLink')}
              </Link>
            </div>
          ) : null}
          {cfg.github.enabled || cfg.google.enabled || cfg.gitlab.enabled ? (
            <p className="max-w-sm text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {tForm('oauthFooterHint')}
            </p>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tForm = useTranslations('SignInUpForm');
  const tPage = useTranslations('SignUpPage');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const cfg = usePublicAuthConfig();

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading('signUp');
    setError(null);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          name: regName.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const code = d.error as string;
        if (code === 'registration_disabled') setError(tForm('errSignUpDisabled'));
        else if (code === 'username_taken') setError(tForm('errUsernameTaken'));
        else if (code === 'email_taken') setError(tForm('errEmailTaken'));
        else if (code === 'validation_error') setError(tForm('errSignUpValidation'));
        else setError(tForm('errSignUpFailed'));
        setLoading(null);
        return;
      }
      const res = await signIn('credentials-password', {
        identifier: regUsername.trim().toLowerCase(),
        password: regPassword,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setError(tForm('errPasswordInvalid'));
        setLoading(null);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(tForm('errSignUpFailed'));
      setLoading(null);
    }
  };

  if (!cfg) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 p-5 text-center sm:space-y-1.5 sm:p-6">
        <CardTitle className="text-xl sm:text-2xl">{tPage('title')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{tPage('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-2 sm:px-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {!cfg.databaseConfigured && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{tForm('noDatabase')}</p>
        )}

        <form onSubmit={handleSignUp} className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="signup-user" className="text-xs font-medium sm:text-sm">
              {tForm('signUpUsername')}
            </label>
            <Input
              id="signup-user"
              autoComplete="username"
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              disabled={loading !== null}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-xs font-medium sm:text-sm">
              {tForm('signUpEmail')}
            </label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              disabled={loading !== null}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-name" className="text-xs font-medium sm:text-sm">
              {tForm('signUpNameOptional')}
            </label>
            <Input
              id="signup-name"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={loading !== null}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-pw" className="text-xs font-medium sm:text-sm">
              {tForm('signUpPassword')}
            </label>
            <Input
              id="signup-pw"
              type="password"
              autoComplete="new-password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              disabled={loading !== null}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading !== null || !cfg.databaseConfigured}>
            {loading === 'signUp' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {tForm('signUpSubmit')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-border/50 px-5 pb-6 pt-4 sm:px-6">
        <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-1 sm:text-sm">
          <span className="shrink-0">{tForm('haveAccountPrefix')}</span>
          <Link
            href={authHref('/sign-in', callbackUrl)}
            className="shrink-0 font-medium text-primary underline-offset-4 hover:underline"
          >
            {tForm('haveAccountLink')}
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
