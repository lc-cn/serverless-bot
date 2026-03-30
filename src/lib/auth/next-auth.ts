import NextAuth from 'next-auth';
import type { NextAuthConfig, User as NextAuthUser } from 'next-auth';
import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import GitLab from 'next-auth/providers/gitlab';
import Credentials from 'next-auth/providers/credentials';
import { getUserPermissions, initializeRBAC, storage } from '@/lib/persistence';
import { getAuthSettings } from './auth-settings';
import { getPlatformSettings } from '@/lib/platform-settings';
import { verifyPasskeyAssertionPayload, type AssertionInput } from '@/lib/webauthn/verify-login';
import type { User as AppUser } from '@/types/auth';
import { SYSTEM_ROLES, ExtendedSession, ExtendedJWT } from '@/types/auth';

if (
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXTAUTH_SECRET?.trim() &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  console.warn(
    '[auth] 生产环境未设置 NEXTAUTH_SECRET，会话与安装 Cookie 签名将不安全。请在环境变量中配置。',
  );
}

export async function userToAuthUser(user: AppUser) {
  const permissions = await getUserPermissions(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    image: user.image,
    roleIds: user.roleIds,
    permissions,
  };
}

const LINK_OAUTH_COOKIES = {
  github: 'oauth_link_github_uid',
  google: 'oauth_link_google_uid',
  gitlab: 'oauth_link_gitlab_uid',
} as const;

type OauthProviderId = keyof typeof LINK_OAUTH_COOKIES;

function normalizeGitlabBaseUrl(raw?: string): string {
  const fallback = 'https://gitlab.com';
  const t = raw?.trim();
  if (!t) return fallback;
  return t.replace(/\/+$/, '') || fallback;
}

function oauthProfileFields(provider: OauthProviderId, profile: Record<string, unknown>) {
  if (provider === 'google') {
    const externalId =
      profile.sub != null
        ? String(profile.sub)
        : profile.id != null
          ? String(profile.id)
          : undefined;
    const email = profile.email as string | undefined;
    return {
      externalId,
      displayName:
        (profile.name as string) ||
        (email ? email.split('@')[0] : undefined) ||
        'Google User',
      image: (profile.picture as string | undefined) || (profile.image as string | undefined),
      email,
    };
  }

  const externalId = profile.id != null ? String(profile.id) : undefined;
  if (provider === 'github') {
    return {
      externalId,
      displayName:
        (profile.name as string) || (profile.login as string) || 'GitHub User',
      image: (profile.avatar_url as string | undefined) || (profile.image as string | undefined),
      email: profile.email as string | undefined,
    };
  }
  return {
    externalId,
    displayName:
      (profile.name as string) ||
      (profile.username as string) ||
      (profile.login as string) ||
      'GitLab User',
    image: (profile.avatar_url as string | undefined) || (profile.image as string | undefined),
    email: profile.email as string | undefined,
  };
}

async function lookupUserByOAuthId(provider: OauthProviderId, externalId: string) {
  return storage.getUserByOAuthProvider(provider, externalId);
}

async function handleOAuthAccountSignIn(
  provider: OauthProviderId,
  args: { user: NextAuthUser; profile: unknown },
): Promise<boolean> {
  await initializeRBAC();
  const settings = await getAuthSettings();
  const cfg = settings.providers[provider];
  if (!cfg.enabled) return false;

  const dbCreds = !!(cfg.clientId?.trim() && cfg.clientSecret?.trim());
  if (!dbCreds) return false;

  const raw = (args.profile || {}) as Record<string, unknown>;
  const p = oauthProfileFields(provider, raw);
  if (!p.externalId) return false;

  const cookieStore = await cookies();
  const linkCookie = LINK_OAUTH_COOKIES[provider];
  const linkUid = cookieStore.get(linkCookie)?.value;
  cookieStore.delete(linkCookie);

  let existingUser = await lookupUserByOAuthId(provider, p.externalId);

  if (!existingUser && linkUid) {
    if (!cfg.allowBind) return false;
    const target = await storage.getUser(linkUid);
    if (!target?.isActive) return false;
    const dup = await storage.getOAuthAccount(provider, p.externalId);
    if (dup && dup.userId !== linkUid) return false;
    if (dup) {
      existingUser = await storage.getUser(dup.userId);
    }
    if (!existingUser) {
      await storage.linkOAuthAccount({
        userId: linkUid,
        provider,
        providerAccountId: p.externalId,
        email: p.email,
      });
      existingUser = await storage.getUser(linkUid);
    }
  }

  if (!existingUser && p.email) {
    const byEmail = await storage.getUserByEmail(p.email);
    if (byEmail) {
      if (!byEmail.isActive) return false;
      const dupOAuth = await storage.getOAuthAccount(provider, p.externalId);
      if (dupOAuth && dupOAuth.userId !== byEmail.id) return false;
      if (!dupOAuth) {
        await storage.linkOAuthAccount({
          userId: byEmail.id,
          provider,
          providerAccountId: p.externalId,
          email: p.email,
        });
      }
      existingUser = await storage.getUser(byEmail.id);
    }
  }

  if (!existingUser) {
    if (!cfg.allowSignup) {
      return false;
    }
    const isFirst = (await storage.countUsers()) === 0;
    existingUser = await storage.createUser({
      name: p.displayName,
      email: p.email,
      image: p.image,
      oauthLinks: [{ provider, providerAccountId: p.externalId, email: p.email }],
      roleIds: isFirst ? [SYSTEM_ROLES.SUPER_ADMIN.id] : [SYSTEM_ROLES.VIEWER.id],
      isActive: true,
    });
  }

  if (!existingUser?.isActive) return false;

  await storage.updateUser(existingUser.id, {
    lastLoginAt: new Date().toISOString(),
    image: p.image,
    name: p.displayName || existingUser.name,
  });

  const ext = args.user as ExtendedJWT;
  ext.id = existingUser.id;
  ext.roleIds = existingUser.roleIds;
  ext.permissions = await getUserPermissions(existingUser.id);

  return true;
}

