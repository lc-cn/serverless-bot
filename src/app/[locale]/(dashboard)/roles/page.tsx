import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';
import { RoleListClient } from '@/components/roles/role-list-client';
import { PERMISSIONS } from '@/types/auth';

export default async function RolesPage() {
  await requirePermission('roles:read');
  const t = await getTranslations('Dashboard.roles');

  // 服务端获取数据
  const roles = await storage.getRoles();
  const availablePermissions = Object.values(PERMISSIONS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <RoleListClient
        initialRoles={roles}
        availablePermissions={availablePermissions}
      />
    </div>
  );
}
