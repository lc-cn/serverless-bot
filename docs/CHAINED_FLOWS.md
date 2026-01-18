# Flow 链式调用（Chained Flows）完整指南

## 📋 概述

链式 Flow 允许一个 Flow 的处理结果传递给下一个 Flow，形成完整的工作流管道。类似于工作流引擎中的 Job 组合模式，每个 Flow 专注于一个特定任务，通过组合实现复杂的业务逻辑。

## 🎯 核心特性

### 1. 链式调用
- ✅ 一个 Flow 可以触发另一个 Flow
- ✅ 支持同步/异步执行模式
- ✅ 变量在 Flow 之间传递

### 2. 数据传递
- ✅ 继承父 Flow 的变量
- ✅ 选择性传递变量（部分或全部）
- ✅ 子 Flow 的结果可保存回父 Flow

### 3. 安全机制
- ✅ 执行深度限制（防止无限递归）
- ✅ 循环引用检测
- ✅ 独立的错误处理

## 🔧 trigger_flow 动作配置

### 基本语法

```json
{
  "type": "trigger_flow",
  "config": {
    "flowId": "target_flow_id",           // 目标 Flow ID（优先）
    "flowName": "Target Flow Name",        // 或使用 Flow 名称
    "mode": "sync",                        // sync（同步）或 async（异步）
    "passVariables": ["var1", "var2"],     // 传递的变量列表（可选）
    "saveAs": "sub_flow_result"            // 保存子 Flow 结果（可选）
  }
}
```

### 配置参数详解

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `flowId` | string | 二选一 | 目标 Flow 的 ID |
| `flowName` | string | 二选一 | 目标 Flow 的名称 |
| `mode` | 'sync' \| 'async' | 否 | 执行模式，默认 sync |
| `passVariables` | string[] | 否 | 传递哪些变量，不指定则传递全部 |
| `newEvent` | object | 否 | 构造新事件（可选） |
| `saveAs` | string | 否 | 保存子 Flow 结果到变量 |

## 📚 使用场景

### 场景1：数据验证 + 处理管道

**需求：** 用户提交数据 → 验证 → 处理 → 通知

**Flow 1: 数据验证**
```json
{
  "id": "flow_validate",
  "name": "数据验证",
  "match": { "type": "prefix", "pattern": "提交" },
  "actions": [
    {
      "id": "1",
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
      "id": "2",
      "type": "conditional",
      "config": {
        "condition": "${raw_data} && ${raw_data}.length > 0",
        "skipNext": 1
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "send_message",
      "config": {
        "content": "❌ 数据不能为空"
      },
      "order": 3
    },
    {
      "id": "4",
      "type": "set_variable",
      "config": {
        "name": "validated",
        "value": true
      },
      "order": 4
    },
    {
      "id": "5",
      "type": "trigger_flow",
      "config": {
        "flowName": "数据处理",
        "mode": "sync",
        "passVariables": ["raw_data", "validated"],
        "saveAs": "process_result"
      },
      "order": 5
    },
    {
      "id": "6",
      "type": "send_message",
      "config": {
        "content": "✅ 处理完成：${process_result.results[0].data.message}"
      },
      "order": 6
    }
  ]
}
```

**Flow 2: 数据处理**
```json
{
  "id": "flow_process",
  "name": "数据处理",
  "match": { "type": "always", "pattern": "" },
  "actions": [
    {
      "id": "1",
      "type": "log",
      "config": {
        "level": "info",
        "message": "开始处理数据: ${inheritedVariables.raw_data}"
      },
      "order": 1
    },
    {
      "id": "2",
      "type": "call_api",
      "config": {
        "url": "https://api.example.com/process",
        "method": "POST",
        "body": {
          "data": "${inheritedVariables.raw_data}",
          "userId": "${event.sender.userId}"
        },
        "saveAs": "api_result"
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "trigger_flow",
      "config": {
        "flowName": "结果通知",
        "mode": "async",
        "passVariables": ["api_result"]
      },
      "order": 3
    }
  ]
}
```

