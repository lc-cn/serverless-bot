import { storage } from '@/lib/unified-storage';
import { TriggerListClient } from '@/components/trigger/trigger-list';

export default async function NoticeTriggerPage() {
  const triggers = await storage.getTriggersByType('notice');

  return (
    <TriggerListClient
      eventType="notice"
      title="通知触发器"
      description="配置群成员变动、禁言等通知事件的触发条件"
      initialTriggers={triggers}
    />
  );
}