import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { assertCronTickAuthorized } from '@/lib/runtime/cron-tick-env';
import { isScheduledTaskDue } from '@/lib/runtime/cron-due';
import { storage } from '@/lib/persistence';
import { runScheduledTaskExecution } from '@/lib/runtime/scheduled-task-runner';
import { generateId } from '@/lib/shared/utils';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!assertCronTickAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks = await storage.listEnabledScheduledTasks();
  const ran: string[] = [];
  const skippedNotDue: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const task of tasks) {
    if (
      !isScheduledTaskDue(task.cronExpr, task.timezone, task.lastRunAt, task.createdAt)
    ) {
      skippedNotDue.push(task.id);
      continue;
    }

    const traceId = randomUUID();
    const runId = generateId();
    const startedAt = Date.now();
    let runLogId: string | null = null;
    try {
      await storage.insertScheduledTaskRun({
        id: runId,
        taskId: task.id,
        ownerId: task.ownerId,
        traceId,
        startedAt,
      });
      runLogId = runId;
    } catch (e) {
      console.warn(
        JSON.stringify({
          event: 'cron_tick_task_run_log_insert_failed',
          taskId: task.id,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }

    const outcome = await runScheduledTaskExecution(task, traceId);
    if (runLogId) {
      try {
        await storage.finishScheduledTaskRun(runLogId, {
          finishedAt: Date.now(),
          outcome: outcome.ok ? 'ok' : 'error',
          errorMessage: outcome.ok ? undefined : (outcome.error ?? 'unknown'),
        });
      } catch (e) {
        console.warn(
          JSON.stringify({
            event: 'cron_tick_task_run_log_finish_failed',
            taskId: task.id,
            runId: runLogId,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
    }

    if (outcome.ok) {
      await storage.touchScheduledTaskLastRun(task.id, Date.now());
      ran.push(task.id);
      console.info(
        JSON.stringify({
          event: 'cron_tick_task',
          outcome: 'ok',
          traceId,
          taskId: task.id,
          jobId: task.jobId,
          botId: task.botId,
        }),
      );
    } else {
      errors.push({ id: task.id, error: outcome.error ?? 'unknown' });
      console.warn(
        JSON.stringify({
          event: 'cron_tick_task',
          outcome: 'error',
          traceId,
          taskId: task.id,
          error: outcome.error,
        }),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    checked: tasks.length,
    ran: ran.length,
    ranIds: ran,
    skippedNotDue: skippedNotDue.length,
    errors,
  });
}
