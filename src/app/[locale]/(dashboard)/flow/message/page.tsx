import { getTranslations } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function MessageFlowPage() {
  const t = await getTranslations('Dashboard.flowPages.message');
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    await localizedRedirect('/sign-in');
  }
  const flows = await storage.listFlowsForUser(userId as string, 'message');

  return (
    <FlowListClient
      eventType="message"
      title={t('title')}
      description={t('description')}
      initialFlows={flows}
    />
  );
}
