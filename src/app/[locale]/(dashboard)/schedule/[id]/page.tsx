'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { Link } from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotConfig, Job, ScheduledTask, ScheduledTaskRun } from '@/types';

export default function EditSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<ScheduledTask | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [runsLoadError, setRunsLoadError] = useState<string | null>(null);
  const [runsDegradedHint, setRunsDegradedHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const rr = await fetch(`/api/scheduled-tasks/${id}/runs?limit=40`);
      if (rr.ok) {
        const d = await rr.json();
        setRuns(Array.isArray(d.runs) ? d.runs : []);
        setRunsLoadError(null);
        if (d.degraded === true) {
          setRunsDegradedHint(
            '尚未应用数据库迁移 016（或表未创建），执行记录暂不可用；完成迁移后刷新即可。',
          );
        } else {
          setRunsDegradedHint(null);
        }
        return;
      }
      let errText = `请求失败 (${rr.status})`;
      try {
        const d = (await rr.json()) as { error?: string; detail?: string };
        if (typeof d.error === 'string') errText = d.error;
        else if (typeof d.detail === 'string') errText = d.detail;
      } catch {
        /* keep status text */
      }
      setRunsLoadError(errText);
    } catch (e) {
      setRunsLoadError(e instanceof Error ? e.message : '网络异常');
    }
  }, [id]);

  useEffect(() => {
    void (async () => {
      const [tr, boot] = await Promise.all([fetch(`/api/scheduled-tasks/${id}`), fetch('/api/scheduled-tasks')]);
      if (tr.ok) {
        const d = await tr.json();
        setTask(d.task);
      }
      if (boot.ok) {
        const d = await boot.json();
        setJobs(d.jobs || []);
        setBots(d.bots || []);
      }
      await loadRuns();
    })();
  }, [id, loadRuns]);

  const submit = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/scheduled-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: task.name,
          description: task.description,
          enabled: task.enabled,
          cronExpr: task.cronExpr,
          timezone: task.timezone,
          jobId: task.jobId,
          botId: task.botId,
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

  if (!task) {
    return (
      <div>
        <p className="text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="mb-6">
        <Link href="/schedule" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回列表
        </Link>
        <h1 className="text-2xl font-bold mt-2">编辑定时任务</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{task.name}</CardTitle>
          <CardDescription className="font-mono text-xs">{task.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">名称</label>
            <Input
              value={task.name}
              onChange={(e) => setTask({ ...task, name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">说明</label>
            <Input
              value={task.description ?? ''}
              onChange={(e) => setTask({ ...task, description: e.target.value || undefined })}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="en"
              checked={task.enabled}
              onChange={(e) => setTask({ ...task, enabled: e.target.checked })}
            />
            <label htmlFor="en" className="text-sm">
              启用
            </label>
          </div>
          <div>
            <label className="text-sm font-medium">Cron</label>
            <Input
              value={task.cronExpr}
              onChange={(e) => setTask({ ...task, cronExpr: e.target.value })}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium">时区</label>
            <Input
              value={task.timezone}
              onChange={(e) => setTask({ ...task, timezone: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">步骤流水线</label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={task.jobId}
              onChange={(e) => setTask({ ...task, jobId: e.target.value })}
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">机器人</label>
            <select
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={task.botId}
              onChange={(e) => setTask({ ...task, botId: e.target.value })}
            >
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.platform}] {b.name}
                </option>
              ))}
            </select>
          </div>
          {task.lastRunAt != null && (
            <p className="text-sm text-muted-foreground">上次运行: {new Date(task.lastRunAt).toLocaleString()}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadRuns()}>
              刷新执行记录
            </Button>
            <Link href="/schedule">
              <Button variant="outline" type="button">
                取消
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近执行</CardTitle>
          <CardDescription>由 Cron tick 触发写入；成功/失败与错误摘要（需已应用迁移 016）。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto space-y-3">
          {runsLoadError && (
            <p className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2 bg-destructive/5">
              加载执行记录失败：{runsLoadError}
            </p>
          )}
          {!runsLoadError && runsDegradedHint && (
            <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/30">
              {runsDegradedHint}
            </p>
          )}
          {runs.length === 0 && !runsLoadError ? (
            <p className="text-sm text-muted-foreground">
              {runsDegradedHint
                ? '无历史记录（表未就绪或尚无 tick 执行）。'
                : '暂无记录。确认已配置 tick 且任务到期触发。'}
            </p>
          ) : runs.length === 0 ? null : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">开始</th>
                  <th className="py-2 pr-3 font-medium">结束</th>
                  <th className="py-2 pr-3 font-medium">耗时</th>
                  <th className="py-2 pr-3 font-medium">结果</th>
                  <th className="py-2 font-medium">错误 / trace</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const dur =
                    r.finishedAt != null ? `${Math.max(0, r.finishedAt - r.startedAt)} ms` : '—';
                  return (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.startedAt).toLocaleString()}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {r.finishedAt != null ? new Date(r.finishedAt).toLocaleString() : '—'}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{dur}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            r.outcome === 'ok'
                              ? 'text-emerald-700'
                              : r.outcome === 'error'
                                ? 'text-destructive'
                                : 'text-amber-700'
                          }
                        >
                          {r.outcome}
                        </span>
                      </td>
                      <td className="py-2 align-top">
                        {r.errorMessage && (
                          <p className="text-destructive break-all whitespace-pre-wrap">{r.errorMessage}</p>
                        )}
                        {r.traceId && (
                          <p className="text-xs text-muted-foreground font-mono break-all mt-1">trace: {r.traceId}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
