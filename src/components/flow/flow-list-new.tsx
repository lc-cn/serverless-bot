'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Edit, ChevronDown, ChevronUp, Briefcase, Zap, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Flow, Job, LlmAgent, Trigger } from '@/types';

interface FlowListClientProps {
  eventType: 'message' | 'request' | 'notice';
  title: string;
  description: string;
  initialFlows: Flow[];
}

export function FlowListClient({ eventType, title, description, initialFlows }: FlowListClientProps) {
  const ui = useTranslations('Ui');
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>(initialFlows);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agents, setAgents] = useState<LlmAgent[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const [addJobPicker, setAddJobPicker] = useState('');
  const [formData, setFormData] = useState<Partial<Flow>>(
    {
      name: '',
      description: '',
      enabled: true,
      eventType: eventType as Flow['eventType'],
      priority: 100,
      triggerIds: [],
      targetKind: 'job',
      llmAgentId: null,
      jobIds: [],
      haltLowerPriorityAfterMatch: false,
    }
  );

  useEffect(() => {
    loadJobs();
    loadAgents();
    loadTriggers();
  }, []);

  const loadJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const loadTriggers = async () => {
    try {
      const res = await fetch(`/api/triggers?type=${eventType}`);
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (error) {
      console.error('Failed to load triggers:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (res.ok) {
        setAgents(data.agents || []);
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
      setAgents([]);
    }
  };

  const refreshFlows = async () => {
    try {
      const res = await fetch(`/api/flows?type=${eventType}`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error('Failed to fetch flows:', error);
    }
  };

  const handleCreate = async () => {
    const kind = formData.targetKind ?? 'job';
    if (kind === 'job' && !(formData.jobIds?.length ?? 0)) {
      alert(ui('bindPipelineRequired'));
      return;
    }
    if (kind === 'agent' && !String(formData.llmAgentId ?? '').trim()) {
      alert(ui('bindAgentRequired'));
      return;
    }

    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        resetForm();
        refreshFlows();
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err.details && err.details[0] && (err.details[0].message as string)) ||
          err.error ||
          ui('createFailed');
        alert(msg);
      }
    } catch (error) {
      console.error('Failed to create flow:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedFlow) return;

    const kind = formData.targetKind ?? 'job';
    if (kind === 'job' && !(formData.jobIds?.length ?? 0)) {
      alert(ui('bindPipelineRequired'));
      return;
    }
    if (kind === 'agent' && !String(formData.llmAgentId ?? '').trim()) {
      alert(ui('bindAgentRequired'));
      return;
    }

    try {
      const res = await fetch(`/api/flows/${selectedFlow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditOverlay(false);
        setSelectedFlow(null);
        resetForm();
        refreshFlows();
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err.details && err.details[0] && (err.details[0].message as string)) ||
          err.error ||
          ui('saveFailed');
        alert(msg);
      }
    } catch (error) {
      console.error('Failed to update flow:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedFlow) return;

    try {
      const res = await fetch(`/api/flows/${selectedFlow.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedFlow(null);
        refreshFlows();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete flow:', error);
    }
  };

  const handleToggleEnabled = async (flow: Flow) => {
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !flow.enabled }),
      });

      if (res.ok) {
        refreshFlows();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle flow:', error);
    }
  };

  const resetForm = () => {
    setAddJobPicker('');
    setFormData({
      name: '',
      description: '',
      enabled: true,
      eventType: eventType as Flow['eventType'],
      priority: 100,
      triggerIds: [],
      targetKind: 'job',
      llmAgentId: null,
      jobIds: [],
      haltLowerPriorityAfterMatch: false,
    });
  };

  const openEditOverlay = (flow: Flow) => {
    setSelectedFlow(flow);
    const kind = flow.targetKind === 'agent' ? 'agent' : 'job';
    setFormData({
      name: flow.name,
      description: flow.description,
      enabled: flow.enabled,
      priority: flow.priority,
      triggerIds: flow.triggerIds || [],
      targetKind: kind,
      llmAgentId: flow.llmAgentId ?? null,
      jobIds: flow.jobIds || [],
      haltLowerPriorityAfterMatch: flow.haltLowerPriorityAfterMatch === true,
    });
    setShowEditOverlay(true);
    setAddJobPicker('');
  };

  const addTrigger = (triggerId: string) => {
    if (!formData.triggerIds?.includes(triggerId)) {
      setFormData({
        ...formData,
        triggerIds: [...(formData.triggerIds || []), triggerId],
      });
    }
  };

  const removeTrigger = (triggerId: string) => {
    const triggerIds = (formData.triggerIds || []).filter(id => id !== triggerId);
    setFormData({ ...formData, triggerIds });
  };

  const addJob = (jobId: string) => {
    if (!formData.jobIds?.includes(jobId)) {
      setFormData({
        ...formData,
        jobIds: [...(formData.jobIds || []), jobId],
      });
    }
  };

  const removeJob = (index: number) => {
    const jobIds = [...(formData.jobIds || [])];
    jobIds.splice(index, 1);
    setFormData({ ...formData, jobIds });
  };

  const moveJobUp = (index: number) => {
    if (index === 0) return;
    const jobIds = [...(formData.jobIds || [])];
    [jobIds[index - 1], jobIds[index]] = [jobIds[index], jobIds[index - 1]];
    setFormData({ ...formData, jobIds });
  };

  const moveJobDown = (index: number) => {
    const jobIds = formData.jobIds || [];
    if (index === jobIds.length - 1) return;
    const newJobIds = [...jobIds];
    [newJobIds[index], newJobIds[index + 1]] = [newJobIds[index + 1], newJobIds[index]];
    setFormData({ ...formData, jobIds: newJobIds });
  };

  const getJobById = (jobId: string) => jobs.find(j => j.id === jobId);
  const getAgentById = (agentId: string | null | undefined) =>
    agentId ? agents.find((a) => a.id === agentId) : undefined;
  const getTriggerById = (triggerId: string) => triggers.find(t => t.id === triggerId);

  return (
    <div>
      <div className="mb-6">
        <Link href="/flow">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ui('back')}
          </Button>
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          <Button onClick={() => setShowCreateOverlay(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {ui('newFlow')}
          </Button>
        </div>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">{ui('emptyFlows')}</p>
            <Button variant="outline" onClick={() => setShowCreateOverlay(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {ui('createFirstFlow')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flows
            .sort((a, b) => b.priority - a.priority)
            .map((flow) => (
              <Card key={flow.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {flow.name}
                        {!flow.enabled && (
                          <Badge variant="secondary">{ui('disabledBadge')}</Badge>
                        )}
                        <Badge variant="outline">{ui('priorityLabel', { priority: flow.priority })}</Badge>
                      </CardTitle>
                      {flow.description && (
                        <CardDescription className="mt-2">
                          {flow.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={flow.enabled}
                        onChange={() => handleToggleEnabled(flow)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditOverlay(flow)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {ui('edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFlow(flow);
                          setShowDeleteOverlay(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {ui('delete')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">
                        {ui('triggerCountBadge', { count: flow.triggerIds?.length || 0 })}
                      </Badge>
                      {(flow.targetKind ?? 'job') === 'agent' ? (
                        <Badge variant="outline">
                          {ui('flowAgentBadgePrefix')}
                          {getAgentById(flow.llmAgentId)?.name || flow.llmAgentId || ui('agentUnset')}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {ui('jobCountBadge', { count: flow.jobIds?.length || 0 })}
                        </Badge>
                      )}
                      {flow.haltLowerPriorityAfterMatch && (
                        <Badge variant="secondary">{ui('haltAfterMatchBadge')}</Badge>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedFlow(expandedFlow === flow.id ? null : flow.id)
                      }
                    >
                      {expandedFlow === flow.id ? (
                        <ChevronUp className="w-4 h-4 mr-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 mr-2" />
                      )}
                      {expandedFlow === flow.id ? ui('collapse') : ui('viewDetails')}
                    </Button>

                    {expandedFlow === flow.id && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* 触发器列表 */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">{ui('triggersSectionTitle')}</h4>
                          {(!flow.triggerIds || flow.triggerIds.length === 0) ? (
                            <p className="text-sm text-muted-foreground">{ui('emptyTriggersInline')}</p>
                          ) : (
                            <div className="space-y-2">
                              {flow.triggerIds.map((triggerId, index) => {
                                const trigger = getTriggerById(triggerId);
                                return (
                                  <div
                                    key={triggerId}
                                    className="flex items-center gap-2 p-2 rounded border bg-muted/50"
                                  >
                                    <Zap className="w-4 h-4 text-muted-foreground" />
                                    <span className="flex-1">
                                      {trigger?.name || triggerId}
                                      {trigger && !trigger.enabled && (
                                        <Badge variant="secondary" className="ml-2">{ui('disabledBadge')}</Badge>
                                      )}
                                    </span>
                                    {trigger && (
                                      <Badge variant="outline" className="text-xs">
                                        {trigger.match.type === 'always' ? ui('alwaysMatch') : trigger.match.type}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 步骤流水线或 Agent */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            {(flow.targetKind ?? 'job') === 'agent' ? ui('flowTargetAgent') : ui('flowTargetJob')}
                          </h4>
                          {(flow.targetKind ?? 'job') === 'agent' ? (
                            flow.llmAgentId ? (
                              <div className="flex items-center gap-2 p-2 rounded border bg-muted/50">
                                <Briefcase className="w-4 h-4 text-muted-foreground" />
                                <span className="flex-1">
                                  {getAgentById(flow.llmAgentId)?.name || flow.llmAgentId}
                                </span>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">{ui('noAgentChosen')}</p>
                            )
                          ) : (!flow.jobIds || flow.jobIds.length === 0) ? (
                            <p className="text-sm text-muted-foreground">{ui('emptyPipelinesInline')}</p>
                          ) : (
                            <div className="space-y-2">
                              {flow.jobIds.map((jobId, index) => {
                                const job = getJobById(jobId);
                                return (
                                  <div
                                    key={jobId}
                                    className="flex items-center gap-2 p-2 rounded border bg-muted/50"
                                  >
                                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                                    <span className="flex-1">
                                      {index + 1}. {job?.name || jobId}
                                      {job && !job.enabled && (
                                        <Badge variant="secondary" className="ml-2">{ui('disabledBadge')}</Badge>
                                      )}
                                    </span>
                                    {job && (
                                      <span className="text-xs text-muted-foreground">
                                        {ui('stepCountShort', { count: job.steps.length })}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* 创建/编辑流程的 Overlay */}
      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedFlow(null);
          resetForm();
        }}
        title={showCreateOverlay ? ui('overlayNewFlow') : ui('overlayEditFlow')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showCreateOverlay ? handleCreate() : handleUpdate();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              {ui('flowFormNameLabel')}
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={ui('flowFormNamePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {ui('flowFormDescLabel')}
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={ui('flowFormDescPlaceholder')}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">
                {ui('flowFormPriorityLabel')}
              </label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{ui('flowFormEnabledLabel')}</label>
              <div className="flex items-center pt-2">
                <Switch
                  checked={formData.enabled ?? true}
                  onChange={(checked: boolean) => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{ui('haltLowerPriorityTitle')}</div>
                <p className="text-xs text-muted-foreground mt-1">{ui('haltLowerPriorityDescription')}</p>
              </div>
              <Switch
                checked={formData.haltLowerPriorityAfterMatch === true}
                onChange={(checked: boolean) =>
                  setFormData({ ...formData, haltLowerPriorityAfterMatch: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{ui('flowFormTriggersLabel')}</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = `/trigger/${eventType}`;
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                {ui('newTriggerShortcut')}
              </Button>
            </div>
            
            <select
              className="w-full p-2 border rounded"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addTrigger(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">{ui('selectTriggerPlaceholder')}</option>
              {triggers
                .filter(t => !(formData.triggerIds ?? []).includes(t.id))
                .map(trigger => (
                  <option key={trigger.id} value={trigger.id}>
                    {`${trigger.name} (${trigger.enabled ? ui('badgeEnabledShort') : ui('badgeDisabledShort')})`}
                  </option>
                ))
              }
            </select>

            {(formData.triggerIds?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {(formData.triggerIds ?? []).map((triggerId) => {
                  const trigger = getTriggerById(triggerId);
                  return (
                    <div
                      key={triggerId}
                      className="flex items-center gap-2 p-2 rounded border bg-muted"
                    >
                      <Zap className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1">
                        {trigger?.name || triggerId}
                        {trigger && !trigger.enabled && (
                          <Badge variant="secondary" className="ml-2 text-xs">{ui('disabledBadge')}</Badge>
                        )}
                      </span>
                      {trigger && (
                        <Badge variant="outline" className="text-xs">
                          {trigger.match.type === 'always' ? ui('alwaysMatch') : trigger.match.type}
                        </Badge>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTrigger(triggerId)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{ui('executionTargetLabel')}</span>
            <div className="flex flex-wrap gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flowTargetKind"
                  className="rounded-full"
                  checked={(formData.targetKind ?? 'job') === 'job'}
                  onChange={() =>
                    setFormData((f) => ({
                      ...f,
                      targetKind: 'job',
                      llmAgentId: null,
                    }))
                  }
                />
                {ui('bindJobTarget')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flowTargetKind"
                  className="rounded-full"
                  checked={formData.targetKind === 'agent'}
                  onChange={() =>
                    setFormData((f) => ({
                      ...f,
                      targetKind: 'agent',
                      jobIds: [],
                    }))
                  }
                />
                {ui('bindAgentTarget')}
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{ui('executionTargetHint')}</p>
          </div>

          {(formData.targetKind ?? 'job') === 'agent' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">{ui('llmAgentSelectLabel')}</label>
              <select
                className="w-full p-2 border rounded-md bg-background"
                value={formData.llmAgentId ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    llmAgentId: e.target.value ? e.target.value : null,
                  })
                }
              >
                <option value="">{ui('selectAgentPlaceholder')}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {agents.length === 0 && (
                <p className="text-xs text-muted-foreground">{ui('noAgentsForFlowHint')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">{ui('linkedJobsLabel')}</label>
              <div className="space-y-2">
                {formData.jobIds?.map((jobId, index) => {
                  const job = getJobById(jobId);
                  return (
                    <div key={index} className="flex items-center gap-2 p-2 rounded border">
                      <Briefcase className="w-4 h-4" />
                      <span className="flex-1">
                        {index + 1}. {job?.name || jobId}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveJobUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveJobDown(index)}
                        disabled={index === (formData.jobIds?.length || 0) - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeJob(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}

                <Select
                  value={addJobPicker}
                  onValueChange={(jobId) => {
                    if (jobId) addJob(jobId);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={ui('addJobSelectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs
                      .filter((job) => !formData.jobIds?.includes(job.id))
                      .map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {ui('jobOptionNameSteps', {
                            name: job.name,
                            steps: ui('stepCountShort', { count: job.steps.length }),
                          })}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateOverlay(false);
                setShowEditOverlay(false);
                setSelectedFlow(null);
                resetForm();
              }}
            >
              {ui('cancel')}
            </Button>
            <Button type="submit">
              {showCreateOverlay ? ui('create') : ui('save')}
            </Button>
          </div>
        </form>
      </Overlay>

      {/* 删除确认 */}
      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => {
          setShowDeleteOverlay(false);
          setSelectedFlow(null);
        }}
        title={ui('confirmDeleteTitle')}
      >
        <p className="mb-6">
          {ui('confirmDeleteFlowNamed', { name: selectedFlow?.name ?? '' })}
        </p>
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteOverlay(false);
              setSelectedFlow(null);
            }}
          >
            {ui('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            {ui('delete')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
