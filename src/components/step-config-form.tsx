'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { FieldSchema } from '@/lib/step-schemas';

interface StepConfigFormProps {
  schema: Record<string, FieldSchema>;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export function StepConfigForm({ schema, config, onChange }: StepConfigFormProps) {
  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({
      ...config,
      [fieldName]: value,
    });
  };

  const renderField = (fieldName: string, field: FieldSchema) => {
    const value = config[fieldName] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={field.placeholder}
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
            placeholder={field.placeholder}
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
              {value ? '是' : '否'}
            </span>
          </div>
        );

      case 'select':
        return (
          <Select
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            required={field.required}
          >
            {!field.required && <option value="">请选择...</option>}
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'json':
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(fieldName, parsed);
              } catch {
                // 暂存原始字符串，等用户输入完整 JSON
                handleFieldChange(fieldName, e.target.value);
              }
            }}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            className="font-mono text-sm"
            required={field.required}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(schema).map(([fieldName, field]) => (
        <div key={fieldName} className="space-y-2">
          <label className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
          {renderField(fieldName, field)}
        </div>
      ))}
    </div>
  );
}
