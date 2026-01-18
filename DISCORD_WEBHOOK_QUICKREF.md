# Discord Webhook 修复 - 快速参考

## 你遇到的问题

```
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

## 原因

Discord 验证 webhook URL 时，发送一个 PING 事件期望得到 PONG 响应，但我们的代码返回了错误的格式。

## 修复内容

| 部分 | 修改 |
|-----|------|
| **Discord Adapter** | 添加 `getWebhookResponse()` 方法，正确处理 PING 事件 |
| **Adapter 基类** | 更新 `getWebhookResponse()` 方法签名 |
| **Webhook Route** | 传递 `rawData` 给 `getWebhookResponse()` |

## 核心修改

### ✅ Discord 现在返回正确的响应

**修复前**:
```typescript
// 返回: { ok: true }
// ❌ Discord 期望: { type: 1 }
```

**修复后**:
```typescript
// 返回: { type: 1 }
// ✅ 正确!
```

## 修改的文件

1. `src/adapters/discord/adapter.ts`
   - 导入 `WebhookResponse`
   - 实现 `getWebhookResponse()` 方法

2. `src/core/adapter.ts`
   - 更新 `getWebhookResponse()` 方法签名

3. `src/app/api/webhook/[platform]/[bot_id]/route.ts`
   - 两处调用改为 `adapter.getWebhookResponse(rawData)`

## 下一步

1. **重启开发服务器**
   ```bash
   npm run dev
   ```

2. **在 Discord Developer Portal 配置 URL**
   - 进入 Applications → 你的应用
   - General Information
   - Interactions Endpoint URL
   - 输入: `https://tg.l2cl.link/api/webhook/discord/{bot_id}`
   - Save Changes
   - Discord 会验证并保存 ✅

3. **验证成功**
   - 如果 URL 被保存，说明修复成功
   - 现在可以接收 Discord interactions 了！

## 技术细节

### Discord Webhook 验证流程

```
1. 你在 Discord 后台输入 URL
   ↓
2. Discord POST PING interaction 到你的 URL
   Body: { type: 1, ... }
   ↓
3. 你的服务器需要在 3 秒内响应
   Response: { type: 1 }
   ↓
4. Discord 收到正确的响应格式
   ↓
5. URL 被保存 ✅
```

### 响应格式

**必须是 JSON**:
```json
{ "type": 1 }
```

**Content-Type**:
```
application/json
```

## 常见错误

| 错误 | 原因 |
|-----|------|
| `APPLICATION_INTERACTIONS_ENDPOINT_URL_INVALID` | 响应格式不正确（我们的情况） |
| `TIMEOUT` | 超过 3 秒没有响应 |
| `FORBIDDEN` | publicKey 不正确或签名验证失败 |

## 代码变化概览

### 添加到 Discord Adapter

```typescript
getWebhookResponse(interaction?: any): WebhookResponse {
  if (interaction?.type === 1) {
    return {
      status: 200,
      body: { type: 1 },
      headers: { 'Content-Type': 'application/json' },
    };
  }
  return {
    status: 200,
    body: { type: 5 },
    headers: { 'Content-Type': 'application/json' },
  };
}
```

### Webhook Route 改动

```typescript
// 之前
const webhookResponse = adapter.getWebhookResponse();

// 之后
const webhookResponse = adapter.getWebhookResponse(rawData);
```

## 验证成功标志

✅ 在 Discord Developer Portal 中能够保存 Interactions Endpoint URL  
✅ URL 旁边出现绿色的对勾  
✅ 开发者日志显示 PING 事件被成功处理

## 相关资源

- [Discord Interactions API](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Webhook 验证文档](https://discord.com/developers/docs/interactions/receiving-and-responding#receiving-an-interaction)

---

**状态**: ✅ 修复完成  
**测试**: 待验证（重启服务器后在 Discord 后台测试）  
**兼容性**: ✅ 不影响 Telegram 和其他适配器
