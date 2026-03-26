'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import type { LlmTool, Step } from '@/types';
import { LlmToolStepsEditor } from '@/components/llm-tool-steps-editor';

export default function EditToolPage() {
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [form, setForm] = useState({ name: '', description: '', definitionJson: '' });

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/llm/tools/${encodeURIComponent(id)}`);
      if (!r.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { tool } = (await r.json()) as { tool: LlmTool };
      setForm({
        name: tool.name,
        description: tool.description || '',
        definitionJson: tool.definitionJson,
      });
      setSteps(tool.steps || []);
      setLoading(false);
    })();
  }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`/api/llm/tools/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          definitionJson: form.definitionJson,
          steps,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '保存失败');
        return;
      }
      router.push('/llm/tools');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中...</p>;
  if (notFound) {
    return (
      <div>
        <p className="text-destructive mb-4">未找到</p>
        <Link href="/llm/tools">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    );
  }

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
            <CardTitle>编辑工具</CardTitle>
            <p className="text-xs font-mono text-muted-foreground">{id}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">显示名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">简介</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">定义 JSON *</label>
              <Textarea
                value={form.definitionJson}
                onChange={(e) => setForm({ ...form, definitionJson: e.target.value })}
                required
                rows={14}
                className="font-mono text-xs mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <LlmToolStepsEditor steps={steps} onChange={setSteps} />

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
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
