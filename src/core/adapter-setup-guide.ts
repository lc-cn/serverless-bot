/**
 * 各平台适配器详情页「快速开始」：纯数据结构，由 {@link Adapter.getSetupGuide} 返回，
 * 文案键对应 messages 中 `AdapterSetupGuide.<namespace>.*`。
 */

export type SetupGuideStepBorder = 'blue' | 'indigo' | 'green';

export type SetupGuideBody =
  | { kind: 'plain'; messageKey: string }
  | { kind: 'rich'; messageKey: string }
  | {
      kind: 'beforeCodeAfter';
      beforeKey: string;
      codeSample: string;
      afterKey: string;
    }
  | { kind: 'paragraphAndCodeBlock'; paragraphKey: string; codeBlockMessageKey: string }
  | { kind: 'paragraphAndList'; paragraphKey: string; listItemKeys: string[] };

export interface SetupGuideStepDef {
  titleKey: string;
  border: SetupGuideStepBorder;
  body: SetupGuideBody;
}

export type SetupGuideUsageLine =
  | { kind: 'lead'; key: string }
  | { kind: 'field'; key: string };

export interface SetupGuideUsageDef {
  lines: SetupGuideUsageLine[];
}

export interface SetupGuideWarnDef {
  titleKey: string;
  listKeys: string[];
}

export interface AdapterSetupGuideDefinition {
  /** 与 messages 中嵌套对象名一致，如 telegram / discord / qq */
  namespace: string;
  /** 区块主标题，如 getTokenTitle */
  sectionTitleKey: string;
  steps: SetupGuideStepDef[];
  tipKey?: string;
  usage?: SetupGuideUsageDef;
  warns?: SetupGuideWarnDef[];
}
