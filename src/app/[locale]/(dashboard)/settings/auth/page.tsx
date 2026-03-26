import { getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/auth/permissions';
import { AuthSettingsClient } from './auth-settings-client';

export default async function AuthSettingsPage() {
  await requirePermission('system:auth_settings');
  const t = await getTranslations('AuthSettingsPage');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <AuthSettingsClient />
    </div>
  );
}
