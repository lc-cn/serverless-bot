'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Overlay } from '@/components/ui/overlay';
import { ArrowLeft, Plus, Trash2, Edit, Zap } from 'lucide-react';
import Link from 'next/link';
import { Trigger, MatchType, UserRole, FlowEventType } from '@/types';

interface TriggerListClientProps {
  eventType: FlowEventType;
  title: string;
  description: string;
  initialTriggers: Trigger[];
}

export function TriggerListClient({ eventType, title, description, initialTriggers }: TriggerListClientProps) {
  const router = useRouter();
  const [triggers, setTriggers] = useState<Trigger[]>(initialTriggers);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showEditOverlay, setShowEditOverlay] = useState(false);
  const [showDeleteOverlay, setShowDeleteOverlay] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);

  const [formData, setFormData] = useState<Partial<Trigger>>({
    name: '',
    description: '',
    enabled: true,
    eventType,
    match: {
      type: 'always',
      pattern: '',
    },
    permission: {
      allowRoles: ['normal', 'admin', 'owner'],
      allowEnvironments: ['private', 'group'],
    },
  });

  const refreshTriggers = async () => {
    try {
      const res = await fetch(`/api/triggers?type=${eventType}`);
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (error) {
      console.error('Failed to fetch triggers:', error);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateOverlay(false);
        resetForm();
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create trigger:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTrigger) return;

    try {
      const res = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditOverlay(false);
        setSelectedTrigger(null);
        resetForm();
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update trigger:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrigger) return;

    try {
      const res = await fetch(`/api/triggers/${selectedTrigger.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setShowDeleteOverlay(false);
        setSelectedTrigger(null);
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error);
    }
  };

  const handleToggleEnabled = async (trigger: Trigger) => {
    try {
      const res = await fetch(`/api/triggers/${trigger.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !trigger.enabled }),
      });

      if (res.ok) {
        refreshTriggers();
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle trigger:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      eventType,
      match: {
        type: 'always',
        pattern: '',
      },
      permission: {
        allowRoles: ['normal', 'admin', 'owner'],
        allowEnvironments: ['private', 'group'],
      },
    });
  };

  const openEditOverlay = (trigger: Trigger) => {
    setSelectedTrigger(trigger);
    setFormData({
      name: trigger.name,
      description: trigger.description,
      enabled: trigger.enabled,
      eventType: trigger.eventType,
      match: trigger.match,
      permission: trigger.permission,
    });
    setShowEditOverlay(true);
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/trigger">
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
            新建触发器
          </Button>
        </div>
      </div>

      {triggers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">暂无触发器</p>
            <Button variant="outline" onClick={() => setShowCreateOverlay(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个触发器
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {triggers.map((trigger) => (
            <Card key={trigger.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {trigger.name}
                      {!trigger.enabled && (
                        <Badge variant="secondary">已禁用</Badge>
                      )}
                    </CardTitle>
                    {trigger.description && (
                      <CardDescription className="mt-2">
                        {trigger.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Switch
                      checked={trigger.enabled}
                      onChange={() => handleToggleEnabled(trigger)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditOverlay(trigger)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTrigger(trigger);
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
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">
                    匹配: {trigger.match.type === 'always' ? '总是匹配' : trigger.match.type}
                  </Badge>
                  {trigger.match.pattern && (
                    <Badge variant="outline">
                      规则: {trigger.match.pattern}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    环境: {trigger.permission.allowEnvironments.join(', ')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建/编辑触发器的 Overlay */}
      <Overlay
        isOpen={showCreateOverlay || showEditOverlay}
        onClose={() => {
          setShowCreateOverlay(false);
          setShowEditOverlay(false);
          setSelectedTrigger(null);
          resetForm();
        }}
        title={showCreateOverlay ? '新建触发器' : '编辑触发器'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            showCreateOverlay ? handleCreate() : handleUpdate();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">触发器名称 *</label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：关键词匹配"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">描述</label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述这个触发器的功能..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="matchType" className="text-sm font-medium">匹配类型</label>
            <Select
              id="matchType"
              value={formData.match?.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  match: { ...formData.match!, type: e.target.value as MatchType },
                })
              }
            >
              <option value="always">总是匹配</option>
              <option value="keyword">关键词匹配</option>
              <option value="regex">正则表达式</option>
              <option value="exact">精确匹配</option>
              <option value="prefix">前缀匹配</option>
            </Select>
          </div>

          {formData.match?.type !== 'always' && (
            <div className="space-y-2">
              <label htmlFor="pattern" className="text-sm font-medium">匹配规则</label>
              <Input
                id="pattern"
                value={formData.match?.pattern || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    match: { ...formData.match!, pattern: e.target.value },
                  })
                }
                placeholder={
                  formData.match?.type === 'regex'
                    ? '例如：^/help'
                    : '例如：帮助'
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">允许的环境</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.permission?.allowEnvironments.includes('private')}
                  onChange={(e) => {
                    const envs = formData.permission?.allowEnvironments || [];
                    const newEnvs = e.target.checked
                      ? [...envs, 'private']
                      : envs.filter(env => env !== 'private');
                    setFormData({
                      ...formData,
                      permission: { ...formData.permission!, allowEnvironments: newEnvs as ('private' | 'group')[] },
                    });
                  }}
                />
                <span className="text-sm">私聊</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.permission?.allowEnvironments.includes('group')}
                  onChange={(e) => {
                    const envs = formData.permission?.allowEnvironments || [];
                    const newEnvs = e.target.checked
                      ? [...envs, 'group']
                      : envs.filter(env => env !== 'group');
                    setFormData({
                      ...formData,
                      permission: { ...formData.permission!, allowEnvironments: newEnvs as ('private' | 'group')[] },
                    });
                  }}
                />
                <span className="text-sm">群聊</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateOverlay(false);
                setShowEditOverlay(false);
                setSelectedTrigger(null);
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
          setSelectedTrigger(null);
        }}
        title="确认删除"
      >
        <p className="mb-6">确定要删除触发器 "{selectedTrigger?.name}" 吗？此操作无法撤销。</p>
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteOverlay(false);
              setSelectedTrigger(null);
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
