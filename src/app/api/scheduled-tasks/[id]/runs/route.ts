import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isScheduledTaskRunsTableMissingError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (!msg.includes('scheduled_task_runs')) return false;
  if (msg.includes('no such table')) return true;
  if (msg.includes("doesn't exist")) return true;
  if (msg.includes('er_no_such_table')) return true;
  if (msg.includes('1146')) return true;
  const code = (e as { code?: string })?.code;
  if (code === 'ER_NO_SUCH_TABLE') return true;
  const errno = (e as { errno?: number })?.errno;
  if (errno === 1146) return true;
  return false;
}

/**
 * 某定时任务的最近执行记录（需任务属主）
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;
    const userId = session!.user.id;
    const { id: taskId } = await params;

    const task = await storage.getScheduledTaskForUser(taskId, userId);
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') ?? '30');
    try {
      const runs = await storage.listScheduledTaskRunsForTask(taskId, userId, limit);
      return NextResponse.json({ runs, degraded: false });
    } catch (listErr) {
      if (isScheduledTaskRunsTableMissingError(listErr)) {
        return NextResponse.json(
          { runs: [], degraded: true, reason: 'scheduled_task_runs_missing' },
          { status: 200 },
        );
      }
      throw listErr;
    }
  } catch (e) {
    console.error('scheduled-tasks [id]/runs GET', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