**Flow 3: 结果通知**
```json
{
  "id": "flow_notify",
  "name": "结果通知",
  "match": { "type": "always", "pattern": "" },
  "actions": [
    {
      "id": "1",
      "type": "template_message",
      "config": {
        "template": "📧 处理结果通知\n状态：${inheritedVariables.api_result.status}\n详情：${inheritedVariables.api_result.message}"
      },
      "order": 1
    }
  ]
}
```

### 场景2：多步骤审批流程

**需求：** 提交申请 → 自动审核 → 人工审批 → 归档

**Flow 1: 提交申请**
```json
{
  "id": "flow_submit",
  "name": "提交申请",
  "match": { "type": "prefix", "pattern": "/apply" },
  "actions": [
    {
      "id": "1",
      "type": "extract_data",
      "config": {
        "source": "event.rawContent",
        "type": "regex",
        "pattern": "/apply\\s+(?<reason>.*)",
        "saveAs": "apply_reason"
      },
      "order": 1
    },
    {
      "id": "2",
      "type": "set_variable",
      "config": {
        "name": "apply_id",
        "expression": "'APP' + Date.now()"
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "get_user_info",
      "config": {
        "saveAs": "applicant"
      },
      "order": 3
    },
    {
      "id": "4",
      "type": "send_message",
      "config": {
        "content": "📝 申请已提交\n申请号：${apply_id}\n正在自动审核..."
      },
      "order": 4
    },
    {
      "id": "5",
      "type": "trigger_flow",
      "config": {
        "flowName": "自动审核",
        "mode": "sync",
        "passVariables": ["apply_id", "apply_reason", "applicant"],
        "saveAs": "auto_review_result"
      },
      "order": 5
    },
    {
      "id": "6",
      "type": "conditional",
      "config": {
        "left": "${auto_review_result.results[0].data.approved}",
        "operator": "==",
        "right": "true",
        "skipNext": 1
      },
      "order": 6
    },
    {
      "id": "7",
      "type": "trigger_flow",
      "config": {
        "flowName": "人工审批",
        "mode": "async",
        "passVariables": ["apply_id", "apply_reason", "applicant"]
      },
      "order": 7
    }
  ]
}
```

**Flow 2: 自动审核**
```json
{
  "id": "flow_auto_review",
  "name": "自动审核",
  "match": { "type": "always", "pattern": "" },
  "actions": [
    {
      "id": "1",
      "type": "log",
      "config": {
        "level": "info",
        "message": "自动审核: ${inheritedVariables.apply_id}"
      },
      "order": 1
    },
    {
      "id": "2",
      "type": "call_api",
      "config": {
        "url": "https://api.example.com/auto-review",
        "method": "POST",
        "body": {
          "applyId": "${inheritedVariables.apply_id}",
          "reason": "${inheritedVariables.apply_reason}",
          "userId": "${inheritedVariables.applicant.userId}"
        },
        "saveAs": "review_result"
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "hardcode",
      "config": {
        "value": {
          "approved": "${review_result.score > 80}",
          "score": "${review_result.score}",
          "message": "自动审核${review_result.score > 80 ? '通过' : '未通过'}"
        },
        "saveAs": "result"
      },
      "order": 3
    }
  ]
}
```

### 场景3：条件分发（路由）

**需求：** 根据消息类型分发到不同的处理 Flow

