# BotListClient 动态 Schema 支持 - 修复总结

## 问题描述
Discord 适配器的表单显示错误的字段。用户反馈："discord 的 bot 的 schema 对不对呢？现在生成的表单，和你的描述不符呢？"

### 根本原因
`BotListClient` 组件硬编码了 Telegram 的字段名 (`accessToken` 和 `secret`)，导致：
- Discord 表单显示错误的字段
- 新增的任何适配器都需要修改组件代码
- 表单无法真正支持多适配器

## 解决方案

### 修改的文件
1. **src/components/bot/bot-list-client.tsx** - 核心改动
2. **src/app/(dashboard)/adapter/[platform]/page.tsx** - 已正确传递 schema

### 具体改动

#### 1. 更新 Props 接口
```typescript
interface BotListClientProps {
  platform: string;
  initialBots: BotConfig[];
  botConfigSchema?: FormUISchema;  // ← 新增参数
}
```

#### 2. 修改导入
从 `@/types` 改为从 `@/core` 导入：
```typescript
import { FormUISchema, FormField } from '@/core';
```

#### 3. 创建动态初始化函数
```typescript
const getInitialConfig = () => {
  if (!botConfigSchema?.fields) {
    return { accessToken: '', secret: '' }; // Fallback 到 Telegram
  }
  const config: Record<string, string> = {};
  botConfigSchema.fields.forEach((field: FormField) => {
    config[field.name] = '';
  });
  return config;
};
```

#### 4. 使用动态初始化
```typescript
const [newBot, setNewBot] = useState({
  name: '',
  id: '',
  config: getInitialConfig(),  // ← 动态生成
});
```

#### 5. 替换硬编码的表单字段
**之前** (硬编码):
```tsx
<div>
  <label className="block text-sm font-medium mb-1">Access Token</label>
  <Input type="password" value={(newBot.config.accessToken as string) || ''} ... />
</div>
<div>
  <label className="block text-sm font-medium mb-1">Secret</label>
  <Input type="password" value={(newBot.config.secret as string) || ''} ... />
</div>
```

**之后** (动态生成):
```tsx
{botConfigSchema?.fields?.map((field: FormField) => (
  <div key={field.name}>
    <label className="block text-sm font-medium mb-1">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
    <Input
      type={field.type || 'text'}
      value={(newBot.config[field.name] as string) || ''}
      onChange={(e) =>
        setNewBot({
          ...newBot,
          config: { ...newBot.config, [field.name]: e.target.value },
        })
      }
      placeholder={field.placeholder || ''}
    />
  </div>
))}
```

## 验证结果

### Discord 适配器
✅ **字段** (来自 getBotConfigUISchema):
- `token` - Bot Token (password field)
- `publicKey` - Public Key (password field)

### Telegram 适配器  
✅ **字段** (来自 getBotConfigUISchema):
- `accessToken` - Bot Token (password field)
- `secret` - Webhook Secret (optional password field)

## 效果

### 现在的行为
| 适配器 | 显示的字段 | 备注 |
|------|-----------|------|
| Discord | Bot Token + Public Key | ✓ 正确 |
| Telegram | Bot Token + Webhook Secret | ✓ 正确 |
| 未来适配器 | 自动根据 schema | ✓ 自动支持 |

## 关键优势
1. ✅ **支持多适配器** - 无需修改组件代码
2. ✅ **类型安全** - 完整的 TypeScript 类型检查
3. ✅ **可扩展** - 新适配器自动支持
4. ✅ **向后兼容** - Telegram 和现有所有功能保持不变
5. ✅ **动态字段** - 支持任意数量和类型的字段

## 测试状态
- ✅ 代码编译通过 (无 TS 错误)
- ✅ Discord schema 验证: token, publicKey
- ✅ Telegram schema 验证: accessToken, secret
- ✅ page.tsx 正确提取和传递 schema
- ✅ 表单动态渲染逻辑正确

## 后续可选改进
1. 添加更多字段类型支持 (select, checkbox, textarea 等)
2. 添加字段验证错误显示
3. 添加字段依赖关系支持
4. 添加条件字段显示逻辑
