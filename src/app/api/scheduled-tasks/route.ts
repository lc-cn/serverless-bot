import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';
import { validateCronExpression } from '@/lib/runtime/cron-due';
import { generateId } from '@/lib/shared/utils';
import type { ScheduledTask } from '@/types';

export async function GET() {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const userId = session!.user.id;
    const [tasks, jobs, bots] = await Promise.all([
      storage.listScheduledTasksForUser(userId),
      storage.listJobsForUser(userId),
      storage.getBots(userId),
    ]);

    return NextResponse.json({ tasks, jobs, bots });
  } catch (e) {
    console.error('scheduled-tasks GET', e);
    return NextResponse.json({ error: 'Failed to list scheduled tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const userId = session!.user.id;
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const cronExpr = String(body.cronExpr ?? body.cron_expr ?? '').trim();
    const timezone = String(body.timezone ?? 'UTC').trim() || 'UTC';
    const jobId = String(body.jobId ?? body.job_id ?? '').trim();
    const botId = String(body.botId ?? body.bot_id ?? '').trim();

    if (!name || !cronExpr || !jobId || !botId) {
      return NextResponse.json({ error: 'name, cronExpr, jobId, botId required' }, { status: 400 });
    }

    const cronOk = validateCronExpression(cronExpr, timezone);
    if (!cronOk.ok) {
      return NextResponse.json({ error: 'invalid_cron', detail: cronOk.error }, { status: 400 });
    }

    const job = await storage.getJobForUser(jobId, userId);
    if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 });

    const bot = await storage.getBot(botId);
    if (!bot?.enabled) return NextResponse.json({ error: 'bot_not_found' }, { status: 404 });
    const bOwner = bot.ownerId ?? null;
    if (bOwner != null && bOwner !== userId) {
      return NextResponse.json({ error: 'bot_forbidden' }, { status: 403 });
    }

    const now = Date.now();
    const task: ScheduledTask = {
      id: body.id?.trim() || `sched_${generateId()}`,
      name,
      description: body.description != null ? String(body.description) : undefined,
      enabled: body.enabled !== false,
      ownerId: userId,
      jobId,
      botId,
      cronExpr,
      timezone,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await storage.insertScheduledTask(task);

    void writeAuditLog({
      actorUserId: userId,
      action: 'scheduled_task.create',
      entityType: 'scheduled_task',
      entityId: task.id,
      payload: { name: task.name, cronExpr: task.cronExpr, jobId, botId },
      request: req,
    });

    return NextResponse.json({ success: true, task });
  } catch (e) {
    console.error('scheduled-tasks POST', e);
    return NextResponse.json({ error: 'Failed to create scheduled task' }, { status: 500 });
  }
}
