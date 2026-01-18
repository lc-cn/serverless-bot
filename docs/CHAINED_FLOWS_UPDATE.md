# 链式 Flow 功能更新

## 🎯 新增功能

### trigger_flow 动作类型

实现了 Flow 之间的链式调用，让一个 Flow 可以触发另一个 Flow 执行，并传递处理结果。

## ✨ 核心特性

1. **链式调用**
   - 一个 Flow 可以触发另一个 Flow
   - 支持同步（sync）和异步（async）执行模式
   - 变量在 Flow 之间传递

2. **数据传递**
   - 继承父 Flow 的变量
   - 选择性传递变量（部分或全部）
   - 子 Flow 的结果可保存回父 Flow

3. **安全机制**
   - 执行深度限制（最大 10 层，防止无限递归）
   - 循环引用检测（禁止 Flow 调用自身）
   - 独立的错误处理

## 📝 配置示例

### 基本用法

```json
{
  "type": "trigger_flow",
  "config": {
    "flowName": "数据处理",
    "mode": "sync",
    "passVariables": ["userId", "data"],
    "saveAs": "process_result"
  }
}
```

### 实际场景：数据验证 + 处理管道

**Flow 1: 数据验证**
```json
{
  "name": "数据验证",
  "match": { "type": "prefix", "pattern": "提交" },
  "actions": [
    {
      "type": "extract_data",
      "config": {
        "source": "event.rawContent",
        "type": "regex",
        "pattern": "提交\\s+(?<data>.*)",
        "saveAs": "raw_data"
      },
      "order": 1
    },
    {
      "type": "conditional",
      "config": {
        "condition": "${raw_data} && ${raw_data}.length > 0",
        "skipNext": 1
      },
      "order": 2
    },
    {
      "type": "send_message",
      "config": { "content": "❌ 数据不能为空" },
      "order": 3
    },
    {
      "type": "trigger_flow",
      "config": {
        "flowName": "数据处理",
        "mode": "sync",
        "passVariables": ["raw_data"],
        "saveAs": "result"
      },
      "order": 4
    },
    {
      "type": "send_message",
      "config": { "content": "✅ 处理完成：${result.executed}" },
      "order": 5
    }
  ]
}
```

**Flow 2: 数据处理**
```json
{
  "name": "数据处理",
  "match": { "type": "always", "pattern": "" },
  "actions": [
    {
      "type": "log",
      "config": {
        "message": "开始处理: ${inheritedVariables.raw_data}"
      },
      "order": 1
    },
    {
      "type": "call_api",
      "config": {
        "url": "https://api.example.com/process",
        "method": "POST",
        "body": { "data": "${inheritedVariables.raw_data}" },
        "saveAs": "api_result"
      },
      "order": 2
    }
  ]
}
```

## 🔒 安全限制

### 执行深度限制

最大嵌套深度为 10 层，防止无限递归：

```
Flow A → Flow B → Flow C → ... (最多 10 层)
```

### 循环引用检测

禁止 Flow 调用自身：

```json
{
  "type": "trigger_flow",
  "config": {
    "flowId": "current_flow_id"  // ❌ 错误
  }
}
```

## 📊 执行模式

| 模式 | 等待结果 | 获取结果 | 阻塞父 Flow | 适用场景 |
|------|---------|---------|------------|---------|
| sync | ✅ | ✅ | ✅ | 需要结果的流程 |
| async | ❌ | ❌ | ❌ | 后台任务、通知 |

## 🎨 最佳实践

1. **单一职责原则** - 每个 Flow 只做一件事
2. **合理使用同步/异步** - 根据是否需要结果选择模式
3. **变量传递策略** - 只传递必要的变量
4. **错误处理** - 检查子 Flow 的执行结果
5. **清晰命名** - Flow 和变量使用清晰的命名

## 📚 详细文档

完整的配置说明、场景示例和最佳实践请查看：
- [链式 Flow 完整指南](./CHAINED_FLOWS.md)

## 🔧 技术实现

- 新增 `trigger_flow` 动作类型
- 增强 `FlowContext` 支持深度和父 Flow 信息
- 实现 `executeTriggerFlow` 方法
- 添加递归深度检测和循环引用检测

---

**版本：** v2.1.0  
**日期：** 2026-01-17
