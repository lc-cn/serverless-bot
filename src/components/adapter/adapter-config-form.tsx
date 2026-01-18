'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
}

interface AdapterConfigFormProps {
  platform: string;
  initialName?: string;
  initialDescription?: string;
  initialEnabled: boolean;
  initialConfig: Record<string, unknown>;
  configSchema: { fields: FormField[] };
}

export function AdapterConfigForm({
  platform,
  initialName,
  initialDescription,
  initialEnabled,
  initialConfig,
  configSchema,
}: AdapterConfigFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [config, setConfig] = useState<Record<string, unknown>>(initialConfig);
  const [enabled, setEnabled] = useState(initialEnabled);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/adapters/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, enabled, config }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to save adapter:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>适配器信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="适配器显示名称（可自定义）"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="适配器用途或备注"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>基本设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">启用适配器</div>
              <div className="text-sm text-muted-foreground">
                启用后可以接收该平台的 Webhook 事件
              </div>
            </div>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      {configSchema.fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>适配器配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {configSchema.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <Textarea
                    value={(config[field.name] as string) || ''}
                    onChange={(e) =>
                      setConfig({ ...config, [field.name]: e.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={(config[field.name] as string) || ''}
                    onChange={(e) =>
                      setConfig({ ...config, [field.name]: e.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                )}
                {field.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {field.description}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
