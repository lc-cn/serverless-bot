'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export function AdapterSetupGuide() {
  const [activeTab, setActiveTab] = useState('telegram');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>🚀 快速开始</CardTitle>
        <CardDescription>了解如何为各个平台配置机器人</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-neutral-200">
            <button
              onClick={() => setActiveTab('telegram')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'telegram'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              📱 Telegram
            </button>
            <button
              onClick={() => setActiveTab('discord')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'discord'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              🎮 Discord
            </button>
            <button
              onClick={() => setActiveTab('qq')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'qq'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              🐧 QQ
            </button>
          </div>

          {/* Telegram Tab */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              <h3 className="font-semibold">获取 Telegram Bot Token</h3>

              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="font-medium">步骤 1: 找到 BotFather</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 Telegram 中搜索 <code className="bg-muted px-2 py-1 rounded">@BotFather</code>，这是 Telegram 官方的机器人管理工具。
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="font-medium">步骤 2: 创建新机器人</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    发送 <code className="bg-muted px-2 py-1 rounded">/newbot</code> 命令，按照提示输入机器人名称和用户名。
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="font-medium">步骤 3: 获取 Token</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    BotFather 会返回你的 Bot Token，格式为 <code className="bg-muted px-2 py-1 rounded">123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</code>。
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">可选: 设置 Webhook</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 BotFather 中使用 <code className="bg-muted px-2 py-1 rounded">/setwebhook</code> 配置 Webhook URL（用于接收更新）。
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  💡 提示：妥善保管你的 Bot Token，不要在公开场合分享。
                </p>
              </div>

              <hr className="my-4" />

              <h3 className="font-semibold">如何在系统中使用?</h3>
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded border border-blue-300 dark:border-blue-700 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">1. 复制 Bot Token</span>：从 BotFather 复制获取到的 Token
                </p>
                <p className="text-sm">
                  <span className="font-medium">2. 点击下方 "Telegram" 适配器卡片</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">3. 点击 "查看机器人" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">4. 在打开的页面中找到 "Bot Token" 字段，粘贴你的 Token</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">5. 点击 "保存" 或 "启用" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">6. 完成！现在你可以开始接收 Telegram 消息了</span>
                </p>
              </div>
            </div>
          )}

          {/* Discord Tab */}
          {activeTab === 'discord' && (
            <div className="space-y-4">
              <h3 className="font-semibold">获取 Discord Bot Token 和 Public Key</h3>

              <div className="space-y-3">
                <div className="border-l-4 border-indigo-500 pl-4">
                  <p className="font-medium">步骤 1: 访问 Discord Developer Portal</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    打开{' '}
                    <a
                      href="https://discord.com/developers/applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Discord Developer Portal
                    </a>{' '}
                    并登录你的 Discord 账号。
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4">
                  <p className="font-medium">步骤 2: 创建新应用</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击 "New Application" 按钮，输入应用名称，然后创建。
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4">
                  <p className="font-medium">步骤 3: 获取 Bot Token</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在左侧菜单选择 "Bot"，点击 "Add Bot"。然后在 "TOKEN" 部分点击 "Copy" 复制你的 Bot Token。
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4">
                  <p className="font-medium">步骤 4: 获取 Public Key</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 "GENERAL INFORMATION" 部分，复制 "Public Key"。
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-4">
                  <p className="font-medium">步骤 5: 配置 Interaction Endpoint URL</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    回到 "General Information"，在 "INTERACTIONS ENDPOINT URL" 填入你的服务器地址（如{' '}
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      https://yourserver.com/api/webhooks/discord
                    </code>
                    ）。
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">可选: 添加 Bot 到服务器</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 "OAuth2" -&gt; "URL Generator" 中选择 <code className="bg-muted px-2 py-1 rounded text-xs">bot</code> 和需要的权限，然后使用生成的链接邀请 Bot 加入你的服务器。
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950 p-3 rounded border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                  💡 提示：Bot Token 和 Public Key 是敏感信息，请勿在代码中硬编码或公开分享。
                </p>
              </div>

              <hr className="my-4" />

              <h3 className="font-semibold">如何在系统中使用?</h3>
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 p-4 rounded border border-indigo-300 dark:border-indigo-700 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">1. 复制 Bot Token 和 Public Key</span>：从 Developer Portal 复制这两个值
                </p>
                <p className="text-sm">
                  <span className="font-medium">2. 点击下方 "Discord" 适配器卡片</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">3. 点击 "查看机器人" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">4. 在打开的页面中找到表单，分别填入：</span>
                </p>
                <div className="ml-4 space-y-1">
                  <p className="text-sm">• <strong>Bot Token</strong>：粘贴你的 Discord Bot Token</p>
                  <p className="text-sm">• <strong>Public Key</strong>：粘贴你的 Public Key</p>
                </div>
                <p className="text-sm">
                  <span className="font-medium">5. 点击 "保存" 或 "启用" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">6. 完成！现在你可以开始接收 Discord 消息了</span>
                </p>
              </div>
            </div>
          )}

          {/* QQ Tab */}
          {activeTab === 'qq' && (
            <div className="space-y-4">
              <h3 className="font-semibold">获取 QQ 机器人 AppID 和 AppSecret</h3>

              <div className="space-y-3">
                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">步骤 1: 访问 QQ 开放平台</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    打开{' '}
                    <a
                      href="https://q.qq.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      QQ 开放平台
                    </a>{' '}
                    并使用 QQ 登录，进入机器人管理后台。
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">步骤 2: 创建机器人应用</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    点击 "创建机器人"，填写机器人基本信息（名称、头像、介绍等）并提交审核。
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">步骤 3: 获取 AppID 和 AppSecret</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    审核通过后，在 "开发设置" 中可以找到 <code className="bg-muted px-2 py-1 rounded text-xs">AppID</code> 和{' '}
                    <code className="bg-muted px-2 py-1 rounded text-xs">AppSecret</code>。
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">步骤 4: 配置回调地址</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 "开发设置" -&gt; "回调配置" 中，设置消息接收地址：
                    <code className="bg-muted px-2 py-1 rounded text-xs block mt-1">
                      https://你的域名/api/webhook/qq/你的机器人ID
                    </code>
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">步骤 5: 配置事件订阅</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    在 "事件订阅" 中选择需要接收的事件类型，常用的有：
                  </p>
                  <ul className="text-sm text-muted-foreground mt-1 ml-4 list-disc">
                    <li>C2C_MESSAGE_CREATE - 单聊消息</li>
                    <li>GROUP_AT_MESSAGE_CREATE - 群聊 @ 消息</li>
                    <li>DIRECT_MESSAGE_CREATE - 频道私信</li>
                    <li>AT_MESSAGE_CREATE - 频道 @ 消息</li>
                  </ul>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  💡 提示：AppSecret 是敏感信息，用于签名验证，请勿泄露。配置回调地址后，QQ 会发送验证请求，系统会自动处理。
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ 注意：QQ 机器人目前有消息发送限制：
                </p>
                <ul className="text-sm text-amber-800 dark:text-amber-200 mt-1 ml-4 list-disc">
                  <li>被动回复：收到消息后 5 分钟内可回复，限 5 条</li>
                  <li>主动消息：需要用户主动触发后才能推送</li>
                </ul>
              </div>

              <hr className="my-4" />

              <h3 className="font-semibold">如何在系统中使用?</h3>
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded border border-green-300 dark:border-green-700 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">1. 复制 AppID 和 AppSecret</span>：从 QQ 开放平台复制这两个值
                </p>
                <p className="text-sm">
                  <span className="font-medium">2. 点击下方 "QQ" 适配器卡片</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">3. 点击 "查看机器人" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">4. 在打开的页面中找到表单，分别填入：</span>
                </p>
                <div className="ml-4 space-y-1">
                  <p className="text-sm">• <strong>AppID</strong>：粘贴你的 QQ 机器人 AppID</p>
                  <p className="text-sm">• <strong>AppSecret</strong>：粘贴你的 AppSecret</p>
                </div>
                <p className="text-sm">
                  <span className="font-medium">5. 点击 "保存" 或 "启用" 按钮</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">6. 复制生成的 Webhook URL，配置到 QQ 开放平台</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">7. 完成！现在你可以开始接收 QQ 消息了</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
