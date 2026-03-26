import { getBotsByPlatform } from '@/lib/persistence';
import { DiscordCommandCreator } from '@/components/discord/command-creator';

export default async function DiscordCommandsPage() {
  const bots = await getBotsByPlatform('discord');
  const simpleBots = bots.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Discord Slash Commands</h1>
        <p className="text-muted-foreground">
          直接在后台创建/更新 Discord Slash Command。Guild 范围生效更快，Global 可能需几分钟。
        </p>
      </div>

      {simpleBots.length === 0 ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">
          尚未配置 Discord Bot，请先在「适配器/机器人」中添加。
        </div>
      ) : (
        <DiscordCommandCreator bots={simpleBots} />
      )}
    </div>
  );
}
