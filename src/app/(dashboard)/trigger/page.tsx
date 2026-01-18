import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageSquare, UserPlus, Bell } from 'lucide-react';

const triggerTypes = [
  {
    type: 'message',
    name: '消息触发器',
    description: '处理私聊和群聊消息事件',
    icon: MessageSquare,
    href: '/trigger/message',
  },
  {
    type: 'request',
    name: '请求触发器',
    description: '处理好友请求和群组邀请事件',
    icon: UserPlus,
    href: '/trigger/request',
  },
  {
    type: 'notice',
    name: '通知触发器',
    description: '处理群成员变动、禁言等通知事件',
    icon: Bell,
    href: '/trigger/notice',
  },
];

export default function TriggerPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">触发器管理</h1>
      <p className="text-muted-foreground mb-8">
        配置触发条件，包括事件类型、匹配规则和权限控制。触发器可以在多个流程中复用。
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {triggerTypes.map((trigger) => (
          <Link key={trigger.type} href={trigger.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <trigger.icon className="w-6 h-6" />
                  </div>
                  <CardTitle>{trigger.name}</CardTitle>
                </div>
                <CardDescription>{trigger.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-primary hover:underline">
                  查看配置 →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
