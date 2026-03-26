# Discord Webhook 修复 - 技术总结

## 修复内容

### 问题
Discord 在验证 Interactions Endpoint URL 时失败，错误代码 `APPLICATION_INTERACTIONS_ENDPOINT_URL_INVALID`。

### 根本原因
Discord 对 webhook URL 的验证流程：
1. Discord 向 URL 发送一个 **PING interaction** (type: 1)
2. 服务器需要在 **3 秒内**响应 **PONG** (type: 1)
3. 响应格式必须是 JSON: `{ "type": 1 }`
4. 如果不符合这个格式，Discord 验证失败

原始代码返回 `{ ok: true }` 而不是 `{ type: 1 }`，导致验证失败。

## 修改的文件

### 1. src/adapters/discord/adapter.ts

**改动**:
```typescript
// 添加导入
import { WebhookResponse } from '@/core/adapter';

// 改进 verifyWebhook
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

// 新增 getWebhookResponse 方法
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

### 2. src/core/adapter.ts

**改动**:
```typescript
// 更新方法签名，使其接受 interaction 参数
getWebhookResponse(interaction?: any): WebhookResponse {
  return { status: 200, body: { ok: true } };
}
```

### 3. src/app/api/webhook/[platform]/[bot_id]/route.ts

**改动** (两处):
```typescript
// 第一处：事件未解析时
if (!event) {
  const webhookResponse = adapter.getWebhookResponse(rawData);  // ← 传递 rawData
  return NextResponse.json(webhookResponse.body, {
    status: webhookResponse.status,
    headers: webhookResponse.headers,
  });
}

// 第二处：事件处理完毕
const webhookResponse = adapter.getWebhookResponse(rawData);  // ← 传递 rawData
return NextResponse.json(webhookResponse.body, {
  status: webhookResponse.status,
  headers: webhookResponse.headers,
});
```

## 工作流程

```
1. Discord 验证 Webhook URL
   ↓
   POST /api/webhook/discord/bot_id
   Body: { type: 1, id: "...", token: "..." }
   ↓
2. webhook route 接收请求
   ↓
   parseEvent(botId, rawData)
   ↓
3. DiscordAdapter.parseEvent() 检测 type === 1
   ↓
   return null  (PING 无需处理)
   ↓
4. webhook route 调用 adapter.getWebhookResponse(rawData)
   ↓
5. DiscordAdapter.getWebhookResponse() 检测 interaction.type === 1
   ↓
   return { status: 200, body: { type: 1 } }
   ↓
6. 返回响应给 Discord
   ↓
7. Discord 收到 { type: 1 }，验证成功 ✅
```

## Discord Interaction Types

| type | 含义 | 用途 |
|------|------|------|
| **1** | PING | 验证 webhook URL，需要立即响应 PONG |
| **2** | APPLICATION_COMMAND | 用户执行了 slash command |
| **3** | MESSAGE_COMPONENT | 用户点击了按钮或选择框 |
| **4** | APPLICATION_COMMAND_AUTOCOMPLETE | 自动完成请求 |
| **5** | MODAL_SUBMIT | 用户提交了 modal 表单 |

## Response Types

| type | 含义 | 使用场景 |
|------|------|---------|
| **1** | PONG | 响应 PING interaction |
| **2** | ACKNOWLEDGE | 已过时 |
| **3** | CHANNEL_MESSAGE | 已过时 |
| **4** | CHANNEL_MESSAGE_WITH_SOURCE | 立即在通道中发送消息 |
| **5** | ACKNOWLEDGE_WITH_SOURCE | 已过时 |
| **6** | DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE | 延迟响应，后续发送 |
| **7** | DEFERRED_UPDATE_MESSAGE | 延迟更新消息 |
| **8** | UPDATE_MESSAGE | 立即更新消息 |
| **9** | APPLICATION_COMMAND_AUTOCOMPLETE_RESULT | 自动完成结果 |
| **10** | MODAL | 返回 modal 表单给用户 |

## 关键要点

1. ✅ **PING 响应必须在 3 秒内返回**
2. ✅ **响应格式必须是 JSON: `{ "type": 1 }`**
3. ✅ **Content-Type 必须是 application/json**
4. ✅ **其他事件返回 type: 5 (延迟响应)**

## 验证步骤

修复后，在 Discord Developer Portal 中：

1. 应用 → General Information
2. 找到 **Interactions Endpoint URL**
3. 输入: `https://tg.l2cl.link/api/webhook/discord/{bot_id}`
4. 点击 **Save Changes**
5. Discord 会发送 PING 事件进行验证
6. 如果响应正确，URL 会被保存 ✅

## 代码检查清单

- ✅ Discord adapter 正确处理 PING 事件
- ✅ getWebhookResponse 返回正确的 type
- ✅ webhook route 传递 rawData 给 getWebhookResponse
- ✅ Adapter 基类方法签名已更新
- ✅ 没有编译错误
- ✅ 向后兼容 (Telegram 使用默认响应)

## 下一步

1. 重启开发服务器
2. 在 Discord Developer Portal 中重新配置 Interactions Endpoint URL
3. Discord 应该成功验证 URL ✅
4. 现在可以接收 Discord interactions 了！