/** 密码 / Passkey（不依赖 OAuth 应用配置） */
const coreProviders: NextAuthConfig['providers'] = [
  Credentials({
    id: 'credentials-password',
    name: 'Password',
    credentials: {
      identifier: { label: 'Email or username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      await initializeRBAC();
      const idf = String(credentials?.identifier || '').trim();
      const pw = String(credentials?.password || '');
      const u = await storage.authenticateLocalCredentials(idf, pw);
      if (!u) return null;
      await storage.updateUser(u.id, { lastLoginAt: new Date().toISOString() });
      return userToAuthUser(u);
    },
  }),
  Credentials({
    id: 'passkey',
    name: 'Passkey',
    credentials: {
      payload: { label: 'Payload', type: 'text' },
    },
    async authorize(credentials) {
      await initializeRBAC();
      const settings = await getAuthSettings();
      if (!settings.providers.passkey.enabled) return null;
      let assertion: unknown;
      try {
        assertion = JSON.parse(String(credentials?.payload || ''));
      } catch {
        return null;
      }
      const u = await verifyPasskeyAssertionPayload(assertion as AssertionInput & Record<string, unknown>);
      if (!u) return null;
      await storage.updateUser(u.id, { lastLoginAt: new Date().toISOString() });
      return userToAuthUser(u);
    },
  }),
];

async function buildProviders(): Promise<NextAuthConfig['providers']> {
  const providers: NextAuthConfig['providers'] = [];
  try {
    const settings = await getAuthSettings();
    const ghCid = settings.providers.github.clientId?.trim();
    const ghSec = settings.providers.github.clientSecret?.trim();
    if (ghCid && ghSec) {
      providers.push(GitHub({ clientId: ghCid, clientSecret: ghSec }));
    }

    const goCid = settings.providers.google.clientId?.trim();
    const goSec = settings.providers.google.clientSecret?.trim();
    if (goCid && goSec) {
      providers.push(Google({ clientId: goCid, clientSecret: goSec }));
    }

    const glCid = settings.providers.gitlab.clientId?.trim();
    const glSec = settings.providers.gitlab.clientSecret?.trim();
    if (glCid && glSec) {
      const baseUrl = normalizeGitlabBaseUrl(settings.providers.gitlab.baseUrl);
      providers.push(GitLab({ clientId: glCid, clientSecret: glSec, baseUrl }));
    }
  } catch (e) {
    console.warn('[auth] 无法从数据库加载 OAuth 配置，已跳过 GitHub/Google/GitLab 登录：', e);
  }
  providers.push(...coreProviders);
  return providers;
}

const sharedCallbacks: NextAuthConfig['callbacks'] = {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'github') {
      return handleOAuthAccountSignIn('github', { user, profile });
    }
    if (account?.provider === 'google') {
      return handleOAuthAccountSignIn('google', { user, profile });
    }
    if (account?.provider === 'gitlab') {
      return handleOAuthAccountSignIn('gitlab', { user, profile });
    }

    return true;
  },

  async jwt({ token, user, trigger, session }) {
    type J = ExtendedJWT & { userCheckedAt?: number; revoked?: boolean };
    const extToken = token as unknown as J;
    if (user) {
      const extUser = user as unknown as ExtendedJWT;
      extToken.id = extUser.id;
      extToken.roleIds = extUser.roleIds;
      extToken.permissions = extUser.permissions;
      extToken.revoked = false;
      extToken.userCheckedAt = Date.now();
    }

    const pl = await getPlatformSettings();
    const interval = pl.sessionUserCheckIntervalMs;
    const uid = extToken.id;
    const shouldRefresh =
      !!uid &&
      (trigger === 'update' ||
        !extToken.userCheckedAt ||
        Date.now() - extToken.userCheckedAt > interval);

    if (shouldRefresh && uid) {
      const freshUser = await storage.getUser(uid);
      extToken.userCheckedAt = Date.now();
      if (!freshUser || !freshUser.isActive) {
        extToken.revoked = true;
      } else {
        extToken.roleIds = freshUser.roleIds;
        extToken.permissions = await getUserPermissions(freshUser.id);
        extToken.onboardingCompletedAt = freshUser.onboardingCompletedAt ?? null;
      }
    }

    return token;
  },

  async session({ session, token }) {
    const extSession = session as unknown as ExtendedSession;
    const extToken = token as unknown as ExtendedJWT & { revoked?: boolean };
    if (extToken.revoked) {
      (extSession as unknown as { user: typeof extSession.user | null }).user = null;
      return session;
    }
    extSession.user.id = extToken.id;
    extSession.user.roleIds = extToken.roleIds;
    extSession.user.permissions = extToken.permissions;
    extSession.user.onboardingCompletedAt = extToken.onboardingCompletedAt ?? null;
    return session;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  providers: await buildProviders(),
  secret: process.env.NEXTAUTH_SECRET,
  basePath: '/api/auth',
  pages: {
    signIn: `/${routing.defaultLocale}/sign-in`,
    error: `/${routing.defaultLocale}/sign-in`,
  },
  callbacks: sharedCallbacks,
  events: {
    async signIn() {
      await storage.initializeRBAC();
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
}));
