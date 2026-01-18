import { requireAuth } from '@/lib/permissions';
import { authStorage } from '@/lib/unified-storage';
import { ProfileClient } from '@/components/auth/profile-client';

export default async function ProfilePage() {
  const session = await requireAuth();
  const userId = session.user.id;

  // 获取完整用户信息
  const user = await authStorage.getUser(userId);
  if (!user) {
    return <div>用户不存在</div>;
  }

  const roles = await authStorage.getRoles();

  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    roleIds: user.roleIds,
    roles: user.roleIds
      .map((rid) => roles.find((r) => r.id === rid)?.name)
      .filter((name): name is string => !!name),
    hasGithub: !!user.githubId,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">个人设置</h1>
        <p className="text-muted-foreground">管理您的账户和安全设置</p>
      </div>

      <ProfileClient user={userData} />
    </div>
  );
}
