import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import { cookies } from 'next/headers';
import { routing } from '@/i18n/routing';
import GitHub from 'next-auth/providers/github';
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

const LINK_GITHUB_COOKIE = 'oauth_link_github_uid';

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
    const cid = settings.providers.github.clientId?.trim();
    const csec = settings.providers.github.clientSecret?.trim();
    if (cid && csec) {
      providers.push(GitHub({ clientId: cid, clientSecret: csec }));
    }
  } catch (e) {
    console.warn('[auth] 无法从数据库加载 GitHub OAuth 配置，已跳过 GitHub 登录：', e);
  }
  providers.push(...coreProviders);
  return providers;
}

const sharedCallbacks: NextAuthConfig['callbacks'] = {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'github') {
      await initializeRBAC();
      const settings = await getAuthSettings();
      if (!settings.providers.github.enabled) return false;

      const dbCreds = !!(
        settings.providers.github.clientId?.trim() && settings.providers.github.clientSecret?.trim()
      );
      if (!dbCreds) return false;

      const githubId = (profile as Record<string, unknown>)?.id?.toString();
      if (!githubId) return false;

      const cookieStore = await cookies();
      const linkUid = cookieStore.get(LINK_GITHUB_COOKIE)?.value;
      cookieStore.delete(LINK_GITHUB_COOKIE);

      let existingUser = await storage.getUserByGithubId(githubId);

      if (!existingUser && linkUid) {
        if (!settings.providers.github.allowBind) return false;
        const target = await storage.getUser(linkUid);
        if (!target?.isActive) return false;
        const dup = await storage.getOAuthAccount('github', githubId);
        if (dup && dup.userId !== linkUid) return false;
        if (dup) {
          existingUser = await storage.getUser(dup.userId);
        }
        if (existingUser) {
          /* 已绑定，继续走下方更新 */
        } else {
          await storage.linkOAuthAccount({
            userId: linkUid,
            provider: 'github',
            providerAccountId: githubId,
            email: (profile?.email as string | undefined) ?? undefined,
          });
          existingUser = await storage.getUser(linkUid);
        }
      }

      if (!existingUser) {
        const email = profile?.email as string | undefined;
        if (email) {
          const byEmail = await storage.getUserByEmail(email);
          if (byEmail) {
            if (!byEmail.isActive) return false;
            const dupGh = await storage.getOAuthAccount('github', githubId);
            if (dupGh && dupGh.userId !== byEmail.id) return false;
            if (!dupGh) {
              await storage.linkOAuthAccount({
                userId: byEmail.id,
                provider: 'github',
                providerAccountId: githubId,
                email,
              });
            }
            existingUser = await storage.getUser(byEmail.id);
          }
        }
      }

      if (!existingUser) {
        if (!settings.providers.github.allowSignup) {
          return false;
        }
        const isFirst = (await storage.countUsers()) === 0;
        const githubProfile = profile as Record<string, unknown>;
        const newEmail = profile?.email as string | undefined;
        existingUser = await storage.createUser({
          name: (githubProfile?.name as string) || (githubProfile?.login as string) || 'GitHub User',
          email: newEmail,
          image: githubProfile?.avatar_url as string,
          githubId,
          roleIds: isFirst ? [SYSTEM_ROLES.SUPER_ADMIN.id] : [SYSTEM_ROLES.VIEWER.id],
          isActive: true,
        });
      }

      if (!existingUser?.isActive) return false;

      const githubProfile = profile as Record<string, unknown>;
      await storage.updateUser(existingUser.id, {
        lastLoginAt: new Date().toISOString(),
        image: githubProfile?.avatar_url as string,
        name: (githubProfile?.name as string) || existingUser.name,
      });

      (user as ExtendedJWT).id = existingUser.id;
      (user as ExtendedJWT).roleIds = existingUser.roleIds;
      (user as ExtendedJWT).permissions = await getUserPermissions(existingUser.id);

      return true;
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
