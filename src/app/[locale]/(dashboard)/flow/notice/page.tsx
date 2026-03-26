import { getTranslations } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function NoticeFlowPage() {
  const t = await getTranslations('Dashboard.flowPages.notice');
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    await localizedRedirect('/sign-in');
  }
  const flows = await storage.listFlowsForUser(userId as string, 'notice');

  return (
    <FlowListClient
      eventType="notice"
      title={t('title')}
      description={t('description')}
      initialFlows={flows}
    />
  );
}
