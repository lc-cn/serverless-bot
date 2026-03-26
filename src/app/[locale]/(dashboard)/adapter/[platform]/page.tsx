import { notFound } from 'next/navigation';
import { AdapterPlatformView } from '@/components/adapter/adapter-platform-view';
import { adapterRegistry } from '@/core';
import { getBotsByPlatform } from '@/lib/persistence';

// 确保适配器被注册
import '@/adapters';

interface PageProps {
  params: Promise<{ platform: string }>;
}

export default async function AdapterPlatformPage({ params }: PageProps) {
  const { platform } = await params;

  const adapter = adapterRegistry.get(platform);
  if (!adapter) {
    notFound();
  }

  const adapterInfo = adapter.getInfo();
  const bots = await getBotsByPlatform(platform);
  const botConfigUISchema = adapter.getBotConfigUISchema();
  const guide = adapter.getSetupGuide();

  return (
    <AdapterPlatformView
      platform={platform}
      adapterInfo={{
        name: adapterInfo.name,
        description: adapterInfo.description,
        icon: adapterInfo.icon,
      }}
      initialBots={bots}
      botConfigSchema={botConfigUISchema}
      guide={guide}
    />
  );
}
