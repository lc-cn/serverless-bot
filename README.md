# Serverless Bot

基于 **Next.js** 的机器人控制台与 Webhook 框架：可部署于 **任意能跑 Node 的环境**（Vercel、Docker、VPS 等）。主数据使用 **libSQL**（Turso 云或自建/本地 `file:`），聊天与事件日志使用 **Redis HTTP API**（`@upstash/redis`，与 Upstash/Vercel KV 等 REST 端兼容）或退化为**内存**。

## 特性

- 🚀 **多形态部署** - Vercel Serverless、Docker（standalone）、`pnpm start` 自建
- 🔌 **多平台支持** - 可扩展的适配器架构，支持 Telegram、Discord、Slack 等
- 🔄 **事件路由** - 将消息/请求/通知事件交给 Agent 或步骤流水线处理
- 💾 **可插拔缓存** - Redis REST / 内存 KV；主库 Turso
- 🎨 **可视化管理** - 内置 Web 管理界面
- 🌐 **多语言** - [next-intl](https://next-intl.dev/docs/getting-started/app-router)：`/zh-CN/...` 与 `/en/...`，控制台右上角可切换；文案在 `src/messages/`，详见 `docs/runbook/deployment.md`「控制台多语言」

## 快速开始

### 安装依赖

推荐使用 **pnpm**（与仓库锁文件一致）：

```bash
pnpm install
```

亦可用 `npm install` / `yarn`，但请以本仓库的 `pnpm-lock.yaml` 为准。

启用 Corepack 可固定 pnpm 版本：`corepack enable`（可选）。

### 本地开发

```bash
pnpm dev
```

默认开发端口为 **3001**：http://localhost:3001

### 认证（登录与注册）

应用 **NextAuth**；迁移 `auth_upgrade` 后主策略在数据库表 `auth_settings`（超级管理员在控制台 **设置 → 认证** 修改）：开放/关闭注册、GitHub 与 Passkey 开关、是否允许绑定与 OAuth 自助注册、**SMTP 与邮件模板**（用于后续邮箱验证/重置密码等）等。

- **邮箱/用户名 + 密码**：自助注册（若未关闭）与登录；首个成功创建的用户主体自动为 **super_admin**。
- **GitHub**：在控制台 **设置 → 认证** 填写 OAuth 应用的 Client ID / Secret（写入 `auth_settings`）；是否允许新用户或绑定仍由同页开关控制。回调地址为 `{NEXTAUTH_URL}/api/auth/callback/github`。
- **Passkey**：依赖 `WEBAUTHN_RP_ID`（生产通常为站点域名，无端口）与 `NEXTAUTH_URL`（须与实际访问 URL 一致）。

详见 `.env.example` 与 [docs/runbook/deployment.md](./docs/runbook/deployment.md)。

### 部署方式

- **Vercel 等 Serverless**：`vercel` 或等价平台，配置 libSQL + Redis REST（或仅内存调试）。
- **Docker**：`docker build -t serverless-bot .`，详见 [docs/runbook/deployment.md](./docs/runbook/deployment.md)（[文档索引](./docs/README.md)）。
- **自建 Node**：`pnpm build && pnpm start`（或运行 `.next/standalone` 内的 `node server.js`），并配置 `NEXTAUTH_URL` 等环境变量。

## 项目结构

```
src/
├── adapters/          # 各平台 Adapter + Bot 实现与注册（index.ts）
├── app/               # Next.js App Router：页面、(dashboard)、api、install、auth
├── components/        # 可复用 UI 与业务表单组件
├── core/              # 领域核心：Adapter/Bot 契约、FlowProcessor、匹配与权限
├── llm/               # LLM  vendor 适配与注册（OpenAI 兼容等）
├── lib/               # 服务端工具与数据访问（见 src/lib/README.md）
│   ├── data-layer/    # DB+KV 组合入口
│   ├── database/ kv/ install/
│   ├── persistence/   # data + storage 门面 + chat-store
│   ├── auth/          # NextAuth、认证设置、permissions
│   ├── crypto/ steps/ trigger/ onboarding/ runtime/ http/ audit/ mail/ webauthn/ …
│   └── shared/        # 通用 utils（如 shadcn 用的 cn）
├── proxy.ts           # 请求边界（安装重定向等；旧名 middleware）
├── types/             # 全站类型与 auth 类型
migrations/            # SQL 迁移（SQLite/libSQL）；mysql/ 为 MySQL 脚本
docs/                  # 文档中心（docs/README.md）
```

更细的 `lib` 分层说明见 [src/lib/README.md](./src/lib/README.md)；部署与环境见 [docs/runbook/deployment.md](./docs/runbook/deployment.md)。

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
POST https://your-domain.com/api/webhook/telegram/my-bot-123
```

## 环境变量

更完整的说明见 [.env.example](./.env.example) 与 [docs/runbook/deployment.md](./docs/runbook/deployment.md)。

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` | 主库 libSQL；本地可用 `file:./db.sqlite` | 生产建议 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST | 否 |
| `KV_BACKEND=memory` | 强制内存 KV（不连 Redis） | 否 |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | 登录与公网根 URL、会话 | 是 |

> 未配置 Redis REST 时，聊天与事件日志使用**进程内内存**，重启后丢失。

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
