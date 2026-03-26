# 内部审计日志（强隔离 / 合规）

面向约 30 人内部平台：**谁在什么时候对哪些资源做了变更**；敏感字段不入库。

## 数据库

- 初始化：`migrations/001_initial.sql`（含表 `audit_log`）
- 表：`audit_log`（`actor_user_id` 无外键——用户删除后仍可追溯历史 ID）

## 权限

- 查询列表需 **`audit:read`**
- **super_admin**、**admin** 在 `initializeRBAC` 中已包含该权限；老环境需在部署后跑一次会 upsert 角色的初始化（或手工更新 `roles` 表 JSON）

## API

`GET /api/audit`

| Query | 说明 |
|-------|------|
| `limit` | 默认 50 |
| `offset` | 默认 0 |
| `entityType` | 可选，如 `flow`、`llm_tool` |
| `actorUserId` | 可选，按操作者过滤 |

响应体含 `items`（审计行）与 `viewerId`（当前会话用户 ID）。

## 记录范围（写库成功后异步写审计，失败仅 `console.warn`）

典型 `entityType` / `action`：

- Flow / Job / Trigger CRUD
- Adapter 与 Bot 的创建、更新、删除
- User / Role、LLM Agent / Skill / Tool 等的变更
- 载荷通常仅含名称、ID、是否触及大块配置等元数据，**不含密钥与完整 config**

## 运维注意

- 列表接口需登录与会话，与仪表盘其他 API 一致；**不作为公开 webhook**
- 定期备份主库即备份审计；可按 `created_at` 做归档策略（本项目未内置 TTL）
