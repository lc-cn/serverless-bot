'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Flow, MatchType, UserRole, FlowAction } from '@/types';
import { generateId } from '@/lib/utils';

interface FlowListClientProps {
  eventType: 'message' | 'request' | 'notice';
  title: string;
  description: string;
  initialFlows: Flow[];
}

export function FlowListClient({ eventType, title, description, initialFlows }: FlowListClientProps) {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>(initialFlows);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Flow>>({
    name: '',
    description: '',
    enabled: true,
    eventType,
    priority: 100,
    permission: {
      allowRoles: ['normal', 'admin', 'owner'],
      allowEnvironments: ['private', 'group'],
    },
    match: {
      type: 'always',
      pattern: '',
    },
    actions: [],
  });

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
      eventType,
      priority: 100,
      permission: {
        allowRoles: ['normal', 'admin', 'owner'],
        allowEnvironments: ['private', 'group'],
      },
      match: {
        type: 'always',
        pattern: '',
      },
      actions: [],
    });
  };

  const openEditOverlay = (flow: Flow) => {
    setSelectedFlow(flow);
    setFormData({
      name: flow.name,
      description: flow.description,
      enabled: flow.enabled,
      eventType: flow.eventType,
      priority: flow.priority,
      permission: flow.permission,
      match: flow.match,
      actions: flow.actions,
    });
    setShowEditOverlay(true);
  };

  const addAction = () => {
    const newAction: FlowAction = {
      id: generateId(),
      type: 'send_message',
      name: '发送消息',
      config: { content: '', replyToEvent: true },
      order: (formData.actions?.length || 0) + 1,
    };
    setFormData({
      ...formData,
      actions: [...(formData.actions || []), newAction],
    });
  };

  const updateAction = (index: number, updates: Partial<FlowAction>) => {
    const actions = [...(formData.actions || [])];
    actions[index] = { ...actions[index], ...updates };
    setFormData({ ...formData, actions });
  };

  const removeAction = (index: number) => {
    const actions = [...(formData.actions || [])];
    actions.splice(index, 1);
    setFormData({ ...formData, actions });
  };

  const getMatchTypeLabel = (type: MatchType) => {
    const labels: Record<MatchType, string> = {
      exact: '精确匹配',
      keyword: '关键词匹配',
      prefix: '前缀匹配',
      suffix: '后缀匹配',
      contains: '包含匹配',
      regex: '正则匹配',
      always: '总是匹配',
    };
    return labels[type];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/flow">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateOverlay(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加流程
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">暂无流程配置</div>
          <Button onClick={() => setShowCreateOverlay(true)}>
            <Plus className="w-4 h-4 mr-2" />
            创建第一个流程
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-4 cursor-pointer flex-1"
                    onClick={() =>
                      setExpandedFlow(expandedFlow === flow.id ? null : flow.id)
                    }
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{flow.name}</span>
                        <Badge variant="outline">优先级: {flow.priority}</Badge>
                        <Badge variant={flow.enabled ? 'success' : 'secondary'}>
                          {flow.enabled ? '已启用' : '未启用'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getMatchTypeLabel((flow.match?.type as MatchType) || 'always')}
                        {flow.match?.pattern && `: ${flow.match.pattern}`}
                      </div>
                    </div>
                    {expandedFlow === flow.id ? (
                      <ChevronUp className="w-4 h-4 ml-auto" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-auto" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={flow.enabled}
                      onChange={() => handleToggleEnabled(flow)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditOverlay(flow)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFlow(flow);
                        setShowDeleteOverlay(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {expandedFlow === flow.id && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">权限控制</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">
                          允许角色:
                        </span>
                        {(flow.permission?.allowRoles || []).map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))}
                        <span className="text-sm text-muted-foreground ml-4">
                          允许环境:
                        </span>
                        {(flow.permission?.allowEnvironments || []).map((env) => (
                          <Badge key={env} variant="outline">
                            {env === 'private' ? '私聊' : '群聊'}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">
                        处理动作 ({(flow.actions?.length || 0)})
                      </h4>
                      {(flow.actions?.length || 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          无处理动作
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(flow.actions || [])
                            .sort((a, b) => a.order - b.order)
                            .map((action) => (
                              <div
                                key={action.id}
                                className="p-2 rounded-md bg-muted text-sm"
                              >
                                {action.order}. {action.name} ({action.type})
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑流程 Overlay */}
      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedFlow(null);
          resetForm();
        }}
        title={showEditOverlay ? '编辑流程' : '添加流程'}
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="font-medium">基本信息</h3>
            <div>
              <label className="block text-sm font-medium mb-1">流程名称</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例如：关键词回复"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="流程描述（可选）"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">优先级</label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 100,
                    })
                  }
                  placeholder="数字越小优先级越高"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <span>启用流程</span>
                <Switch
                  checked={formData.enabled ?? true}
                  onChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* 匹配规则 */}
          <div className="space-y-4">
            <h3 className="font-medium">匹配规则</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">匹配类型</label>
                <Select
                  value={formData.match?.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      match: {
                        ...formData.match!,
                        type: e.target.value as MatchType,
                      },
                    })
                  }
                >
                  <option value="always">总是匹配</option>
                  <option value="exact">精确匹配</option>
                  <option value="prefix">前缀匹配</option>
                  <option value="suffix">后缀匹配</option>
                  <option value="contains">包含匹配</option>
                  <option value="regex">正则匹配</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">匹配内容</label>
                <Input
                  value={formData.match?.pattern}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      match: { ...formData.match!, pattern: e.target.value },
                    })
                  }
                  placeholder="匹配的文本或正则"
                  disabled={formData.match?.type === 'always'}
                />
              </div>
            </div>
          </div>

          {/* 权限控制 */}
          <div className="space-y-4">
            <h3 className="font-medium">权限控制</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">允许角色</label>
                <div className="flex flex-wrap gap-2">
                  {(['normal', 'admin', 'owner'] as UserRole[]).map((role) => (
                    <label key={role} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.permission?.allowRoles.includes(role)}
                        onChange={(e) => {
                          const roles = e.target.checked
                            ? [...(formData.permission?.allowRoles || []), role]
                            : formData.permission?.allowRoles.filter(
                                (r) => r !== role
                              ) || [];
                          setFormData({
                            ...formData,
                            permission: { ...formData.permission!, allowRoles: roles },
                          });
                        }}
                      />
                      <span className="text-sm">{role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">允许环境</label>
                <div className="flex flex-wrap gap-2">
                  {(['private', 'group'] as const).map((env) => (
                    <label key={env} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.permission?.allowEnvironments.includes(
                          env
                        )}
                        onChange={(e) => {
                          const envs = e.target.checked
                            ? [
                                ...(formData.permission?.allowEnvironments || []),
                                env,
                              ]
                            : formData.permission?.allowEnvironments.filter(
                                (en) => en !== env
                              ) || [];
                          setFormData({
                            ...formData,
                            permission: {
                              ...formData.permission!,
                              allowEnvironments: envs,
                            },
                          });
                        }}
                      />
                      <span className="text-sm">
                        {env === 'private' ? '私聊' : '群聊'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 处理动作 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">处理动作</h3>
              <Button variant="outline" size="sm" onClick={addAction}>
                <Plus className="w-4 h-4 mr-1" />
                添加动作
              </Button>
            </div>
            {formData.actions?.map((action, index) => (
              <Card key={action.id} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium">动作 {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      动作类型
                    </label>
                    <Select
                      value={action.type}
                      onChange={(e) =>
                        updateAction(index, {
                          type: e.target.value as FlowAction['type'],
                        })
                      }
                    >
                      <option value="send_message">发送消息</option>
                      <option value="call_api">调用 API</option>
                      <option value="call_bot">调用 Bot 方法</option>
                      <option value="hardcode">硬编码内容</option>
                      <option value="log">记录日志</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      动作名称
                    </label>
                    <Input
                      value={action.name}
                      onChange={(e) =>
                        updateAction(index, { name: e.target.value })
                      }
                      placeholder="动作名称"
                    />
                  </div>
                </div>
                {action.type === 'send_message' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">
                      回复内容
                    </label>
                    <Textarea
                      value={(action.config.content as string) || ''}
                      onChange={(e) =>
                        updateAction(index, {
                          config: { ...action.config, content: e.target.value },
                        })
                      }
                      placeholder="支持 ${event.xxx} 变量"
                    />
                  </div>
                )}
                {action.type === 'call_api' && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        API URL
                      </label>
                      <Input
                        value={(action.config.url as string) || ''}
                        onChange={(e) =>
                          updateAction(index, {
                            config: { ...action.config, url: e.target.value },
                          })
                        }
                        placeholder="https://api.example.com/xxx"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
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
            <Button onClick={showEditOverlay ? handleUpdate : handleCreate}>
              {showEditOverlay ? '保存' : '创建'}
            </Button>
          </div>
        </div>
      </Overlay>

      {/* 删除确认 Overlay */}
      <Overlay
        isOpen={showDeleteOverlay}
        onClose={() => setShowDeleteOverlay(false)}
        title="删除流程"
      >
        <div className="space-y-4">
          <p>确定要删除流程「{selectedFlow?.name}」吗？此操作不可撤销。</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteOverlay(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}
