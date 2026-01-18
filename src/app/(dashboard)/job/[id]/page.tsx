'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { StepConfigForm } from '@/components/step-config-form';
import { stepConfigSchemas } from '@/lib/step-schemas';
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
import Link from 'next/link';
import { Job, Step, StepType } from '@/types';

const stepTypeLabels: Record<StepType, string> = {
  send_message: '发送消息',
  call_api: '调用 API',
  call_bot: '调用机器人',
  hardcode: '固定回复',
  log: '日志记录',
  get_user_info: '获取用户信息',
  get_group_info: '获取群组信息',
  set_variable: '设置变量',
  conditional: '条件判断',
  delay: '延迟执行',
  random_reply: '随机回复',
  template_message: '模板消息',
  forward_message: '转发消息',
  handle_request: '处理请求',
  recall_message: '撤回消息',
  extract_data: '提取数据',
};

export default function JobEditPage() {
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

  useEffect(() => {
    loadJob();
  }, [jobId]);

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
        alert('作业不存在');
        router.push('/job');
      }
    } catch (error) {
      console.error('Failed to load job:', error);
      alert('加载失败');
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
        alert('保存成功');
        await loadJob();
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      alert('保存失败');
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
      name: stepFormData.name || stepTypeLabels[stepFormData.type!],
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
    if (!confirm('确定要删除这个步骤吗？')) return;

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
        <h1 className="text-2xl font-bold mb-6">编辑作业</h1>
        <p className="text-muted-foreground">加载中...</p>
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
            返回
          </Button>
        </Link>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold">编辑作业</h1>
            <p className="text-muted-foreground mt-1">
              管理作业的基本信息和执行步骤
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存更改'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">作业名称 *</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：发送欢迎消息"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">描述</label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述这个作业的功能..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">启用状态</label>
                <p className="text-sm text-muted-foreground">
                  禁用后，关联此作业的流程将不会执行
                </p>
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
              <CardTitle>执行步骤 ({job.steps.length})</CardTitle>
              <Button onClick={openAddStepOverlay}>
                <Plus className="w-4 h-4 mr-2" />
                添加步骤
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {job.steps.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">暂无执行步骤</p>
                <Button variant="outline" onClick={openAddStepOverlay}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一个步骤
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
                          {stepTypeLabels[step.type]}
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
        title={editingStepIndex !== null ? '编辑步骤' : '添加步骤'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveStep();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label htmlFor="stepType" className="text-sm font-medium">步骤类型 *</label>
            <Select
              id="stepType"
              value={stepFormData.type}
              onChange={(e) => {
                const newType = e.target.value as StepType;
                const typeChanged = stepFormData.type !== newType;
                
                setStepFormData({
                  ...stepFormData,
                  type: newType,
                  name: stepFormData.name || stepTypeLabels[newType],
                  // 如果类型改变，清空配置；否则保留
                  config: typeChanged ? {} : stepFormData.config,
                });
              }}
            >
              {Object.entries(stepTypeLabels).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="stepName" className="text-sm font-medium">步骤名称</label>
            <Input
              id="stepName"
              value={stepFormData.name}
              onChange={(e) => setStepFormData({ ...stepFormData, name: e.target.value })}
              placeholder={stepFormData.type ? stepTypeLabels[stepFormData.type] : ''}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="stepDescription" className="text-sm font-medium">描述</label>
            <Textarea
              id="stepDescription"
              value={stepFormData.description}
              onChange={(e) => setStepFormData({ ...stepFormData, description: e.target.value })}
              placeholder="描述这个步骤的功能..."
              rows={2}
            />
          </div>

          {stepFormData.type && stepConfigSchemas[stepFormData.type] && (
            <div className="space-y-2">
              <label className="text-sm font-medium">步骤配置</label>
              <StepConfigForm
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
              取消
            </Button>
            <Button type="submit">
              {editingStepIndex !== null ? '保存' : '添加'}
            </Button>
          </div>
        </form>
      </Overlay>
    </div>
  );
}
