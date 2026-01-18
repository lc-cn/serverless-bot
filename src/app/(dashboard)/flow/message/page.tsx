import { storage } from '@/lib/unified-storage';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function MessageFlowPage() {
  // 服务端获取数据
  const flows = await storage.getFlowsByType('message');

  return (
    <FlowListClient
      eventType="message"
      title="消息事件流转"
      description="配置私聊和群聊消息的处理流程"
      initialFlows={flows}
    />
  );
}
