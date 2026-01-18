import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { storage } from '@/lib/unified-storage';
import { BotEditForm } from '@/components/bot/bot-edit-form';
import { adapterRegistry } from '@/core';
import '@/adapters';

interface BotEditPageProps {
  params: Promise<{ platform: string; bot_id: string }>;
}

export default async function BotEditPage({ params }: BotEditPageProps) {
  const { platform, bot_id } = await params;

  const bot = await storage.getBot(bot_id);
  const adapter = adapterRegistry.get(platform);
  const botConfigUISchema = adapter?.getBotConfigUISchema();

  if (!bot) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold mb-4">机器人未找到</h1>
        <Link href={`/adapter/${platform}`}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/adapter/${platform}/${bot_id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">编辑机器人 - {bot.name}</h1>
          <p className="text-muted-foreground">ID: {bot.id}</p>
        </div>
      </div>

      <BotEditForm platform={platform} bot={bot} botConfigSchema={botConfigUISchema} />
    </div>
  );
}
