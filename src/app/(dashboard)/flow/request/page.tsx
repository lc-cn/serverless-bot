import { storage } from '@/lib/unified-storage';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function RequestFlowPage() {
  // 服务端获取数据
  const flows = await storage.getFlowsByType('request');

  return (
    <FlowListClient
      eventType="request"
      title="请求事件流转"
      description="配置好友请求和群组邀请的处理流程"
      initialFlows={flows}
    />
  );
}
