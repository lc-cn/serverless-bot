'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, UserPlus, Bell, Plus, Briefcase, Zap } from 'lucide-react';
import { Flow } from '@/types';

const eventTypeConfig = {
  message: { name: '消息', icon: MessageSquare, color: 'text-blue-500' },
  request: { name: '请求', icon: UserPlus, color: 'text-green-500' },
  notice: { name: '通知', icon: Bell, color: 'text-orange-500' },
};

export default function FlowPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [filter, setFilter] = useState<'all' | 'message' | 'request' | 'notice'>('all');

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error('Failed to load flows:', error);
    }
  };

  const filteredFlows = flows.filter(flow => 
    filter === 'all' || flow.eventType === filter
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">事件流转</h1>
          <p className="text-muted-foreground mt-1">
            编排触发器和作业，定义完整的事件处理流程
          </p>
        </div>
      </div>

      {/* 筛选标签 */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          全部 ({flows.length})
        </Button>
        {Object.entries(eventTypeConfig).map(([type, config]) => {
          const Icon = config.icon;
          const count = flows.filter(f => f.eventType === type).length;
          return (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type as any)}
            >
              <Icon className="w-4 h-4 mr-1" />
              {config.name} ({count})
            </Button>
          );
        })}
      </div>

      {/* 快捷入口卡片 */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {Object.entries(eventTypeConfig).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <Link key={type} href={`/flow/${type}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-primary/10 ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium">{config.name}流程</div>
                        <div className="text-xs text-muted-foreground">
                          {flows.filter(f => f.eventType === type).length} 个流程
                        </div>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Flow 列表 */}
      {filteredFlows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {filter === 'all' ? '暂无流程' : `暂无${eventTypeConfig[filter]?.name}流程`}
            </p>
            <div className="flex gap-2">
              {filter === 'all' ? (
                Object.entries(eventTypeConfig).map(([type, config]) => (
                  <Link key={type} href={`/flow/${type}`}>
                    <Button variant="outline" size="sm">
                      创建{config.name}流程
                    </Button>
                  </Link>
                ))
              ) : (
                <Link href={`/flow/${filter}`}>
                  <Button variant="outline" size="sm">
                    创建流程
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFlows
            .sort((a, b) => b.priority - a.priority)
            .map((flow) => {
              const config = eventTypeConfig[flow.eventType];
              const Icon = config.icon;
              return (
                <Link key={flow.id} href={`/flow/${flow.eventType}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${config.color}`} />
                            <Badge variant="outline" className="text-xs">
                              {config.name}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              优先级: {flow.priority}
                            </Badge>
                            {!flow.enabled && (
                              <Badge variant="secondary">已禁用</Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg">{flow.name}</CardTitle>
                          {flow.description && (
                            <CardDescription className="mt-1">
                              {flow.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          <span>{flow.triggerIds?.length || 0} 个触发器</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          <span>{flow.jobIds?.length || 0} 个作业</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
