import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth/permissions';
import { PlatformSettingsClient } from './platform-settings-client';

export default async function PlatformSettingsPage() {
  await requirePermission('system:platform_settings');
  const t = await getTranslations('PlatformSettingsPage');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <PlatformSettingsClient />
      <p className="text-sm text-muted-foreground">
        <Link href="/settings/auth" className="text-primary underline-offset-4 hover:underline">
          {t('linkToAuth')}
        </Link>
      </p>
    </div>
  );
}
