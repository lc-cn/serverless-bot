import { StepType } from '@/types';

export interface FieldSchema {
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'json';
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: { label: string; value: string }[];
  rows?: number; // for textarea
}

export type StepConfigSchema = Record<string, FieldSchema>;

export const stepConfigSchemas: Record<StepType, StepConfigSchema> = {
  send_message: {
    messageType: {
      type: 'select',
      label: '消息类型',
      options: [
        { label: '普通文本', value: 'text' },
        { label: '模板（支持 ${variable} 和 [type:data]）', value: 'template' },
        { label: '消息段数组', value: 'segments' },
      ],
      defaultValue: 'text',
    },
    content: {
      type: 'textarea',
      label: '消息内容',
      description: '普通文本或模板内容...',
      required: true,
      placeholder: '输入要发送的消息内容...',
      rows: 4,
    },
    targetType: {
      type: 'select',
      label: '目标类型',
      options: [
        { label: '默认（回复触发者）', value: 'auto' },
        { label: '私聊', value: 'private' },
        { label: '群聊', value: 'group' },
      ],
      defaultValue: 'auto',
    },
    targetId: {
      type: 'text',
      label: '目标 ID',
      description: '指定发送目标的 ID，留空则回复触发者',
      placeholder: '用户ID或群组ID',
    },
  },

  call_api: {
    url: {
      type: 'text',
      label: 'API 地址',
      required: true,
      placeholder: 'https://api.example.com/endpoint',
    },
    method: {
      type: 'select',
      label: 'HTTP 方法',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'PATCH', value: 'PATCH' },
      ],
      defaultValue: 'GET',
    },
    headers: {
      type: 'json',
      label: '请求头',
      description: 'JSON 格式的请求头',
      placeholder: '{"Authorization": "Bearer token"}',
    },
    body: {
      type: 'json',
      label: '请求体',
      description: 'JSON 格式的请求体，支持变量',
      placeholder: '{"key": "${variable}"}',
    },
    timeout: {
      type: 'number',
      label: '超时时间（毫秒）',
      defaultValue: 5000,
    },
    saveAs: {
      type: 'text',
      label: '保存结果到变量',
      description: '将 API 响应保存到指定变量名',
      placeholder: 'apiResult',
    },
  },

  call_bot: {
    method: {
      type: 'text',
      label: '调用方法',
      required: true,
      placeholder: 'sendMessage, getUserInfo, etc.',
    },
    params: {
      type: 'json',
      label: '方法参数',
      description: 'JSON 格式的参数',
      placeholder: '{"userId": "${userId}"}',
    },
  },

  hardcode: {
    messageType: {
      type: 'select',
      label: '消息类型',
      options: [
        { label: '普通文本', value: 'text' },
        { label: '模板（支持 ${variable} 和 [type:data] 语法）', value: 'template' },
        { label: '消息段数组', value: 'segments' },
      ],
      defaultValue: 'text',
    },
    content: {
      type: 'textarea',
      label: '回复内容',
      required: true,
      placeholder: '示例1: 你好\n示例2: ${userInfo} （引用变量）\n示例3: [text:你好][at:123] （消息段语法）',
      rows: 4,
    },
  },

  log: {
    level: {
      type: 'select',
      label: '日志级别',
      options: [
        { label: 'Debug', value: 'debug' },
        { label: 'Info', value: 'info' },
        { label: 'Warn', value: 'warn' },
        { label: 'Error', value: 'error' },
      ],
      defaultValue: 'info',
    },
    message: {
      type: 'textarea',
      label: '日志消息',
      required: true,
      placeholder: '日志内容，支持变量 ${variable}',
      rows: 2,
    },
    data: {
      type: 'json',
      label: '附加数据',
      description: '额外的日志数据（JSON）',
      placeholder: '{"key": "value"}',
    },
  },

  get_user_info: {
    userId: {
      type: 'text',
      label: '用户 ID',
      description: '留空则获取触发者信息',
      placeholder: '${sender.userId}',
    },
    saveAs: {
      type: 'text',
      label: '保存到变量',
      required: true,
      defaultValue: 'userInfo',
    },
  },

  get_group_info: {
    groupId: {
      type: 'text',
      label: '群组 ID',
      description: '留空则获取当前群组信息',
      placeholder: '${groupId}',
    },
    saveAs: {
      type: 'text',
      label: '保存到变量',
      required: true,
      defaultValue: 'groupInfo',
    },
  },

  set_variable: {
    name: {
      type: 'text',
      label: '变量名',
      required: true,
      placeholder: 'myVariable',
    },
    value: {
      type: 'textarea',
      label: '变量值',
      description: '支持模板语法和其他变量引用',
      required: true,
      placeholder: '${otherVariable} or literal value',
      rows: 2,
    },
    type: {
      type: 'select',
      label: '值类型',
      options: [
        { label: '字符串', value: 'string' },
        { label: '数字', value: 'number' },
        { label: '布尔值', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
      defaultValue: 'string',
    },
  },

  conditional: {
    condition: {
      type: 'textarea',
      label: '条件表达式',
      description: '支持 JavaScript 表达式，可使用变量',
      required: true,
      placeholder: '${count} > 10 || ${status} === "active"',
      rows: 3,
    },
    onTrue: {
      type: 'json',
      label: '条件为真时执行',
      description: '步骤 ID 数组或配置对象',
      placeholder: '["step1", "step2"]',
    },
    onFalse: {
      type: 'json',
      label: '条件为假时执行',
      description: '步骤 ID 数组或配置对象',
      placeholder: '["step3"]',
    },
  },

  delay: {
    duration: {
      type: 'number',
      label: '延迟时间（毫秒）',
      required: true,
      defaultValue: 1000,
    },
    message: {
      type: 'text',
      label: '延迟说明',
      placeholder: '等待用户响应...',
    },
  },

  random_reply: {
    messages: {
      type: 'json',
      label: '回复列表',
      description: 'JSON 数组格式的多个回复选项',
      required: true,
      placeholder: '["回复1", "回复2", "回复3"]',
    },
  },

  template_message: {
    template: {
      type: 'textarea',
      label: '消息模板',
      description: '使用 ${变量名} 进行变量替换',
      required: true,
      placeholder: '你好 ${userName}，欢迎加入 ${groupName}！',
      rows: 4,
    },
    variables: {
      type: 'json',
      label: '模板变量',
      description: '定义模板中使用的变量及其来源',
      placeholder: '{"userName": "${sender.name}", "groupName": "${group.name}"}',
    },
  },

  forward_message: {
    targetType: {
      type: 'select',
      label: '转发目标类型',
      required: true,
      options: [
        { label: '私聊', value: 'private' },
        { label: '群聊', value: 'group' },
      ],
      defaultValue: 'private',
    },
    targetId: {
      type: 'text',
      label: '目标 ID',
      required: true,
      placeholder: '用户ID或群组ID',
    },
    messageId: {
      type: 'text',
      label: '消息 ID',
      description: '要转发的消息ID，留空则转发触发消息',
      placeholder: '${messageId}',
    },
  },

  handle_request: {
    action: {
      type: 'select',
      label: '处理动作',
      required: true,
      options: [
        { label: '同意', value: 'approve' },
        { label: '拒绝', value: 'reject' },
      ],
      defaultValue: 'approve',
    },
    reason: {
      type: 'text',
      label: '处理理由',
      placeholder: '拒绝理由...',
    },
  },

  recall_message: {
    messageId: {
      type: 'text',
      label: '消息 ID',
      description: '要撤回的消息ID，留空则撤回触发消息',
      placeholder: '${messageId}',
    },
  },

  extract_data: {
    source: {
      type: 'select',
      label: '数据源',
      options: [
        { label: '消息内容', value: 'message' },
        { label: '变量', value: 'variable' },
      ],
      defaultValue: 'message',
    },
    pattern: {
      type: 'text',
      label: '提取模式（正则表达式）',
      required: true,
      placeholder: '(\\d+)',
    },
    saveAs: {
      type: 'text',
      label: '保存到变量',
      required: true,
      placeholder: 'extractedData',
    },
    captureGroups: {
      type: 'json',
      label: '捕获组映射',
      description: '将正则捕获组映射到变量名',
      placeholder: '{"1": "number", "2": "unit"}',
    },
  },
};
