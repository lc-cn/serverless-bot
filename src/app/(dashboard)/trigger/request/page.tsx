import { storage } from '@/lib/unified-storage';
import { TriggerListClient } from '@/components/trigger/trigger-list';

export default async function RequestTriggerPage() {
  const triggers = await storage.getTriggersByType('request');

  return (
    <TriggerListClient
      eventType="request"
      title="请求触发器"
      description="配置好友请求和群组邀请的触发条件"
      initialTriggers={triggers}
    />
  );
}