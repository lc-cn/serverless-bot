import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { getUser, getUserPermissions, initializeRBAC } from '@/lib/data';
import { storage } from '@/lib/unified-storage';
import { SYSTEM_ROLES, ExtendedSession, ExtendedJWT } from '@/types/auth';

export const authConfig: NextAuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  
  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github') {
        // 确保 RBAC 已初始化（角色必须在用户创建前存在）
        await initializeRBAC();
        
        // GitHub 登录
        const githubId = (profile as Record<string, unknown>)?.id?.toString();
        if (!githubId) return false;

        let existingUser = await storage.getUserByGithubId(githubId);

        if (!existingUser) {
          // 检查是否有相同邮箱的用户
          const email = profile?.email as string | undefined;
          if (email) {
            existingUser = await storage.getUserByEmail(email);
            if (existingUser) {
              // 关联 GitHub ID
              await storage.updateUser(existingUser.id, { githubId });
            }
          }

          if (!existingUser) {
            // 创建新用户
            const users = await storage.getUsers();
            const isFirstUser = users.length === 0;
            const githubProfile = profile as Record<string, unknown>;

            existingUser = await storage.createUser({
              name: (githubProfile?.name as string) || (githubProfile?.login as string) || 'GitHub User',
              email,
              image: githubProfile?.avatar_url as string,
              githubId,
              roleIds: isFirstUser ? [SYSTEM_ROLES.SUPER_ADMIN.id] : [SYSTEM_ROLES.VIEWER.id],
              isActive: true,
            });
          }
        }

        // 更新最后登录时间和头像
        const githubProfile = profile as Record<string, unknown>;
        await storage.updateUser(existingUser.id, {
          lastLoginAt: new Date().toISOString(),
          image: githubProfile?.avatar_url as string,
          name: (githubProfile?.name as string) || existingUser.name,
        });

        // 将内部用户ID附加到 NextAuth user
        (user as ExtendedJWT).id = existingUser.id;
        (user as ExtendedJWT).roleIds = existingUser.roleIds;
        (user as ExtendedJWT).permissions = await getUserPermissions(existingUser.id);

        return true;
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      const extToken = token as unknown as ExtendedJWT;
      if (user) {
        const extUser = user as unknown as ExtendedJWT;
        extToken.id = extUser.id;
        extToken.roleIds = extUser.roleIds;
        extToken.permissions = extUser.permissions;
      }

      // 支持 session 更新
      if (trigger === 'update' && session) {
        const freshUser = await storage.getUser(extToken.id);
        if (freshUser) {
          extToken.roleIds = freshUser.roleIds;
          extToken.permissions = await getUserPermissions(freshUser.id);
        }
      }

      return token;
    },

    async session({ session, token }) {
      const extSession = session as unknown as ExtendedSession;
      const extToken = token as unknown as ExtendedJWT;
      extSession.user.id = extToken.id;
      extSession.user.roleIds = extToken.roleIds;
      extSession.user.permissions = extToken.permissions;
      return session;
    },
  },

  events: {
    async signIn() {
      // 初始化 RBAC（如果需要）
      await storage.initializeRBAC();
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
