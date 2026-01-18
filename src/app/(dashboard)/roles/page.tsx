import { requirePermission } from '@/lib/permissions';
import { authStorage } from '@/lib/unified-storage';
import { RoleListClient } from '@/components/roles/role-list-client';
import { PERMISSIONS } from '@/types/auth';

export default async function RolesPage() {
  await requirePermission('roles:read');

  // 服务端获取数据
  const roles = await authStorage.getRoles();
  const availablePermissions = Object.values(PERMISSIONS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">角色管理</h1>
        <p className="text-muted-foreground">管理系统角色及其权限配置</p>
      </div>

      <RoleListClient
        initialRoles={roles}
        availablePermissions={availablePermissions}
      />
    </div>
  );
}
