import { getTranslations } from 'next-intl/server';
import { adapterRegistry } from '@/core';
import { getBots } from '@/lib/persistence';
import { AdapterListClient } from '@/components/adapter/adapter-list-client';
import { FirstVisitOnboardingHint } from '@/components/onboarding/first-visit-onboarding-hint';
import '@/adapters';

export default async function AdapterHomePage() {
  const t = await getTranslations('Dashboard.adapter');
  const registeredAdapters = adapterRegistry.getAll();
  const allBots = await getBots();
  const botCountByPlatform = allBots.reduce<Record<string, number>>((acc, b) => {
    acc[b.platform] = (acc[b.platform] ?? 0) + 1;
    return acc;
  }, {});

  const adapters = registeredAdapters.map((adapter) => {
    const info = adapter.getInfo();
    return {
      ...info,
      botCount: botCountByPlatform[info.platform] ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <FirstVisitOnboardingHint sectionId="bot_access" />
      <div>
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <AdapterListClient initialAdapters={adapters} />
    </div>
  );
}
