/**
 * 控制台下拉展示的厂商清单；协议均为 OpenAI 兼容（/v1/chat/completions + Bearer）。
 * 用户仍须在「模型连接」填写各平台文档中的 Base URL（此处不硬编码，避免域名变更）。
 */

export const LLM_VENDOR_OPTIONS: { id: string; label: string; hint?: string }[] = [
  {
    id: 'openai_compatible',
    label: 'OpenAI 兼容（通用 · 自填 Base URL）',
    hint: '自建网关、小厂商；连接页「高级 JSON」可写 http 块定制鉴权/路径/请求体',
  },
  { id: 'openai', label: 'OpenAI', hint: 'https://api.openai.com/v1' },
  {
    id: 'azure_openai',
    label: 'Azure OpenAI（兼容端点）',
    hint: 'Azure 资源上开通的 OpenAI 兼容地址',
  },
  { id: 'deepseek', label: 'DeepSeek', hint: 'https://api.deepseek.com/v1' },
  { id: 'moonshot', label: 'Moonshot (Kimi)', hint: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: '智谱 GLM', hint: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'groq', label: 'Groq', hint: 'https://api.groq.com/openai/v1' },
  { id: 'siliconflow', label: '硅基流动 SiliconFlow', hint: 'https://api.siliconflow.cn/v1' },
  { id: 'openrouter', label: 'OpenRouter', hint: 'https://openrouter.ai/api/v1' },
  { id: 'together', label: 'Together AI', hint: 'https://api.together.xyz/v1' },
  { id: 'fireworks', label: 'Fireworks AI', hint: 'https://api.fireworks.ai/inference/v1' },
  { id: 'mistral', label: 'Mistral AI', hint: 'https://api.mistral.ai/v1' },
  { id: 'xai', label: 'xAI (Grok)', hint: 'https://api.x.ai/v1' },
  {
    id: 'perplexity',
    label: 'Perplexity',
    hint: 'https://api.perplexity.ai（以官方文档为准）',
  },
  {
    id: 'dashscope',
    label: '阿里云 DashScope（OpenAI 兼容）',
    hint: '兼容模式 Base URL 见阿里云模型服务文档',
  },
  {
    id: 'volcengine_ark',
    label: '火山引擎方舟（OpenAI 兼容）',
    hint: '方舟推理兼容 OpenAI 的 Endpoint',
  },
  {
    id: 'baidu_qianfan',
    label: '百度千帆（OpenAI 兼容）',
    hint: '千帆 OpenAI 兼容接口地址',
  },
  {
    id: 'tencent_hunyuan',
    label: '腾讯混元（OpenAI 兼容）',
    hint: '混元 OpenAI 兼容模式 Endpoint',
  },
];
