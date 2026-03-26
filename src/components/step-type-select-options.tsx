'use client';

import { useTranslations } from 'next-intl';
import { STEP_TYPE_GROUPS } from '@/lib/steps/step-type-groups';
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
} from '@/components/ui/select';

/** 用于 shadcn Select 内：按分组渲染 SelectGroup */
export function StepTypeSelectOptions() {
  const t = useTranslations('StepTypes');

  return (
    <>
      {STEP_TYPE_GROUPS.map((g) => (
        <SelectGroup key={g.labelKey}>
          <SelectLabel>{t(`groups.${g.labelKey}`)}</SelectLabel>
          {g.types.map((type) => (
            <SelectItem key={type} value={type}>
              {t(`labels.${type}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}
