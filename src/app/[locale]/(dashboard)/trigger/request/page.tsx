import { getTranslations } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import { TriggerListClient } from '@/components/trigger/trigger-list';

export default async function RequestTriggerPage() {
  const t = await getTranslations('Dashboard.triggerPages.request');
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    await localizedRedirect('/sign-in');
  }
  const triggers = await storage.listTriggersForUser(userId as string, 'request');

  return (
    <TriggerListClient
      eventType="request"
      title={t('title')}
      description={t('description')}
      initialTriggers={triggers}
    />
  );
}