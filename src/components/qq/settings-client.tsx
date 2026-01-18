"use client";

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

type BotItem = { id: string; name: string; config: Record<string, unknown> };

type Props = {
  bots: BotItem[];
};

export function QQSettingsClient({ bots }: Props) {
  const [selectedBot, setSelectedBot] = useState(bots[0]?.id || '');
  const [copied, setCopied] = useState(false);

  const bot = bots.find(b => b.id === selectedBot);
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/qq/${selectedBot}`
    : `/api/webhook/qq/${selectedBot}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Bot 选择器 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">选择 Bot</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={selectedBot}
          onChange={(e) => setSelectedBot(e.target.value)}
        >
          {bots.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.id})
            </option>
          ))}
        </select>
      </div>

      {/* Webhook URL */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Webhook 回调地址</h3>
        <p className="text-sm text-muted-foreground">
          在 QQ 开放平台配置此地址作为事件回调 URL。支持端口：80、443、8080、8443。
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            className="flex-1 rounded border bg-muted px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="rounded border px-3 py-2 hover:bg-muted transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 事件订阅说明 */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">事件订阅 Intents</h3>
        <p className="text-sm text-muted-foreground">
          在 QQ 开放平台选择需要订阅的事件类型。常用事件：
        </p>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">GROUP_AND_C2C_EVENT</code>
            <span className="text-muted-foreground">群聊和单聊消息</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">PUBLIC_GUILD_MESSAGES</code>
            <span className="text-muted-foreground">频道@机器人消息</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">DIRECT_MESSAGE</code>
            <span className="text-muted-foreground">频道私信</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-muted px-2 py-0.5 rounded">INTERACTION</code>
            <span className="text-muted-foreground">互动事件（按钮等）</span>
          </div>
        </div>
      </div>

      {/* 消息限制说明 */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">消息发送限制</h3>
        <div className="text-sm space-y-2 text-muted-foreground">
          <p><strong>单聊：</strong>主动消息每月 4 条；被动回复 60 分钟内有效，最多 5 次</p>
          <p><strong>群聊：</strong>主动消息每月 4 条；被动回复 5 分钟内有效，最多 5 次</p>
          <p><strong>频道：</strong>主动消息每天 20 条/子频道；被动回复 5 分钟内有效</p>
          <p className="text-xs">⚠️ 主动消息于 2025/4/21 起已停止提供</p>
        </div>
      </div>

      {/* 跳转开放平台 */}
      <a
        href="https://q.qq.com/qqbot/#/developer/webhook-setting"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        前往 QQ 开放平台配置
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
