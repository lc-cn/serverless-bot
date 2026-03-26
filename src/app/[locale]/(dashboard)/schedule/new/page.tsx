'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotConfig, Job } from '@/types';

export default function NewSchedulePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpr, setCronExpr] = useState('0 * * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [jobId, setJobId] = useState('');
  const [botId, setBotId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch('/api/scheduled-tasks');
      if (r.ok) {
        const d = await r.json();
        setJobs(d.jobs || []);
        setBots(d.bots || []);
      }
    })();
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/scheduled-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          cronExpr,
          timezone,
          jobId,
          botId,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        alert(d.detail || d.error || '保存失败');
        return;
      }
      router.push('/schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/schedule" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回列表
        </Link>
        <h1 className="text-2xl font-bold mt-2">新建定时任务</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>配置</CardTitle>
          <CardDescription>
            Cron 为五段：分 时 日 月 周。执行时使用合成「通知」事件，步骤中可通过变量 scheduledTaskId、cronFiredAt
            访问。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="例如：每小时心跳" />
          </div>
          <div>
            <label className="text-sm font-medium">说明（可选）</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Cron 表达式</label>
            <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} className="mt-1 font-mono" />
          </div>
          <div>
            <label className="text-sm font-medium">时区</label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1" placeholder="UTC 或 Asia/Shanghai" />
          </div>
          <div>
            <label className="text-sm font-medium">步骤流水线</label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              <option value="">选择步骤流水线…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">机器人（步骤发消息等需有效 Bot）</label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            >
              <option value="">选择机器人…</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.platform}] {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => void submit()} disabled={saving || !name || !cronExpr || !jobId || !botId}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Link href="/schedule">
              <Button variant="outline" type="button">
                取消
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
