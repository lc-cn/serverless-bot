import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';

export async function GET() {
  try {
    const jobs = await storage.getJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to get jobs:', error);
    return NextResponse.json({ error: 'Failed to get jobs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const job = {
      id: `job_${Date.now()}`,
      name: body.name || 'Untitled Job',
      description: body.description || '',
      enabled: body.enabled !== false,
      steps: body.steps || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveJob(job);
    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Failed to create job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
