import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';
import { ProfileClient } from '@/components/auth/profile-client';
import { listCredentialsForUser } from '@/lib/webauthn/repo';

export default async function ProfilePage() {
  const t = await getTranslations('Dashboard.profile');
  const session = await requireAuth();
  const userId = session.user.id;

  // 获取完整用户信息
  const user = await storage.getUser(userId);
  if (!user) {
    return <div>{t('userNotFound')}</div>;
  }

  const roles = await storage.getRoles();

  const oauth = await storage.listOAuthAccountsForUser(userId);
  const hasGithub = oauth.some((a) => a.provider === 'github');
  const hasGoogle = oauth.some((a) => a.provider === 'google');
  const hasGitlab = oauth.some((a) => a.provider === 'gitlab');
  const creds = await listCredentialsForUser(userId);

  const userData = {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    image: user.image,
    roleIds: user.roleIds,
    roles: user.roleIds
      .map((rid) => roles.find((r) => r.id === rid)?.name)
      .filter((name): name is string => !!name),
    hasGithub,
    hasGoogle,
    hasGitlab,
  };

  const passkeys = creds.map((c) => ({
    id: c.id,
    deviceName: c.deviceName ?? null,
    createdAt: c.createdAt ?? null,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <ProfileClient user={userData} passkeys={passkeys} />
    </div>
  );
}
