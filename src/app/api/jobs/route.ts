import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const jobs = await storage.listJobsForUser(session!.user.id);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to get jobs:', error);
    return NextResponse.json({ error: 'Failed to get jobs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const body = await req.json();
    const job = {
      id: `job_${Date.now()}`,
      name: body.name || 'Untitled Job',
      description: body.description || '',
      enabled: body.enabled !== false,
      steps: body.steps || [],
      ownerId: session!.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveJob(job);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'job.create',
      entityType: 'job',
      entityId: job.id,
      payload: { name: job.name, enabled: job.enabled },
      request: req,
    });
    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Failed to create job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
