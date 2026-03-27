# 环境变量白名单

目标：**业务可调参数由超级管理员在控制台（数据库 `platform_settings` / `auth_settings`）配置**；环境变量仅保留「连库、密钥、部署边界」等不宜或无法放进业务库的配置。

## 允许使用的环境变量（白名单）

### 运行与框架

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | Node / Next 标准 |
| `NEXT_RUNTIME` | Next 内部 |
| `NEXT_PHASE` | Next 构建阶段 |
| `NEXTAUTH_URL` / `AUTH_URL` | 应用对外 URL（OAuth 回调、WebAuthn origin） |
| `NEXTAUTH_SECRET` | 会话与安装 Cookie 签名（生产必填） |

### 主数据库

| 变量 | 说明 |
|------|------|
| `DATABASE_ENGINE` | `libsql` / `nodejs-sqlite` / `mysql` |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | **首选**（Vercel Turso 集成）；可与下右混用 Token |
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` | 次选 / 本地兼容；解析优先级低于 `TURSO_*` |
| `SQLITE_PATH` | 本地 SQLite 文件路径 |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` / `MYSQL_POOL_SIZE` | MySQL |

### KV（Redis REST / 内存）

| 变量 | 说明 |
|------|------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **首选**（Vercel KV；写 Token） |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 次选（Upstash 控制台命名） |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel 注入的只读 Token；**应用不使用**（请用 `KV_REST_API_TOKEN`） |
| `KV_BACKEND` | 强制 `memory` 等 |
| `UPSTASH_DISABLE_TELEMETRY` | 可选 |

### 安装与内部 API（机机密钥，不进入业务设置表）

| 变量 | 说明 |
|------|------|
| `INSTALL_SECRET` | 生产安装变更 API |
| `INSTALL_COOKIE_SECRET` | 可选；默认复用 `NEXTAUTH_SECRET` |
| `FLOW_WORKER_SECRET` | 异步 Flow Worker 请求头 |
| `CRON_TICK_SECRET` | 定时任务 tick 请求头 |
| `DEV_DANGEROUS_API_SECRET` | 开发危险 API（可选） |

### 加密根密钥

| 变量 | 说明 |
|------|------|
| `AGENTS_ENCRYPTION_KEY` | LLM Agent 等 API Key 加密；可选，可回落 `NEXTAUTH_SECRET` |

### 出站网络（基础设施）

| 变量 | 说明 |
|------|------|
| `HTTP_PROXY` / `HTTPS_PROXY` | 适配器出站代理（如 Telegram） |

### 已迁移到数据库（勿再依赖 ENV 作为唯一来源）

以下项由 **`platform_settings`**（控制台 **设置 → 平台参数**）或 **`auth_settings`** 管理；新部署以控制台为准（**GitHub OAuth Client ID/Secret 仅保存在 `auth_settings`，不再读取 `GITHUB_CLIENT_*` 环境变量**）：

- Flow / Webhook 预算、队列、去重、异步开关、`call_api` 默认超时等 → `platform_settings`
- 会话刷新间隔、混合聊天 SQL 策略 → `platform_settings`
- LLM Agent 工具轮次上限（全局默认）→ `platform_settings`
- 注册 / GitHub / Passkey / 邮件等 → `auth_settings`

详见 `.env.example` 与 [runbook/deployment.md](./runbook/deployment.md)。
