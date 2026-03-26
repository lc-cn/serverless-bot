'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import type { Step } from '@/types';
import { LlmToolStepsEditor } from '@/components/llm-tool-steps-editor';

const DEFAULT_DEF = `{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "根据城市查询天气",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "城市名" }
      },
      "required": ["city"]
    }
  }
}`;

export default function NewToolPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    definitionJson: DEFAULT_DEF,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/llm/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          definitionJson: form.definitionJson,
          steps,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '创建失败');
        return;
      }
      router.push(`/llm/tools/${encodeURIComponent(d.tool.id)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        href="/llm/tools"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回列表
      </Link>
      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>新建工具</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">
              「定义 JSON」供大模型识别 function；「实现步骤」与步骤流水线编辑相同，仅属于本工具，与事件路由里的流水线无关。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">显示名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="例如：查天气"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">简介（可选）</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">定义 JSON *（单条 tool 对象）</label>
              <Textarea
                value={form.definitionJson}
                onChange={(e) => setForm({ ...form, definitionJson: e.target.value })}
                required
                rows={14}
                className="font-mono text-xs mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <code className="font-mono">function.name</code> 须与模型返回的 tool 调用名一致。
              </p>
            </div>
          </CardContent>
        </Card>

        <LlmToolStepsEditor steps={steps} onChange={setSteps} />

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : '创建'}
          </Button>
          <Link href="/llm/tools">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
