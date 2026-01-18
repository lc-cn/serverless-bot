import { storage } from '@/lib/unified-storage';
import { TriggerListClient } from '@/components/trigger/trigger-list';

export default async function MessageTriggerPage() {
  const triggers = await storage.getTriggersByType('message');

  return (
    <TriggerListClient
      eventType="message"
      title="消息触发器"
      description="配置私聊和群聊消息的触发条件"
      initialTriggers={triggers}
    />
  );
}