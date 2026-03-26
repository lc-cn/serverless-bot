# `src/lib` 代码分层

面向 **服务端** 的工具与数据访问（`@/lib/...` 路径别名）。子目录按职责划分；各目录可有 `index.ts` 汇总导出。

| 路径 | 职责 |
|------|------|
| **`data-layer/`** | 数据驱动组合根：`getDataLayer()` / `getSql()` / `getKv()`，统一导出 `db`、`getKvRedis` 等；新建代码优先从此引用，而非直连 `database/db` |
| **`database/`** | 主库实现：`db.ts`、MySQL / node-sqlite、方言、`sql-upsert`、迁移 `sql-migrate`、`ensure-owner-schema` |
| **`kv/`** | KV 实现：`kv-runtime`（Redis REST / 内存）、`kv-logs` |
| **`persistence/`** | **领域持久化**：`data.ts`（按表读写）、`storage-facade.ts`（`storage` 门面）、`chat-store.ts`（混合聊天存储）；入口 `@/lib/persistence` |
| **`auth/`** | **认证与授权**：NextAuth（`next-auth.ts`）、`auth-settings`、`password-hash`；`permissions.ts` 为控制台/API 鉴权（`@/lib/auth/permissions`） |
| **`platform-settings.ts`**（根文件） | **平台运行时参数**：`platform_settings` 表 JSON；Flow/Webhook 队列、步骤超时、会话刷新等；`getPlatformSettings()` 带短 TTL 缓存 |
| **`crypto/`** | 加签与密钥：`ed25519`、`qq-ed25519`、`agent-key-crypto` |
| **`steps/`** | Flow 步骤：`step-schemas`、`step-type-groups`、模板变量提示 |
| **`trigger/`** | 触发器：`trigger-scope`、`trigger-ui-presets` |
| **`onboarding/`** | 入门向导：注册表、清单、板块状态、门禁 |
| **`runtime/`** | 运行环境与任务：`runtime`、`env-validation`、`request-trace`、Cron 相关、`scheduled-task-runner` |
| **`http/`** | HTTP/API 辅助：`api-wire-error`（统一错误体、客户端解析） |
| **`audit/`** | 审计日志写入与查询 |
| **`mail/`** | SMTP 发信（与 `auth-settings` 中的邮件配置配合） |
| **`webauthn/`** | Passkey：RP、`repo`、`verify-login` |
| **`webhook/`** | Webhook 入站、Flow 队列与处理管线 |
| **`sandbox/`** | 控制台沙箱聊天管线 |
| **`install/`** | 安装向导、`/api/install/*`、Vercel 环境同步 |
| **`i18n/`** | 服务端 locale、文案 catalog |
| **`mcp/`** | MCP 客户端运行时 |
| **`shared/`** | 通用工具：`utils`（如 `cn`、`generateId`），入口 `@/lib/shared/utils` |

新增模块时：**访问 DB/KV** → `@/lib/data-layer`；**业务实体 CRUD** → `@/lib/persistence`；**登录/会话/权限** → `@/lib/auth` 或 `@/lib/auth/permissions`；与 SQL 方言强相关 → `database/`；与 Redis 协议强相关 → `kv/`；仅安装流 → `install/`。
