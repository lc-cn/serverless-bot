import { requirePermission } from '@/lib/permissions';
import { authStorage } from '@/lib/unified-storage';
import { UserListClient } from '@/components/users/user-list-client';

export default async function UsersPage() {
  await requirePermission('users:read');

  // 服务端获取数据
  const users = await authStorage.getUsers();
  const roles = await authStorage.getRoles();

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
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">管理系统用户及其角色分配</p>
      </div>

      <UserListClient initialUsers={safeUsers} roles={roles} />
    </div>
  );
}
