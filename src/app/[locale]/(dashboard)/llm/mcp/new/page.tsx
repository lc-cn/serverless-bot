'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';

export default function NewMcpPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    url: '',
    headersJson: '',
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        url: form.url,
        transport: 'streamable_http',
      };
      if (form.headersJson.trim()) {
        body.headersJson = form.headersJson.trim();
      }
      const r = await fetch('/api/llm/mcp-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '创建失败');
        return;
      }
      router.push(`/llm/mcp/${encodeURIComponent(d.server.id)}`);
    } finally {
      setSaving(false);
    }
  };

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
          <CardTitle>新建 MCP 服务</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="如：公司内部 MCP"
              />
            </div>
            <div>
              <label className="text-sm font-medium">MCP Streamable HTTP URL *</label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
                placeholder="https://your-mcp.example.com/mcp"
              />
              <p className="text-xs text-muted-foreground mt-1">
                须为可公网或内网 worker 访问的 HTTP MCP 根地址（无尾部斜杠亦可）。
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">额外请求头（JSON，可选）</label>
              <Textarea
                value={form.headersJson}
                onChange={(e) => setForm({ ...form, headersJson: e.target.value })}
                rows={3}
                placeholder='{"Authorization":"Bearer xxx"}'
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? '保存中…' : '创建'}
              </Button>
              <Link href="/llm/mcp">
                <Button type="button" variant="outline">
                  取消
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
