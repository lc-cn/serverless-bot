'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Clock, Edit, Trash2 } from 'lucide-react';
import type { ScheduledTask } from '@/types';

export default function SchedulePage() {
  const tu = useTranslations('Ui');
  const ts = useTranslations('Dashboard.schedule');
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/scheduled-tasks');
      if (r.ok) {
        const d = await r.json();
        setTasks(d.tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tu('confirmDeleteSchedule'))) return;
    try {
      const r = await fetch(`/api/scheduled-tasks/${id}`, { method: 'DELETE' });
      if (r.ok) await load();
      else alert(tu('deleteFailed'));
    } catch {
      alert(tu('deleteFailed'));
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{ts('title')}</h1>
        <p className="text-muted-foreground">{tu('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{ts('title')}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{ts('description')}</p>
        </div>
        <Link href="/schedule/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {ts('newTask')}
          </Button>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="w-10 h-10 mb-3 opacity-50" />
            <p>{ts('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{task.name}</CardTitle>
                    <CardDescription className="mt-1 font-mono text-xs">
                      {task.cronExpr} · {task.timezone || 'UTC'}
                    </CardDescription>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${task.enabled ? 'bg-green-500/15 text-green-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    {task.enabled ? ts('badgeOn') : ts('badgeOff')}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  {ts('jobLabel')} <span className="font-mono text-foreground/90">{task.jobId}</span>
                </p>
                <p>
                  {ts('botLabel')} <span className="font-mono text-foreground/90">{task.botId}</span>
                </p>
                {task.lastRunAt != null && (
                  <p>{ts('lastRun', { datetime: new Date(task.lastRunAt).toLocaleString() })}</p>
                )}
                <div className="flex gap-2 pt-3">
                  <Link href={`/schedule/${task.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      {tu('edit')}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {tu('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