**Flow 1: 消息路由**
```json
{
  "id": "flow_router",
  "name": "消息路由",
  "match": { "type": "always", "pattern": "" },
  "actions": [
    {
      "id": "1",
      "type": "extract_data",
      "config": {
        "source": "event.rawContent",
        "type": "regex",
        "pattern": "^/(\\w+)",
        "saveAs": "command"
      },
      "order": 1
    },
    {
      "id": "2",
      "type": "conditional",
      "config": {
        "left": "${command}",
        "operator": "==",
        "right": "help",
        "skipNext": 1
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "trigger_flow",
      "config": {
        "flowName": "帮助命令处理",
        "mode": "sync"
      },
      "order": 3
    },
    {
      "id": "4",
      "type": "conditional",
      "config": {
        "left": "${command}",
        "operator": "==",
        "right": "query",
        "skipNext": 1
      },
      "order": 4
    },
    {
      "id": "5",
      "type": "trigger_flow",
      "config": {
        "flowName": "查询命令处理",
        "mode": "sync"
      },
      "order": 5
    },
    {
      "id": "6",
      "type": "send_message",
      "config": {
        "content": "❓ 未知命令：${command}"
      },
      "order": 6
    }
  ]
}
```

### 场景4：异步任务分发

**需求：** 接收任务 → 分发给多个处理器 → 汇总结果

**Flow 1: 任务分发器**
```json
{
  "id": "flow_dispatcher",
  "name": "任务分发器",
  "match": { "type": "prefix", "pattern": "批量处理" },
  "actions": [
    {
      "id": "1",
      "type": "extract_data",
      "config": {
        "source": "event.rawContent",
        "type": "regex",
        "pattern": "批量处理\\s+(?<items>.*)",
        "saveAs": "items_str"
      },
      "order": 1
    },
    {
      "id": "2",
      "type": "set_variable",
      "config": {
        "name": "items",
        "expression": "${items_str}.split(',')"
      },
      "order": 2
    },
    {
      "id": "3",
      "type": "send_message",
      "config": {
        "content": "🚀 开始批量处理 ${items.length} 个项目..."
      },
      "order": 3
    },
    {
      "id": "4",
      "type": "trigger_flow",
      "config": {
        "flowName": "项目处理器",
        "mode": "async",
        "passVariables": ["items"]
      },
      "order": 4
    },
    {
      "id": "5",
      "type": "trigger_flow",
      "config": {
        "flowName": "进度监控",
        "mode": "async",
        "passVariables": ["items"]
      },
      "order": 5
    }
  ]
}
```

## 🔒 安全与限制

### 1. 执行深度限制

最大嵌套深度为 10 层，防止无限递归：

```
Flow A → Flow B → Flow C → ... (最多 10 层)
```

超过限制会抛出错误：
```
Flow execution depth limit exceeded (max: 10)
```

### 2. 循环引用检测

禁止 Flow 调用自身：

```json
{
  "type": "trigger_flow",
  "config": {
    "flowId": "current_flow_id"  // ❌ 错误：不能触发自身
  }
}
```

错误信息：
```
Cannot trigger self: circular flow reference detected
```

### 3. 变量隔离

子 Flow 的变量不会自动影响父 Flow，除非通过 `saveAs` 显式保存：

```json
{
  "type": "trigger_flow",
  "config": {
    "flowName": "SubFlow",
    "mode": "sync",
    "saveAs": "sub_result"  // 显式保存结果
  }
}
```

## 📊 执行模式对比

| 特性 | sync（同步） | async（异步） |
|------|------------|-------------|
| 等待子 Flow | ✅ 是 | ❌ 否 |
| 获取结果 | ✅ 可以 | ❌ 不可以 |
| 阻塞父 Flow | ✅ 是 | ❌ 否 |
| 错误传播 | ✅ 传播到父 | ❌ 独立处理 |
| 适用场景 | 需要结果的流程 | 后台任务、通知 |

### 同步执行示例

```json
{
  "type": "trigger_flow",
  "config": {
    "flowName": "数据验证",
    "mode": "sync",
    "saveAs": "validation_result"
  }
}
// 后续动作可以使用 ${validation_result}
```

### 异步执行示例

```json
{
  "type": "trigger_flow",
  "config": {
    "flowName": "发送通知",
    "mode": "async"
  }
}
// 立即继续执行后续动作，不等待通知发送完成
```

