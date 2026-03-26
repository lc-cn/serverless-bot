import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';
import { validateCronExpression } from '@/lib/runtime/cron-due';
import type { ScheduledTask } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;
    const { id } = await params;
    const task = await storage.getScheduledTaskForUser(id, session!.user.id);
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (e) {
    console.error('scheduled-tasks [id] GET', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;
    const userId = session!.user.id;
    const { id } = await params;

    const existing = await storage.getScheduledTaskForUser(id, userId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const cronExpr = body.cronExpr != null ? String(body.cronExpr).trim() : existing.cronExpr;
    const timezone = body.timezone != null ? String(body.timezone).trim() : existing.timezone;
    const cronOk = validateCronExpression(cronExpr, timezone || 'UTC');
    if (!cronOk.ok) {
      return NextResponse.json({ error: 'invalid_cron', detail: cronOk.error }, { status: 400 });
    }

    const jobId = body.jobId != null ? String(body.jobId).trim() : existing.jobId;
    const botId = body.botId != null ? String(body.botId).trim() : existing.botId;

    const job = await storage.getJobForUser(jobId, userId);
    if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 });

    const bot = await storage.getBot(botId);
    if (!bot?.enabled) return NextResponse.json({ error: 'bot_not_found' }, { status: 404 });
    const bOwner = bot.ownerId ?? null;
    if (bOwner != null && bOwner !== userId) {
      return NextResponse.json({ error: 'bot_forbidden' }, { status: 403 });
    }

    const updated: ScheduledTask = {
      ...existing,
      name: body.name != null ? String(body.name).trim() : existing.name,
      description: body.description !== undefined ? (body.description != null ? String(body.description) : undefined) : existing.description,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      jobId,
      botId,
      cronExpr,
      timezone: timezone || 'UTC',
      updatedAt: Date.now(),
    };

    const ok = await storage.updateScheduledTaskForUser(updated, userId);
    if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

    void writeAuditLog({
      actorUserId: userId,
      action: 'scheduled_task.update',
      entityType: 'scheduled_task',
      entityId: id,
      payload: { name: updated.name, cronExpr: updated.cronExpr, jobId, botId },
      request: req,
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (e) {
    console.error('scheduled-tasks PATCH', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;
    const userId = session!.user.id;
    const { id } = await params;

    await storage.deleteScheduledTaskForUser(id, userId);

    void writeAuditLog({
      actorUserId: userId,
      action: 'scheduled_task.delete',
      entityType: 'scheduled_task',
      entityId: id,
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('scheduled-tasks DELETE', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
