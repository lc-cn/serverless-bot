import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';
import { UserListClient } from '@/components/users/user-list-client';

export default async function UsersPage() {
  await requirePermission('users:read');
  const t = await getTranslations('Dashboard.users');

  // 服务端获取数据
  const users = await storage.getUsers();
  const roles = await storage.getRoles();

  // 转换为安全的用户信息
  const safeUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    roleIds: user.roleIds,
    roles: user.roleIds
      .map((rid) => roles.find((r) => r.id === rid)?.name)
      .filter((name): name is string => !!name),
    isActive: user.isActive,
    hasGithub: !!user.githubId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <UserListClient initialUsers={safeUsers} roles={roles} />
    </div>
  );
}
