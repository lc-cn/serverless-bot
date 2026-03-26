'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import type { LlmMcpServer } from '@/types';

export default function EditMcpPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', headersJson: '' });

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/llm/mcp-servers/${encodeURIComponent(id)}`);
      if (!r.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { server } = (await r.json()) as {
        server: LlmMcpServer & { headersJson?: string | null };
      };
      setForm({
        name: server.name,
        url: server.url,
        headersJson: server.headersJson?.trim() ? server.headersJson : '',
      });
      setLoading(false);
    })();
  }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        url: form.url,
        headersJson: form.headersJson.trim() ? form.headersJson.trim() : null,
      };
      const r = await fetch(`/api/llm/mcp-servers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '保存失败');
        return;
      }
      const reload = await fetch(`/api/llm/mcp-servers/${encodeURIComponent(id)}`);
      if (reload.ok) {
        const { server: s } = (await reload.json()) as {
          server: LlmMcpServer & { headersJson?: string | null };
        };
        setForm({
          name: s.name,
          url: s.url,
          headersJson: s.headersJson?.trim() ? s.headersJson : '',
        });
      }
      alert('已保存');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中...</p>;
  if (notFound) {
    return (
      <div>
        <p className="text-destructive mb-4">未找到</p>
        <Link href="/llm/mcp">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/llm/mcp"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回列表
      </Link>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>编辑 MCP</CardTitle>
          <p className="text-xs font-mono text-muted-foreground break-all">{id}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">请求头 JSON</label>
              <Textarea
                value={form.headersJson}
                onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
                rows={3}
                placeholder='例如 {"Authorization":"Bearer …"}；清空后保存将移除已存请求头'
                className="font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
