'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { StepConfigForm } from '@/components/step-config-form';
import { stepConfigSchemas } from '@/lib/steps/step-schemas';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  ChevronUp, 
  ChevronDown,
  Save,
  GripVertical 
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Job, Step, StepType } from '@/types';
import { StepTypeSelectOptions } from '@/components/step-type-select-options';

export default function JobEditPage() {
  const ui = useTranslations('Ui');
  const tj = useTranslations('Dashboard.jobEditor');
  const ts = useTranslations('StepTypes');
  const typeLabel = (k: StepType) => ts(`labels.${k}`);
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
  });

  const [showStepOverlay, setShowStepOverlay] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepFormData, setStepFormData] = useState<Partial<Step>>({
    type: 'send_message',
    name: '',
    description: '',
    config: {},
  });
  const [llmAgents, setLlmAgents] = useState<{ id: string; name: string }[]>([]);
  const [agentQuickPick, setAgentQuickPick] = useState('');

  useEffect(() => {
    loadJob();
  }, [jobId]);

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

  const loadJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data.job);
        setFormData({
          name: data.job.name,
          description: data.job.description || '',
          enabled: data.job.enabled,
        });
      } else {
        alert(tj('jobNotFound'));
        router.push('/job');
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      alert(ui('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!job) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          steps: job.steps,
        }),
      });

      if (response.ok) {
        alert(ui('saveSuccess'));
        await loadJob();
      } else {
        alert(ui('saveFailed'));
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      alert(ui('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openAddStepOverlay = () => {
    setEditingStepIndex(null);
    setStepFormData({
      type: 'send_message',
      name: '',
      description: '',
      config: {},
    });
    setShowStepOverlay(true);
  };

  const openEditStepOverlay = (index: number) => {
    const step = job!.steps[index];
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
    if (!job) return;

    // 获取步骤的 schema，用来填充默认值
    const stepSchema = stepConfigSchemas[stepFormData.type!];
    const config = { ...stepFormData.config || {} };

    // 为所有有默认值的字段填充默认值（如果用户没有提供值）
    if (stepSchema) {
      Object.entries(stepSchema).forEach(([fieldName, fieldSchema]) => {
        if (config[fieldName] === undefined && (fieldSchema as any).defaultValue !== undefined) {
          config[fieldName] = (fieldSchema as any).defaultValue;
        }
      });
    }

    const newStep: Step = {
      id: editingStepIndex !== null 
        ? job.steps[editingStepIndex].id 
        : `step_${Date.now()}`,
      type: stepFormData.type!,
      name: stepFormData.name || typeLabel(stepFormData.type!),
      description: stepFormData.description,
      config,
      order: editingStepIndex !== null 
        ? job.steps[editingStepIndex].order 
        : job.steps.length + 1,
    };

    const newSteps = [...job.steps];
    if (editingStepIndex !== null) {
      newSteps[editingStepIndex] = newStep;
    } else {
      newSteps.push(newStep);
    }

    setJob({ ...job, steps: newSteps });
    setShowStepOverlay(false);
  };

  const removeStep = (index: number) => {
    if (!job) return;
    if (!confirm(ui('confirmDeleteStep'))) return;

    const newSteps = job.steps.filter((_, i) => i !== index);
    // 重新排序
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setJob({ ...job, steps: newSteps });
  };

  const moveStepUp = (index: number) => {
    if (!job || index === 0) return;
    const newSteps = [...job.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setJob({ ...job, steps: newSteps });
  };

  const moveStepDown = (index: number) => {
    if (!job || index === job.steps.length - 1) return;
    const newSteps = [...job.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    newSteps.forEach((step, i) => {
      step.order = i + 1;
    });
    setJob({ ...job, steps: newSteps });
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{tj('editTitle')}</h1>
        <p className="text-muted-foreground">{ui('loading')}</p>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/job">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ui('back')}
          </Button>
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">{tj('editTitle')}</h1>
            <p className="text-muted-foreground mt-1">{tj('editSubtitle')}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? ui('saving') : ui('saveChanges')}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>{tj('basicInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                {tj('pipelineName')}
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={tj('namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                {tj('fieldDescription')}
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={tj('descPlaceholder')}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{tj('enabledState')}</label>
                <p className="text-sm text-muted-foreground">{tj('enabledHint')}</p>
              </div>
              <Switch
                checked={formData.enabled}
                onChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 执行步骤 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{tj('stepsTitle', { count: job.steps.length })}</CardTitle>
              <Button onClick={openAddStepOverlay}>
                <Plus className="w-4 h-4 mr-2" />
                {tj('addStep')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {job.steps.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{tj('noSteps')}</p>
                <Button variant="outline" onClick={openAddStepOverlay}>
                  <Plus className="w-4 h-4 mr-2" />
                  {tj('addFirstStep')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {job.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 p-3 rounded border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {index + 1}. {step.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(step.type)}
                        </Badge>
                      </div>
                      {step.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStepUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStepDown(index)}
                        disabled={index === job.steps.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditStepOverlay(index)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 添加/编辑步骤的 Overlay */}
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
            <label htmlFor="stepType" className="text-sm font-medium">
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
                  // 如果类型改变，清空配置；否则保留
                  config: typeChanged ? {} : stepFormData.config,
                });
              }}
            >
              <SelectTrigger id="stepType">
                <SelectValue placeholder={tj('stepType')} />
              </SelectTrigger>
              <SelectContent>
                <StepTypeSelectOptions />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="stepName" className="text-sm font-medium">
              {tj('stepName')}
            </label>
            <Input
              id="stepName"
              value={stepFormData.name}
              onChange={(e) => setStepFormData({ ...stepFormData, name: e.target.value })}
              placeholder={stepFormData.type ? typeLabel(stepFormData.type) : ''}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="stepDescription" className="text-sm font-medium">
              {tj('stepDesc')}
            </label>
            <Textarea
              id="stepDescription"
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
                  <SelectValue placeholder={tj('agentPickPlaceholder')} />
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
                  {tj('noAgentsAfter')}
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
            <Button type="submit">
              {editingStepIndex !== null ? ui('save') : ui('add')}
            </Button>
          </div>
        </form>
      </Overlay>
    </div>
  );
}
