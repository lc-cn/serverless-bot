import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { BotListClient } from '@/components/bot/bot-list-client';
import { adapterRegistry } from '@/core';
import { getBotsByPlatform } from '@/lib/data';

// 确保适配器被注册
import '@/adapters';

interface PageProps {
  params: Promise<{ platform: string }>; 
}

export default async function AdapterPlatformPage({ params }: PageProps) {
  const { platform } = await params;

  // 服务端获取数据
  const adapter = adapterRegistry.get(platform);
  if (!adapter) {
    notFound();
  }

  const adapterInfo = adapter.getInfo();
  const bots = await getBotsByPlatform(platform);
  const botConfigUISchema = adapter.getBotConfigUISchema();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/adapter">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{adapterInfo.name}</h1>
          <p className="text-muted-foreground">{adapterInfo.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">机器人管理</h2>
        <BotListClient platform={platform} initialBots={bots} botConfigSchema={botConfigUISchema} />
      </div>
    </div>
  );
}
