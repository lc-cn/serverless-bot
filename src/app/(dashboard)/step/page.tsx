'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StepType } from '@/types';
import {
  MessageSquare,
  Globe,
  Database,
  Variable,
  CheckCircle,
  XCircle,
  GitBranch,
  Timer,
  Calculator,
  FileText,
  Filter,
  Zap,
  Bell,
  ListChecks,
  Code,
} from 'lucide-react';

const stepTypeInfo: Record<StepType, { name: string; description: string; icon: any }> = {
  send_message: {
    name: '发送消息',
    description: '向用户或群组发送消息',
    icon: MessageSquare,
  },
  call_api: {
    name: '调用 API',
    description: '调用外部 HTTP API',
    icon: Globe,
  },
  call_bot: {
    name: '调用机器人',
    description: '调用机器人接口',
    icon: Zap,
  },
  hardcode: {
    name: '固定回复',
    description: '发送预设的固定消息',
    icon: FileText,
  },
  log: {
    name: '日志记录',
    description: '记录执行日志',
    icon: Code,
  },
  get_user_info: {
    name: '获取用户信息',
    description: '查询用户详细信息',
    icon: Database,
  },
  get_group_info: {
    name: '获取群组信息',
    description: '查询群组详细信息',
    icon: Database,
  },
  set_variable: {
    name: '设置变量',
    description: '设置或更新上下文变量',
    icon: Variable,
  },
  conditional: {
    name: '条件判断',
    description: '根据条件执行不同分支',
    icon: GitBranch,
  },
  delay: {
    name: '延迟执行',
    description: '延迟指定时间后继续',
    icon: Timer,
  },
  random_reply: {
    name: '随机回复',
    description: '从多个回复中随机选择',
    icon: Calculator,
  },
  template_message: {
    name: '模板消息',
    description: '使用模板渲染消息',
    icon: FileText,
  },
  forward_message: {
    name: '转发消息',
    description: '转发消息到其他对话',
    icon: MessageSquare,
  },
  handle_request: {
    name: '处理请求',
    description: '处理好友/群组请求',
    icon: CheckCircle,
  },
  recall_message: {
    name: '撤回消息',
    description: '撤回已发送的消息',
    icon: XCircle,
  },
  extract_data: {
    name: '提取数据',
    description: '从消息中提取结构化数据',
    icon: Filter,
  },
};

export default function StepPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">步骤管理</h1>
        <p className="text-muted-foreground mt-1">
          查看所有可用的步骤类型，在作业编辑页面中可以添加这些步骤
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(Object.entries(stepTypeInfo) as [StepType, typeof stepTypeInfo[StepType]][]).map(
          ([type, info]) => {
            const Icon = info.icon;
            return (
              <Card key={type}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{info.name}</CardTitle>
                      <code className="text-xs text-muted-foreground">{type}</code>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {info.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          }
        )}
      </div>
    </div>
  );
}
