'use client';

import { useTranslations } from 'next-intl';

/**
 * 与运行时 `interpolate` / `evaluateExpression` 对齐的说明（不重复实现解析逻辑）。
 */
export function FlowTemplateVariablesHint() {
  const t = useTranslations('FlowTemplateHint');

  return (
    <details className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium text-foreground">{t('summary')}</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
        <li>{t('liStepVars')}</li>
        <li>{t('liEvent')}</li>
        <li>{t('liMessage')}</li>
        <li>{t('liFlowJob')}</li>
        <li>{t('liBot')}</li>
        <li>{t('liExpr')}</li>
      </ul>
    </details>
  );
}
