'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { StepConfigForm } from '@/components/step-config-form';
import { stepConfigSchemas } from '@/lib/steps/step-schemas';
import { StepTypeSelectOptions } from '@/components/step-type-select-options';
import { Plus, Trash2, Edit, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Step, StepType } from '@/types';

export function LlmToolStepsEditor({
  steps,
  onChange,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}) {
  const ui = useTranslations('Ui');
  const tj = useTranslations('Dashboard.jobEditor');
  const tLlm = useTranslations('Dashboard.llmToolSteps');
  const ts = useTranslations('StepTypes');
  const typeLabel = (k: StepType) => ts(`labels.${k}`);

  const [showStepOverlay, setShowStepOverlay] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepFormData, setStepFormData] = useState<Partial<Step>>({
    type: 'call_api',
    name: '',
    description: '',
    config: {},
  });
  const [llmAgents, setLlmAgents] = useState<{ id: string; name: string }[]>([]);
  const [agentQuickPick, setAgentQuickPick] = useState('');

  useEffect(() => {
    if (!showStepOverlay || stepFormData.type !== 'llm_agent') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/agents');
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d.agents) {
          setLlmAgents(
            d.agents.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showStepOverlay, stepFormData.type]);

  useEffect(() => {
    if (showStepOverlay) setAgentQuickPick('');
  }, [showStepOverlay]);

  const openAddStepOverlay = () => {
    setEditingStepIndex(null);
    setStepFormData({
      type: 'call_api',
      name: '',
      description: '',
      config: {},
    });
    setShowStepOverlay(true);
  };

  const openEditStepOverlay = (index: number) => {
    const step = steps[index];
    setEditingStepIndex(index);
    setStepFormData({
      type: step.type,
      name: step.name,
      description: step.description,
      config: step.config,
    });
    setShowStepOverlay(true);
  };

  const handleSaveStep = () => {
    const stepSchema = stepConfigSchemas[stepFormData.type!];
    const config = { ...(stepFormData.config || {}) };
    if (stepSchema) {
      Object.entries(stepSchema).forEach(([fieldName, fieldSchema]) => {
        if (config[fieldName] === undefined && (fieldSchema as { defaultValue?: unknown }).defaultValue !== undefined) {
          config[fieldName] = (fieldSchema as { defaultValue: unknown }).defaultValue;
        }
      });
    }

    const newStep: Step = {
      id: editingStepIndex !== null ? steps[editingStepIndex].id : `step_${Date.now()}`,
      type: stepFormData.type!,
      name: stepFormData.name || typeLabel(stepFormData.type!),
      description: stepFormData.description,
      config,
      order: editingStepIndex !== null ? steps[editingStepIndex].order : steps.length + 1,
    };

    const newSteps = [...steps];
    if (editingStepIndex !== null) {
      newSteps[editingStepIndex] = newStep;
    } else {
      newSteps.push(newStep);
    }
    onChange(newSteps);
    setShowStepOverlay(false);
  };

  const removeStep = (index: number) => {
    if (!confirm(ui('confirmDeleteStep'))) return;
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    onChange(newSteps);
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    onChange(newSteps);
  };

  const moveStepDown = (index: number) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    onChange(newSteps);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{tLlm('implementTitle', { count: steps.length })}</CardTitle>
            <Button type="button" onClick={openAddStepOverlay}>
              <Plus className="w-4 h-4 mr-2" />
              {tj('addStep')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground font-normal mt-2">{tLlm('implementIntro')}</p>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{tLlm('emptyHint')}</div>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-2 p-3 rounded border bg-card hover:bg-muted/50 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {index + 1}. {step.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {typeLabel(step.type)}
                      </Badge>
                    </div>
                    {step.description && (
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveStepUp(index)} disabled={index === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveStepDown(index)}
                      disabled={index === steps.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditStepOverlay(index)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Overlay
        isOpen={showStepOverlay}
        onClose={() => {
          setShowStepOverlay(false);
          setEditingStepIndex(null);
        }}
        title={editingStepIndex !== null ? ui('overlayEditStep') : ui('overlayAddStep')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveStep();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label htmlFor="toolStepType" className="text-sm font-medium">
              {tj('stepType')}
            </label>
            <Select
              value={stepFormData.type}
              onValueChange={(v) => {
                const newType = v as StepType;
                const typeChanged = stepFormData.type !== newType;
                setStepFormData({
                  ...stepFormData,
                  type: newType,
                  name: stepFormData.name || typeLabel(newType),
                  config: typeChanged ? {} : stepFormData.config,
                });
              }}
            >
              <SelectTrigger id="toolStepType">
                <SelectValue placeholder={tj('stepType')} />
              </SelectTrigger>
              <SelectContent>
                <StepTypeSelectOptions />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="toolStepName" className="text-sm font-medium">
              {tj('stepName')}
            </label>
            <Input
              id="toolStepName"
              value={stepFormData.name}
              onChange={(e) => setStepFormData({ ...stepFormData, name: e.target.value })}
              placeholder={stepFormData.type ? typeLabel(stepFormData.type) : ''}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="toolStepDesc" className="text-sm font-medium">
              {tj('stepDesc')}
            </label>
            <Textarea
              id="toolStepDesc"
              value={stepFormData.description}
              onChange={(e) => setStepFormData({ ...stepFormData, description: e.target.value })}
              placeholder={tj('stepDescPlaceholder')}
              rows={2}
            />
          </div>

          {stepFormData.type === 'llm_agent' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{tj('quickPickAgent')}</label>
              <Select
                value={agentQuickPick || ''}
                onValueChange={(v) => {
                  setAgentQuickPick(v);
                  if (v) {
                    setStepFormData({
                      ...stepFormData,
                      config: { ...(stepFormData.config || {}), agentId: v },
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tLlm('pickFromList')} />
                </SelectTrigger>
                <SelectContent>
                  {llmAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {llmAgents.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {tj('noAgentsBefore')}{' '}
                  <Link href="/agents" className="text-primary underline">
                    {tj('noAgentsLink')}
                  </Link>{' '}
                  {tLlm('noAgentsAfterShort')}
                </p>
              )}
            </div>
          )}

          {stepFormData.type && stepConfigSchemas[stepFormData.type] && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{tj('stepConfig')}</label>
              <StepConfigForm
                stepType={stepFormData.type}
                schema={stepConfigSchemas[stepFormData.type]}
                config={stepFormData.config || {}}
                onChange={(config) => setStepFormData({ ...stepFormData, config })}
              />
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowStepOverlay(false);
                setEditingStepIndex(null);
              }}
            >
              {ui('cancel')}
            </Button>
            <Button type="submit">{editingStepIndex !== null ? ui('save') : ui('add')}</Button>
          </div>
        </form>
      </Overlay>
    </>
  );
}
