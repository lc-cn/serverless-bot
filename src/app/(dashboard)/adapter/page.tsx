import { adapterRegistry } from '@/core';
import { getAdapters } from '@/lib/data';
import { AdapterListClient } from '@/components/adapter/adapter-list-client';
import { AdapterSetupGuide } from '@/components/adapter/adapter-setup-guide';
import '@/adapters';

export default async function AdapterHomePage() {
  const registeredAdapters = adapterRegistry.getAll();
  const configuredAdapters = await getAdapters();

  const adapters = registeredAdapters.map((adapter) => {
    const info = adapter.getInfo();
    const configSchema = adapter.getAdapterConfigUISchema();
    const config = configuredAdapters.find((c) => c.platform === info.platform);
    return {
      ...info,
      configured: !!config,
      enabled: config?.enabled ?? false,
      config: config?.config ?? {},
      configSchema,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">适配器管理</h1>
        <p className="text-muted-foreground">在这里配置和管理各个平台的机器人适配器</p>
      </div>

      <AdapterSetupGuide />

      <AdapterListClient initialAdapters={adapters} />
    </div>
  );
}
