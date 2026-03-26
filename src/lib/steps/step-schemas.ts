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
      label: 'Message type',
      options: [
        { label: 'Plain text', value: 'text' },
        { label: 'Template (${variable} and [type:data])', value: 'template' },
        { label: 'Message segments array', value: 'segments' },
      ],
      defaultValue: 'text',
    },
    content: {
      type: 'textarea',
      label: 'Message content',
      description: 'Plain text or template body…',
      required: true,
      placeholder: 'Enter the message to send…',
      rows: 4,
    },
    targetType: {
      type: 'select',
      label: 'Target type',
      options: [
        { label: 'Default (reply to trigger source)', value: 'auto' },
        { label: 'Private chat', value: 'private' },
        { label: 'Group chat', value: 'group' },
      ],
      defaultValue: 'auto',
    },
    targetId: {
      type: 'text',
      label: 'Target ID',
      description: 'Target user or group ID; leave empty to reply to the trigger source',
      placeholder: 'User ID or group ID',
    },
  },

  call_api: {
    url: {
      type: 'text',
      label: 'API URL',
      required: true,
      placeholder: 'https://api.example.com/endpoint',
    },
    method: {
      type: 'select',
      label: 'HTTP method',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'PATCH', value: 'PATCH' },
      ],
      defaultValue: 'GET',
    },
    timeoutMs: {
      type: 'number',
      label: 'Timeout (ms)',
      description:
        'Per-request timeout; defaults to env CALL_API_DEFAULT_TIMEOUT_MS (60000) and is capped by flow budget and CALL_API_MAX_TIMEOUT_MS',
      placeholder: '60000',
    },
    headers: {
      type: 'json',
      label: 'Headers',
      description: 'Request headers as JSON',
      placeholder: '{"Authorization": "Bearer token"}',
    },
    body: {
      type: 'json',
      label: 'Body',
      description: 'Request body as JSON; variables supported',
      placeholder: '{"key": "${variable}"}',
    },
    timeout: {
      type: 'number',
      label: 'Timeout (ms)',
      defaultValue: 5000,
    },
    saveAs: {
      type: 'text',
      label: 'Save response as variable',
      description: 'Variable name to store the API response',
      placeholder: 'apiResult',
    },
  },

  call_bot: {
    method: {
      type: 'text',
      label: 'Method name',
      required: true,
      placeholder: 'sendMessage, getUserInfo, etc.',
    },
    params: {
      type: 'json',
      label: 'Parameters',
      description: 'Arguments as JSON',
      placeholder: '{"userId": "${userId}"}',
    },
  },

  hardcode: {
    messageType: {
      type: 'select',
      label: 'Message type',
      options: [
        { label: 'Plain text', value: 'text' },
        { label: 'Template (${variable} and [type:data])', value: 'template' },
        { label: 'Message segments array', value: 'segments' },
      ],
      defaultValue: 'text',
    },
    content: {
      type: 'textarea',
      label: 'Reply content',
      required: true,
      placeholder:
        'e.g. 1: hello\n2: ${userInfo}\n3: [text:hi][at:123] (segment syntax)',
      rows: 4,
    },
  },

  log: {
    level: {
      type: 'select',
      label: 'Log level',
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
      label: 'Log message',
      required: true,
      placeholder: 'Message; variables like ${variable} supported',
      rows: 2,
    },
    data: {
      type: 'json',
      label: 'Extra data',
      description: 'Additional structured data (JSON)',
      placeholder: '{"key": "value"}',
    },
  },

  get_user_info: {
    userId: {
      type: 'text',
      label: 'User ID',
      description: 'Leave empty to use the trigger sender',
      placeholder: '${sender.userId}',
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'userInfo',
    },
  },

  get_group_info: {
    groupId: {
      type: 'text',
      label: 'Group ID',
      description: 'Leave empty for the current group context',
      placeholder: '${groupId}',
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'groupInfo',
    },
  },

  set_variable: {
    name: {
      type: 'text',
      label: 'Variable name',
      required: true,
      placeholder: 'myVariable',
    },
    value: {
      type: 'textarea',
      label: 'Value',
      description: 'Templates and variable references supported',
      required: true,
      placeholder: '${otherVariable} or literal value',
      rows: 2,
    },
    type: {
      type: 'select',
      label: 'Value type',
      options: [
        { label: 'String', value: 'string' },
        { label: 'Number', value: 'number' },
        { label: 'Boolean', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
      defaultValue: 'string',
    },
  },

  conditional: {
    condition: {
      type: 'textarea',
      label: 'Condition expression',
      description: 'JavaScript-like expression; variables allowed',
      required: true,
      placeholder: '${count} > 10 || ${status} === "active"',
      rows: 3,
    },
    onTrue: {
      type: 'json',
      label: 'When true',
      description: 'Step IDs array or config object',
      placeholder: '["step1", "step2"]',
    },
    onFalse: {
      type: 'json',
      label: 'When false',
      description: 'Step IDs array or config object',
      placeholder: '["step3"]',
    },
  },

  delay: {
    duration: {
      type: 'number',
      label: 'Delay (ms)',
      required: true,
      defaultValue: 1000,
    },
    message: {
      type: 'text',
      label: 'Note',
      placeholder: 'Waiting for user reply…',
    },
  },

  random_reply: {
    replies: {
      type: 'json',
      label: 'Replies',
      description: 'JSON array: strings or { content / text / template, messageType }',
      required: true,
      placeholder: '["a","b",{"content":"with ${name}"}]',
    },
  },

  template_message: {
    template: {
      type: 'textarea',
      label: 'Template',
      description: 'Use ${name} for variable substitution',
      required: true,
      placeholder: 'Hi ${userName}, welcome to ${groupName}!',
      rows: 4,
    },
    variables: {
      type: 'json',
      label: 'Template variables',
      description: 'Map variable names to sources',
      placeholder: '{"userName": "${sender.name}", "groupName": "${group.name}"}',
    },
  },

  forward_message: {
    targetType: {
      type: 'select',
      label: 'Forward target type',
      required: true,
      options: [
        { label: 'Private chat', value: 'private' },
        { label: 'Group chat', value: 'group' },
      ],
      defaultValue: 'private',
    },
    targetId: {
      type: 'text',
      label: 'Target ID',
      required: true,
      placeholder: 'User ID or group ID',
    },
    messageId: {
      type: 'text',
      label: 'Message ID',
      description: 'Message to forward; empty = trigger message',
      placeholder: '${messageId}',
    },
  },

  handle_request: {
    action: {
      type: 'select',
      label: 'Action',
      required: true,
      options: [
        { label: 'Approve', value: 'approve' },
        { label: 'Reject', value: 'reject' },
      ],
      defaultValue: 'approve',
    },
    reason: {
      type: 'text',
      label: 'Reason',
      placeholder: 'Reason when rejecting…',
    },
  },

  recall_message: {
    messageId: {
      type: 'text',
      label: 'Message ID',
      description: 'Message to recall; empty = trigger message',
      placeholder: '${messageId}',
    },
  },

  extract_data: {
    source: {
      type: 'select',
      label: 'Data source',
      options: [
        { label: 'Message content', value: 'message' },
        { label: 'Variable', value: 'variable' },
      ],
      defaultValue: 'message',
    },
    variablePath: {
      type: 'text',
      label: 'Variable path',
      description: 'When source is variable; dot path e.g. apiResponse.data',
      placeholder: 'myVar.field',
    },
    extractionType: {
      type: 'select',
      label: 'Extraction mode',
      options: [
        { label: 'Regex', value: 'regex' },
        { label: 'JSON dot path', value: 'jsonpath' },
      ],
      defaultValue: 'regex',
    },
    pattern: {
      type: 'text',
      label: 'Regex or JSON path',
      required: true,
      placeholder: 'regex: (\\d+) | jsonpath: user.name',
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      placeholder: 'extractedData',
    },
    multiple: {
      type: 'boolean',
      label: 'Regex: all matches',
      defaultValue: false,
    },
    captureGroups: {
      type: 'json',
      label: 'Capture group map (regex, first match)',
      description: 'Map group index to names, e.g. {"1":"number","2":"unit"}',
      placeholder: '{"1": "number", "2": "unit"}',
    },
  },

  llm_agent: {
    agentId: {
      type: 'text',
      label: 'Agent ID',
      required: true,
      description:
        'Instance ID from the LLM Agent page. If tools define implementation steps, model tool calls run those steps (e.g. call_api); write model-readable output to toolResult.',
      placeholder: 'llm_agent_xxx',
    },
    userPrompt: {
      type: 'textarea',
      label: 'User prompt (optional)',
      description:
        'Combined with the agent system prompt; supports ${vars} like other steps. Also ${sys.nowLocal}, ${sys.timezone}, ${sys.cwd}, etc.',
      rows: 4,
      placeholder: 'e.g. User message: ${message.content}',
    },
    saveAs: {
      type: 'text',
      label: 'Save model text as variable',
      required: true,
      defaultValue: 'llmReply',
      placeholder: 'llmReply',
    },
    saveRawAs: {
      type: 'text',
      label: 'Save full API JSON as variable (optional)',
      placeholder: 'llmRaw',
    },
    skillInject: {
      type: 'select',
      label: 'Skill injection (overrides agent default)',
      description:
        'Default: catalog only; full text when full or when load list specifies body. inherit uses agent settings.',
      options: [
        { label: 'Inherit from agent', value: 'inherit' },
        { label: 'None (only listed skill bodies)', value: 'none' },
        { label: 'Catalog only (name + summary + id)', value: 'summary' },
        { label: 'Full linked skill text', value: 'full' },
      ],
      defaultValue: 'inherit',
    },
    loadSkillIds: {
      type: 'textarea',
      label: 'Skill IDs to load full body (optional)',
      description: 'JSON array e.g. ["llm_skill_xxx"]; ${vars} OK. Must be linked to this agent.',
      placeholder: '["llm_skill_xxx"]',
      rows: 2,
    },
    temperature: {
      type: 'number',
      label: 'Temperature (optional override)',
    },
    maxTokens: {
      type: 'number',
      label: 'max_tokens (optional)',
    },
    timeout: {
      type: 'number',
      label: 'Timeout (ms)',
      defaultValue: 60000,
    },
  },

  parse_json: {
    source: {
      type: 'textarea',
      label: 'JSON text',
      description: 'Supports ${vars}; use after API or model string output',
      required: true,
      placeholder: '${apiBody} or {"a":1}',
      rows: 4,
    },
    saveAs: {
      type: 'text',
      label: 'Save parsed object as variable',
      required: true,
      defaultValue: 'parsedJson',
    },
    optional: {
      type: 'boolean',
      label: 'Do not fail on parse error',
      description: 'When on, writes null and continues',
      defaultValue: false,
    },
  },

  stringify_json: {
    variablePath: {
      type: 'text',
      label: 'Variable path',
      description: 'Context variable; dot paths OK e.g. apiResult or toolArgs.city',
      required: true,
      placeholder: 'apiResult',
    },
    pretty: {
      type: 'boolean',
      label: 'Pretty-print',
      defaultValue: false,
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      description: 'Often toolResult for the model',
      defaultValue: 'toolResult',
    },
  },

  base64_encode: {
    source: {
      type: 'textarea',
      label: 'Plain text (UTF-8)',
      required: true,
      placeholder: '${rawText}',
      rows: 3,
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'encoded',
    },
  },

  base64_decode: {
    source: {
      type: 'textarea',
      label: 'Base64 string',
      required: true,
      placeholder: '${payload}',
      rows: 3,
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'decodedText',
    },
  },

  url_encode: {
    source: {
      type: 'textarea',
      label: 'String to encode',
      required: true,
      placeholder: '${city}',
      rows: 2,
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'encodedQuery',
    },
  },

  url_decode: {
    source: {
      type: 'textarea',
      label: 'Encoded string',
      required: true,
      placeholder: '${encodedQuery}',
      rows: 2,
    },
    saveAs: {
      type: 'text',
      label: 'Save as variable',
      required: true,
      defaultValue: 'decodedQuery',
    },
  },
};
