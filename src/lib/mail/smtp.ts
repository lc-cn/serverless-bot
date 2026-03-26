import nodemailer from 'nodemailer';
import type { AuthSettings } from '@/lib/auth/auth-settings';

export function getSmtpReadyError(settings: AuthSettings): string | null {
  if (!settings.email.enabled) return 'email_disabled';
  const { host, fromEmail } = settings.email.smtp;
  if (!host.trim()) return 'smtp_host_required';
  if (!fromEmail.trim()) return 'smtp_from_required';
  return null;
}

export function createMailTransport(settings: AuthSettings) {
  const err = getSmtpReadyError(settings);
  if (err) throw new Error(err);
  const smtp = settings.email.smtp;
  return nodemailer.createTransport({
    host: smtp.host.trim(),
    port: smtp.port,
    secure: smtp.secure,
    auth:
      smtp.user.trim().length > 0
        ? { user: smtp.user.trim(), pass: smtp.password ?? '' }
        : undefined,
  });
}

export async function sendSmtpMail(
  settings: AuthSettings,
  opts: { to: string; subject: string; html?: string; text?: string },
): Promise<void> {
  const transport = createMailTransport(settings);
  const smtp = settings.email.smtp;
  const from =
    smtp.fromName.trim().length > 0
      ? `"${smtp.fromName.replace(/"/g, '\\"')}" <${smtp.fromEmail.trim()}>`
      : smtp.fromEmail.trim();
  const html = opts.html?.trim() ? opts.html : undefined;
  const text = opts.text?.trim()
    ? opts.text
    : html
      ? undefined
      : ' ';
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html,
    text,
  });
}

/** 替换模板中的 {{key}} 占位符 */
export function interpolateEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? '');
}
