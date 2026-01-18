'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Edit, ChevronDown, ChevronUp, Briefcase, Zap, X } from 'lucide-react';
import Link from 'next/link';
import { Flow, Job, Trigger } from '@/types';

interface FlowListClientProps {
  eventType: 'message' | 'request' | 'notice';
  title: string;
  description: string;
  initialFlows: Flow[];
}

export function FlowListClient({ eventType, title, description, initialFlows }: FlowListClientProps) {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>(initialFlows);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const [formData, setFormData] = useState<Partial<Flow>>(
    {
      name: '',
      description: '',
      enabled: true,
      eventType: eventType as Flow['eventType'],
      priority: 100,
      triggerIds: [],
      jobIds: [],
    }
  );

  useEffect(() => {
    loadJobs();
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
      }
    } catch (error) {
      console.error('Failed to create flow:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedFlow) return;

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
    setFormData({
      name: '',
      description: '',
      enabled: true,
      eventType: eventType as Flow['eventType'],
      priority: 100,
      triggerIds: [],
      jobIds: [],
    });
  };

  const openEditOverlay = (flow: Flow) => {
    setSelectedFlow(flow);
    setFormData({
      name: flow.name,
      description: flow.description,
      enabled: flow.enabled,
      priority: flow.priority,
      triggerIds: flow.triggerIds || [],
      jobIds: flow.jobIds || [],
    });
    setShowEditOverlay(true);
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
  const getTriggerById = (triggerId: string) => triggers.find(t => t.id === triggerId);

  return (
    <div>
      <div className="mb-6">
        <Link href="/flow">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
          <Button onClick={() => setShowCreateOverlay(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建流程
          </Button>
        </div>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">暂无流程</p>
            <Button variant="outline" onClick={() => setShowCreateOverlay(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个流程
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
                          <Badge variant="secondary">已禁用</Badge>
                        )}
                        <Badge variant="outline">优先级: {flow.priority}</Badge>
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
                        编辑
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
                        删除
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">
                        触发器: {flow.triggerIds?.length || 0}
                      </Badge>
                      <Badge variant="outline">
                        作业数: {flow.jobIds?.length || 0}
                      </Badge>
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
                      {expandedFlow === flow.id ? '收起' : '查看详情'}
                    </Button>

                    {expandedFlow === flow.id && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* 触发器列表 */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">触发器</h4>
                          {(!flow.triggerIds || flow.triggerIds.length === 0) ? (
                            <p className="text-sm text-muted-foreground">暂无触发器</p>
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
                                        <Badge variant="secondary" className="ml-2">已禁用</Badge>
                                      )}
                                    </span>
                                    {trigger && (
                                      <Badge variant="outline" className="text-xs">
                                        {trigger.match.type === 'always' ? '总是匹配' : trigger.match.type}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 作业列表 */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">执行作业</h4>
                          {(!flow.jobIds || flow.jobIds.length === 0) ? (
                            <p className="text-sm text-muted-foreground">暂无关联作业</p>
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
                                        <Badge variant="secondary" className="ml-2">已禁用</Badge>
                                      )}
                                    </span>
                                    {job && (
                                      <span className="text-xs text-muted-foreground">
                                        {job.steps.length} 个步骤
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
        title={showCreateOverlay ? '新建流程' : '编辑流程'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showCreateOverlay ? handleCreate() : handleUpdate();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">流程名称 *</label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：回复帮助信息"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">描述</label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述这个流程的功能..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">优先级</label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">启用</label>
              <div className="flex items-center pt-2">
                <Switch
                  checked={formData.enabled ?? true}
                  onChange={(checked: boolean) => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">触发器</label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = `/trigger/${eventType}`;
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                新建触发器
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
              <option value="">-- 选择触发器 --</option>
              {triggers
                .filter(t => !(formData.triggerIds ?? []).includes(t.id))
                .map(trigger => (
                  <option key={trigger.id} value={trigger.id}>
                    {trigger.name} ({trigger.enabled ? '启用' : '禁用'})
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
                          <Badge variant="secondary" className="ml-2 text-xs">已禁用</Badge>
                        )}
                      </span>
                      {trigger && (
                        <Badge variant="outline" className="text-xs">
                          {trigger.match.type === 'always' ? '总是匹配' : trigger.match.type}
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
            <label className="text-sm font-medium">关联作业</label>
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
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    addJob(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">添加作业...</option>
                {jobs
                  .filter((job) => !formData.jobIds?.includes(job.id))
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name} ({job.steps.length} 个步骤)
                    </option>
                  ))}
              </Select>
            </div>
          </div>

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
              取消
            </Button>
            <Button type="submit">
              {showCreateOverlay ? '创建' : '保存'}
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
        title="确认删除"
      >
        <p className="mb-6">确定要删除流程 "{selectedFlow?.name}" 吗？此操作无法撤销。</p>
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteOverlay(false);
              setSelectedFlow(null);
            }}
          >
            取消
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            删除
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
