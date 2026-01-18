# Serverless Bot

一个基于 Next.js 的 Serverless 机器人框架，专为 Vercel 部署设计。

## 特性

- 🚀 **Serverless 架构** - 完全基于 Vercel Serverless Functions
- 🔌 **多平台支持** - 可扩展的适配器架构，支持 Telegram、Discord、Slack 等
- 🔄 **事件流转** - 灵活的消息/请求/通知事件处理流程
- ⚡ **零配置部署** - 一键部署到 Vercel
- 🎨 **可视化管理** - 内置 Web 管理界面

## 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 本地开发

```bash
npm run dev
```

访问 http://localhost:3000 查看管理界面。

### 部署到 Vercel

```bash
vercel
```

## 项目结构

```
src/
├── adapters/          # 平台适配器
│   ├── telegram/      # Telegram 适配器示例
│   └── index.ts       # 适配器注册入口
├── app/
│   ├── api/
│   │   ├── adapters/  # 适配器管理 API
│   │   ├── flows/     # 流程管理 API
│   │   └── webhook/   # Webhook 入口
│   ├── (dashboard)/   # 管理界面页面
│   └── page.tsx       # 首页
├── components/        # React 组件
├── core/              # 核心模块
│   ├── bot.ts         # Bot 基类
│   ├── adapter.ts     # Adapter 基类
│   └── flow.ts        # Flow 处理器
├── lib/               # 工具库
│   ├── storage.ts     # 存储层
│   └── utils.ts       # 工具函数
└── types/             # 类型定义
```

## 核心概念

### Bot

Bot 是与具体平台交互的实体，负责：
- 发送消息
- 获取用户/群组信息
- 处理好友/群组请求

```typescript
abstract class Bot {
  abstract sendMessage(target: SendTarget, message: Message): Promise<SendResult>;
  abstract getUserList(groupId?: string): Promise<User[]>;
  abstract getGroupList(): Promise<Group[]>;
  abstract getUserDetail(userId: string): Promise<UserDetail | null>;
  abstract getGroupDetail(groupId: string): Promise<GroupDetail | null>;
}
```

### Adapter

Adapter 是平台适配器，负责：
- 解析 Webhook 事件
- 创建 Bot 实例
- 定义配置 Schema

```typescript
abstract class Adapter {
  abstract getAdapterConfigSchema(): z.ZodSchema;
  abstract getBotConfigSchema(): z.ZodSchema;
  abstract createBot(config: BotConfig): Bot;
  abstract parseEvent(botId: string, rawData: unknown, headers: Record<string, string>): Promise<BotEvent | null>;
  abstract verifyWebhook(rawData: unknown, headers: Record<string, string>, config: Record<string, unknown>): Promise<boolean>;
}
```

### Flow

Flow 是事件处理流程，包含：
- **匹配规则** - 精确匹配、前缀匹配、正则匹配等
- **权限控制** - 角色限制、环境限制（群/私聊）
- **处理动作** - 调用 API、发送消息、记录日志等

## 添加新适配器

1. 创建适配器目录 `src/adapters/your-platform/`

2. 实现 Bot 类：

```typescript
// src/adapters/your-platform/bot.ts
import { Bot } from '@/core/bot';

export class YourPlatformBot extends Bot {
  // 实现所有抽象方法...
}
```

3. 实现 Adapter 类：

```typescript
// src/adapters/your-platform/adapter.ts
import { Adapter } from '@/core/adapter';

export class YourPlatformAdapter extends Adapter {
  // 实现所有抽象方法...
}
```

4. 注册适配器：

```typescript
// src/adapters/index.ts
import { adapterRegistry } from '@/core';
import { YourPlatformAdapter } from './your-platform';

adapterRegistry.register(new YourPlatformAdapter());
```

## Webhook URL

```
POST /api/webhook/{platform}/{bot_id}
```

示例：
```
POST https://your-app.vercel.app/api/webhook/telegram/my-bot-123
```

## 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `VERCEL_KV_REST_API_URL` | Vercel KV 存储 URL | 否 |
| `VERCEL_KV_REST_API_TOKEN` | Vercel KV 存储 Token | 否 |

> 如果未配置 Vercel KV，将使用内存存储（数据在重启后丢失）

## API 文档

### 适配器 API

- `GET /api/adapters` - 获取所有适配器
- `POST /api/adapters` - 保存适配器配置
- `GET /api/adapters/{platform}` - 获取适配器详情
- `PUT /api/adapters/{platform}` - 更新适配器配置
- `DELETE /api/adapters/{platform}` - 删除适配器配置

### 机器人 API

- `GET /api/adapters/{platform}/bots` - 获取机器人列表
- `POST /api/adapters/{platform}/bots` - 创建机器人
- `GET /api/adapters/{platform}/bots/{bot_id}` - 获取机器人详情
- `PUT /api/adapters/{platform}/bots/{bot_id}` - 更新机器人
- `DELETE /api/adapters/{platform}/bots/{bot_id}` - 删除机器人

### 流程 API

- `GET /api/flows` - 获取所有流程
- `POST /api/flows` - 创建流程
- `GET /api/flows/{id}` - 获取流程详情
- `PUT /api/flows/{id}` - 更新流程
- `DELETE /api/flows/{id}` - 删除流程

## License

MIT
