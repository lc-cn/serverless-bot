import Link from 'next/link';
import { Bot, Workflow, Settings } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Serverless Bot</h1>
          <p className="text-muted-foreground text-lg">
            一个基于 Next.js 的 Serverless 机器人框架
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Link
            href="/adapter"
            className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Settings className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-semibold">适配器管理</h2>
            </div>
            <p className="text-muted-foreground">
              配置各平台适配器，管理机器人实例
            </p>
          </Link>

          <Link
            href="/flow"
            className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Workflow className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-semibold">事件流转</h2>
            </div>
            <p className="text-muted-foreground">
              配置消息、请求、通知事件的处理流程
            </p>
          </Link>

          <Link
            href="/docs"
            className="group p-6 rounded-lg border bg-card hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Bot className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-semibold">开发文档</h2>
            </div>
            <p className="text-muted-foreground">
              查看 API 文档和开发指南
            </p>
          </Link>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold mb-4">快速开始</h3>
          <div className="bg-card border rounded-lg p-4 max-w-2xl mx-auto text-left">
            <pre className="text-sm overflow-x-auto">
              <code>{`# Webhook URL 格式
POST /api/webhook/{platform}/{bot_id}

# 示例
POST /api/webhook/telegram/my-bot-123`}</code>
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}
