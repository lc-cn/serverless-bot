import { getTranslations } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function RequestFlowPage() {
  const t = await getTranslations('Dashboard.flowPages.request');
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    await localizedRedirect('/sign-in');
  }
  const flows = await storage.listFlowsForUser(userId as string, 'request');

  return (
    <FlowListClient
      eventType="request"
      title={t('title')}
      description={t('description')}
      initialFlows={flows}
    />
  );
}
