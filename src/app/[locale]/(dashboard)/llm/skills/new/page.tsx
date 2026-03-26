'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';

export default function NewSkillPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', content: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/llm/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          content: form.content,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '创建失败');
        return;
      }
      router.push(`/llm/skills/${encodeURIComponent(d.skill.id)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        href="/llm/skills"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        返回列表
      </Link>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>新建技能</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">名称 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="例如：订单查询说明"
              />
            </div>
            <div>
              <label className="text-sm font-medium">简介（可选）</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="列表中展示用"
              />
            </div>
            <div>
              <label className="text-sm font-medium">技能正文 *</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={12}
                placeholder="写入给模型看的说明、规则、示例对话等（会作为系统提示的一部分注入）"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? '保存中…' : '创建'}
              </Button>
              <Link href="/llm/skills">
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