## 🎨 最佳实践

### 1. 单一职责原则

每个 Flow 应该只做一件事：

```
✅ 好的设计：
- Flow A: 数据验证
- Flow B: 数据处理
- Flow C: 结果通知

❌ 不好的设计：
- Flow X: 验证 + 处理 + 通知（过于复杂）
```

### 2. 合理使用同步/异步

```
同步场景：
- 需要子 Flow 的返回结果
- 必须按顺序执行
- 数据依赖关系

异步场景：
- 发送通知
- 记录日志
- 后台任务
- 不影响主流程的操作
```

### 3. 变量传递策略

```json
// ✅ 只传递必要的变量
{
  "passVariables": ["userId", "orderId"]
}

// ❌ 避免传递过多变量
{
  "passVariables": ["var1", "var2", ..., "var100"]
}

// ✅ 不指定时传递全部（适合紧密相关的 Flow）
{
  // 不设置 passVariables
}
```

### 4. 错误处理

```json
{
  "actions": [
    {
      "type": "trigger_flow",
      "config": {
        "flowName": "RiskyOperation",
        "mode": "sync",
        "saveAs": "result"
      },
      "order": 1
    },
    {
      "type": "conditional",
      "config": {
        "condition": "${result.executed && result.error}",
        "skipNext": 0
      },
      "order": 2
    },
    {
      "type": "send_message",
      "config": {
        "content": "⚠️ 操作失败：${result.error}"
      },
      "order": 3
    }
  ]
}
```

### 5. 命名规范

```
✅ 清晰的 Flow 命名：
- "数据验证"
- "订单处理"
- "用户通知"

✅ 清晰的变量命名：
- validation_result
- order_data
- user_info

❌ 避免模糊的命名：
- "处理1"
- "temp"
- "x"
```

## 📈 性能优化

### 1. 减少同步调用层次

```
❌ 过深的同步链：
Flow A (sync) → Flow B (sync) → Flow C (sync) → Flow D

✅ 优化后：
Flow A (sync) → Flow B
              ↘ Flow C (async)
              ↘ Flow D (async)
```

### 2. 并行执行独立任务

```json
{
  "actions": [
    {
      "type": "trigger_flow",
      "config": { "flowName": "Task1", "mode": "async" },
      "order": 1
    },
    {
      "type": "trigger_flow",
      "config": { "flowName": "Task2", "mode": "async" },
      "order": 2
    },
    {
      "type": "trigger_flow",
      "config": { "flowName": "Task3", "mode": "async" },
      "order": 3
    }
  ]
}
```

## 🐛 调试技巧

### 1. 添加日志追踪

```json
{
  "actions": [
    {
      "type": "log",
      "config": {
        "level": "info",
        "message": "[Parent] 准备触发子 Flow, depth: ${depth}"
      },
      "order": 1
    },
    {
      "type": "trigger_flow",
      "config": {
        "flowName": "ChildFlow",
        "mode": "sync",
        "saveAs": "child_result"
      },
      "order": 2
    },
    {
      "type": "log",
      "config": {
        "level": "info",
        "message": "[Parent] 子 Flow 执行完成: ${child_result.executed}"
      },
      "order": 3
    }
  ]
}
```

### 2. 查看执行上下文

在子 Flow 中可以访问：
- `${depth}` - 当前执行深度
- `${parentFlowId}` - 父 Flow ID
- `${inheritedVariables.*}` - 继承的变量

## 🔮 未来扩展

计划中的功能：
- [ ] 条件触发（根据条件决定是否触发）
- [ ] 批量触发（一次触发多个 Flow）
- [ ] 超时控制（子 Flow 执行超时）
- [ ] 重试机制（失败自动重试）
- [ ] Flow 依赖图可视化
- [ ] 执行链路追踪

---

**链式 Flow** 让你的机器人工作流更加灵活、可维护、可组合！🚀
