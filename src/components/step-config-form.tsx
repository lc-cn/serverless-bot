'use client';

import { useMessages, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldSchema } from '@/lib/steps/step-schemas';
import { FlowTemplateVariablesHint } from '@/components/flow-template-variables-hint';
import { stepTypeShowsFlowTemplateHint } from '@/lib/steps/step-template-variable-hint';
import type { StepType } from '@/types';

/** Radix Select 禁止 SelectItem 使用 value=""；可选字段用此哨兵表示未选，在 onValueChange 中写回 '' */
const SELECT_EMPTY_VALUE = '__step_cfg_unset__';

interface StepConfigFormProps {
  schema: Record<string, FieldSchema>;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  /** 用于发送/模板类步骤时展示与 ${} 一致的可用变量说明 */
  stepType?: StepType;
}

function pickStepFieldString(
  root: Record<string, unknown> | undefined,
  path: string[],
): string | undefined {
  let cur: unknown = root;
  for (const p of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function StepConfigForm({ schema, config, onChange, stepType }: StepConfigFormProps) {
  const messages = useMessages();
  const ui = useTranslations('Ui');
  const stepFieldsRoot = (messages as Record<string, unknown>).StepFields as
    | Record<string, unknown>
    | undefined;

  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...config,
      [fieldName]: value,
    });
  };

  const tr = (fieldName: string, part: 'label' | 'description' | 'placeholder', field: FieldSchema) => {
    const fromMsg =
      stepType && stepFieldsRoot
        ? pickStepFieldString(stepFieldsRoot, [stepType, fieldName, part])
        : undefined;
    if (part === 'label') return fromMsg ?? field.label;
    if (part === 'description') return fromMsg ?? field.description;
    return fromMsg ?? field.placeholder;
  };

  const trOpt = (fieldName: string, value: string, fallback: string) => {
    const fromMsg =
      stepType && stepFieldsRoot
        ? pickStepFieldString(stepFieldsRoot, [stepType, fieldName, 'options', value])
        : undefined;
    return fromMsg ?? fallback;
  };

  const renderField = (fieldName: string, field: FieldSchema) => {
    const value = config[fieldName] ?? field.defaultValue ?? '';
    const placeholder = tr(fieldName, 'placeholder', field);

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={placeholder}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={placeholder}
            rows={field.rows || 3}
            required={field.required}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value))}
            placeholder={placeholder}
            required={field.required}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value ?? false}
              onChange={(checked) => handleFieldChange(fieldName, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value ? ui('yes') : ui('no')}
            </span>
          </div>
        );

      case 'select': {
        const strVal = typeof value === 'string' ? value : '';
        const selectValue =
          strVal !== ''
            ? strVal
            : !field.required
              ? SELECT_EMPTY_VALUE
              : undefined;
        return (
          <Select
            value={selectValue}
            onValueChange={(v) =>
              handleFieldChange(fieldName, v === SELECT_EMPTY_VALUE ? '' : v)
            }
          >
            <SelectTrigger aria-required={field.required}>
              <SelectValue placeholder={ui('pleaseSelect')} />
            </SelectTrigger>
            <SelectContent>
              {!field.required && (
                <SelectItem value={SELECT_EMPTY_VALUE}>{ui('pleaseSelect')}</SelectItem>
              )}
              {field.options
                ?.filter((option) => option.value !== '')
                .map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {trOpt(fieldName, option.value, option.label)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );
      }

      case 'json':
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(fieldName, parsed);
              } catch {
                handleFieldChange(fieldName, e.target.value);
              }
            }}
            placeholder={placeholder}
            rows={field.rows || 4}
            className="font-mono text-sm"
            required={field.required}
          />
        );

      default:
        return null;
    }
  };

  const showFlowHint = stepTypeShowsFlowTemplateHint(stepType);

  return (
    <div className="space-y-4">
      {showFlowHint && <FlowTemplateVariablesHint />}
      {Object.entries(schema).map(([fieldName, field]) => (
        <div key={fieldName} className="space-y-2">
          <label className="text-sm font-medium">
            {tr(fieldName, 'label', field)}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {tr(fieldName, 'description', field) && (
            <p className="text-xs text-muted-foreground">{tr(fieldName, 'description', field)}</p>
          )}
          {renderField(fieldName, field)}
        </div>
      ))}
    </div>
  );
}
