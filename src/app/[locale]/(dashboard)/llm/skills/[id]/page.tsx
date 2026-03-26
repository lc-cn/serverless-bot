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
import type { LlmSkill } from '@/types';

export default function EditSkillPage() {
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', content: '' });

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/llm/skills/${encodeURIComponent(id)}`);
      if (!r.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { skill } = (await r.json()) as { skill: LlmSkill };
      setForm({
        name: skill.name,
        description: skill.description || '',
        content: skill.content,
      });
      setLoading(false);
    })();
  }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`/api/llm/skills/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          content: form.content,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.error || '保存失败');
        return;
      }
      router.push('/llm/skills');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中...</p>;
  if (notFound) {
    return (
      <div>
        <p className="text-destructive mb-4">未找到</p>
        <Link href="/llm/skills">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    );
  }

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
          <CardTitle>编辑技能</CardTitle>
          <p className="text-xs font-mono text-muted-foreground">{id}</p>
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
              <label className="text-sm font-medium">简介</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">技能正文 *</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={12}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? '保存中…' : '保存'}
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
