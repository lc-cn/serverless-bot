import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';
import { isPresetLibraryOwner } from '@/lib/preset-library';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const job = await storage.getJobForUser(id, session!.user.id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (error) {
    console.error('Failed to get job:', error);
    return NextResponse.json({ error: 'Failed to get job' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const existingJob = await storage.getJobForUser(id, session!.user.id);

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (isPresetLibraryOwner(existingJob.ownerId)) {
      return NextResponse.json(
        { error: '预设作业为只读，请复制后再编辑' },
        { status: 403 }
      );
    }

    const {
      id: _bid,
      ownerId: _boid,
      createdAt: _bc,
      updatedAt: _bu,
      ...bodyPatch
    } = body as Record<string, unknown>;

    const job = {
      ...existingJob,
      ...bodyPatch,
      id,
      ownerId: existingJob.ownerId ?? session!.user.id,
      updatedAt: Date.now(),
    };

    await storage.saveJob(job);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'job.update',
      entityType: 'job',
      entityId: id,
      payload: { name: job.name, enabled: job.enabled },
      request: req,
    });
    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    // 删除 job（flow_jobs 关联会通过数据库外键级联删除，steps 也会级联删除）
    await storage.deleteJobForUser(id, session!.user.id);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'job.delete',
      entityType: 'job',
      entityId: id,
      request: req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
