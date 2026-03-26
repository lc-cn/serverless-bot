import type { StepType } from '@/types';

/** i18n key under StepTypes.groups.* */
export const STEP_TYPE_GROUPS: { labelKey: string; types: readonly StepType[] }[] = [
  {
    labelKey: 'llmAgent',
    types: ['llm_agent'],
  },
  {
    labelKey: 'message',
    types: [
      'send_message',
      'hardcode',
      'template_message',
      'forward_message',
      'random_reply',
      'recall_message',
    ],
  },
  {
    labelKey: 'network',
    types: ['call_api', 'call_bot'],
  },
  {
    labelKey: 'data',
    types: [
      'extract_data',
      'parse_json',
      'stringify_json',
      'base64_encode',
      'base64_decode',
      'url_encode',
      'url_decode',
    ],
  },
  {
    labelKey: 'control',
    types: [
      'get_user_info',
      'get_group_info',
      'set_variable',
      'conditional',
      'delay',
      'log',
    ],
  },
  {
    labelKey: 'request',
    types: ['handle_request'],
  },
] as const;

type GroupedUnion = (typeof STEP_TYPE_GROUPS)[number]['types'][number];
/** 分组须覆盖全部 StepType，否则赋值报错 */
type _FullCoverage = StepType extends GroupedUnion
  ? GroupedUnion extends StepType
    ? true
    : never
  : never;

const __stepTypeGroupsCoverAll: _FullCoverage = true;
void __stepTypeGroupsCoverAll;
