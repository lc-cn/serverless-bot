import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { getBot } from '@/lib/data';
import { BotHomeClient } from '@/components/bot/bot-home-client';
import '@/adapters';

interface BotPageProps {
  params: Promise<{ platform: string; bot_id: string }>; 
}

export default async function BotPage({ params }: BotPageProps) {
  const { platform, bot_id } = await params;

  const bot = await getBot(bot_id);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/adapter/${platform}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{bot.name}</h1>
            <p className="text-muted-foreground">ID: {bot.id}</p>
          </div>
        </div>
        <Badge variant={bot.enabled ? 'success' : 'secondary'}>
          {bot.enabled ? '已启用' : '未启用'}
        </Badge>
      </div>

      <BotHomeClient platform={platform} bot={bot} />
    </div>
  );
}
