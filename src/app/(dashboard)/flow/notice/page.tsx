import { storage } from '@/lib/unified-storage';
import { FlowListClient } from '@/components/flow/flow-list-new';

export default async function NoticeFlowPage() {
  // 服务端获取数据
  const flows = await storage.getFlowsByType('notice');

  return (
    <FlowListClient
      eventType="notice"
      title="通知事件流转"
      description="配置群成员变动、禁言等通知的处理流程"
      initialFlows={flows}
    />
  );
}
