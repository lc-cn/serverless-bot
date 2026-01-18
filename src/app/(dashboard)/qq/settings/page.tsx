import { getBotsByPlatform } from '@/lib/data';
import { QQSettingsClient } from '@/components/qq/settings-client';

export default async function QQSettingsPage() {
  const bots = await getBotsByPlatform('qq');
  const simpleBots = bots.map((b) => ({ id: b.id, name: b.name, config: b.config }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">QQ 机器人设置</h1>
        <p className="text-muted-foreground">
          管理 QQ 机器人的 Webhook 配置和事件订阅。
        </p>
      </div>

      {simpleBots.length === 0 ? (
        <div className="rounded border p-4 text-sm text-muted-foreground">
          尚未配置 QQ Bot，请先在「适配器/机器人」中添加。
        </div>
      ) : (
        <QQSettingsClient bots={simpleBots} />
      )}
    </div>
  );
}
