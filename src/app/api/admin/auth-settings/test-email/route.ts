import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { getAuthSettings } from '@/lib/auth';
import { getSmtpReadyError, sendSmtpMail } from '@/lib/mail/smtp';

const bodySchema = z.object({
  to: z.string().email(),
});

export async function POST(req: NextRequest) {
  const { error } = await apiRequirePermission('system:auth_settings');
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 });
  }

  const settings = await getAuthSettings();
  const ready = getSmtpReadyError(settings);
  if (ready) {
    return NextResponse.json({ error: ready }, { status: 400 });
  }

  const g = settings.email.templates.generic;
  const subject = g.subject.trim() || 'Serverless Bot — test email';
  const html = g.html.trim() || '<p>This is a test message from the admin console.</p>';
  const text = g.text.trim() || 'This is a test message from the admin console.';

  try {
    await sendSmtpMail(settings, {
      to: parsed.data.to,
      subject,
      html,
      text,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'send_failed';
    return NextResponse.json({ error: 'send_failed', detail: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
