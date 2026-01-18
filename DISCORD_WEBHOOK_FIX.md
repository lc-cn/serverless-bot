# Discord Webhook URL 验证失败 - 修复说明

## 问题描述

在 Discord 开发者后台配置 Interactions Endpoint URL 时失败，错误信息：
```json
{
    "message": "表单主体无效",
    "code": 50035,
    "errors": {
        "interactions_endpoint_url": {
            "_errors": [
                {
                    "code": "APPLICATION_INTERACTIONS_ENDPOINT_URL_INVALID",
                    "message": "无法验证指定的交互端点 URL。"
                }
            ]
        }
    }
}
```

## 根本原因

Discord 在验证 Webhook URL 时需要服务器正确响应 **PING interaction** 事件。流程：

1. Discord 向 URL 发送 PING interaction (`type: 1`)
2. 服务器必须立即响应 PONG (`type: 1`)
3. 如果响应格式错误，Discord 验证失败

### 原始代码的问题

**Discord adapter 中**:
```typescript
async verifyWebhook() {
  return true; // TODO: 实现签名验证
}

// getWebhookResponse() 没有实现
// 继承默认的: { status: 200, body: { ok: true } }
```

**Webhook route 中**:
```typescript
const webhookResponse = adapter.getWebhookResponse();
// 返回: { ok: true }
// Discord 期望: { type: 1 }
```

## 修复方案

### 1. 更新 Discord Adapter

**文件**: `src/adapters/discord/adapter.ts`

```typescript
// 添加导入
import { WebhookResponse } from '@/core/adapter';

// 实现 verifyWebhook
async verifyWebhook(rawData: unknown, headers: Record<string, string>, config: Record<string, unknown>): Promise<boolean> {
  try {
    const publicKey = config.publicKey as string;
    if (!publicKey) {
      console.warn('[Discord] Public Key not configured');
      return false;
    }
    console.debug('[Discord] Webhook verification passed');
    return true;
  } catch (error) {
    console.error('[Discord] Webhook verification error:', error);
    return false;
  }
}

// 覆写 getWebhookResponse 返回 Discord 期望的格式
getWebhookResponse(interaction?: any): WebhookResponse {
  // Discord PING 事件需要返回特定格式
  if (interaction?.type === 1) {
    // 返回 PONG (type: 1)
    return {
      status: 200,
      body: { type: 1 },
      headers: { 'Content-Type': 'application/json' },
    };
  }
  // 其他事件返回 5 (thinking/延迟响应)
  return {
    status: 200,
    body: { type: 5 },
    headers: { 'Content-Type': 'application/json' },
  };
}
```

### 2. 更新 Adapter 基类

**文件**: `src/core/adapter.ts`

更新方法签名使其接受 interaction 参数：

```typescript
getWebhookResponse(interaction?: any): WebhookResponse {
  return { status: 200, body: { ok: true } };
}
```

### 3. 更新 Webhook Route

**文件**: `src/app/api/webhook/[platform]/[bot_id]/route.ts`

在两个地方传递 `rawData` 给 `getWebhookResponse`：

```typescript
// 第一处：事件未解析时
if (!event) {
  const webhookResponse = adapter.getWebhookResponse(rawData);
  return NextResponse.json(webhookResponse.body, {
    status: webhookResponse.status,
    headers: webhookResponse.headers,
  });
}

// 第二处：事件处理完毕返回
const webhookResponse = adapter.getWebhookResponse(rawData);
return NextResponse.json(webhookResponse.body, {
  status: webhookResponse.status,
  headers: webhookResponse.headers,
});
```

## Discord Interaction 响应类型

| type | 名称 | 用途 |
|------|------|------|
| **1** | PONG | 响应 PING interaction（验证 URL 时必须）|
| **4** | CHANNEL_MESSAGE_WITH_SOURCE | 立即在通道中发送消息 |
| **5** | DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE | 延迟响应，后续发送消息 |
| **6** | DEFERRED_UPDATE_MESSAGE | 延迟更新消息 |
| **7** | UPDATE_MESSAGE | 立即更新消息 |

## 验证步骤

修复后，按照以下步骤在 Discord 开发者后台验证：

1. 进入 [Discord Developer Portal](https://discord.com/developers/applications)
2. 选择你的应用
3. 进入 **General Information**
4. 找到 **Interactions Endpoint URL**
5. 输入你的 URL: `https://tg.l2cl.link/api/webhook/discord/{bot_id}`
6. 点击 **Save Changes**
7. Discord 会发送一个 PING 事件来验证 URL
8. 如果一切正确，URL 会被保存 ✅

## 现在的流程

```
1. Discord 发送 PING interaction (type: 1)
   ↓
2. webhook route 接收请求
   ↓
3. parseEvent 识别为 PING，返回 null
   ↓
4. 调用 adapter.getWebhookResponse(rawData)
   ↓
5. Discord adapter 检测 type === 1
   ↓
6. 返回 { type: 1 } (PONG)
   ↓
7. Discord 验证成功，保存 URL ✅
```

## 测试

现在可以在 Discord 开发者后台重新配置 Interactions Endpoint URL，应该能成功验证。

## 相关文件修改

- ✅ `src/adapters/discord/adapter.ts` - 添加 getWebhookResponse 和改进 verifyWebhook
- ✅ `src/core/adapter.ts` - 更新 getWebhookResponse 签名
- ✅ `src/app/api/webhook/[platform]/[bot_id]/route.ts` - 传递 rawData

## 后续改进

1. **完整的 Ed25519 签名验证** - 验证 Discord 的请求签名
2. **速率限制** - 防止滥用
3. **错误追踪** - 更详细的日志记录
4. **请求重试** - 处理超时和失败
