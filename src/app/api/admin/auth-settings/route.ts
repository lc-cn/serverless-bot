import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequirePermission } from '@/lib/auth/permissions';
import {
  getAuthSettings,
  saveAuthSettings,
  type AuthSettings,
  authSettingsSchema,
} from '@/lib/auth';

function redactSecrets(s: AuthSettings): AuthSettings {
  const o = structuredClone(s);
  if (o.providers.github.clientSecret) {
    o.providers.github.clientSecret = '********';
  }
  if (o.email.smtp.password) {
    o.email.smtp.password = '********';
  }
  return o;
}

const emailTemplatePatchSchema = z.object({
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
});

const patchSchema = z
  .object({
    registrationEnabled: z.boolean().optional(),
    providers: z
      .object({
        github: z
          .object({
            enabled: z.boolean().optional(),
            allowBind: z.boolean().optional(),
            allowSignup: z.boolean().optional(),
            clientId: z.string().nullable().optional(),
            clientSecret: z.string().nullable().optional(),
          })
          .optional(),
        passkey: z
          .object({
            enabled: z.boolean().optional(),
            allowBind: z.boolean().optional(),
            allowSignup: z.boolean().optional(),
            rpId: z.string().nullable().optional(),
            rpName: z.string().nullable().optional(),
          })
          .optional(),
      })
      .optional(),
    email: z
      .object({
        enabled: z.boolean().optional(),
        smtp: z
          .object({
            host: z.string().optional(),
            port: z.number().optional(),
            secure: z.boolean().optional(),
            user: z.string().nullable().optional(),
            password: z.string().nullable().optional(),
            fromEmail: z.string().nullable().optional(),
            fromName: z.string().nullable().optional(),
          })
          .optional(),
        templates: z
          .object({
            verification: emailTemplatePatchSchema.optional(),
            passwordReset: emailTemplatePatchSchema.optional(),
            generic: emailTemplatePatchSchema.optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .optional();

function mergeEmailTemplate(
  base: AuthSettings['email']['templates']['verification'],
  patch?: z.infer<typeof emailTemplatePatchSchema>,
): AuthSettings['email']['templates']['verification'] {
  if (!patch) return base;
  return {
    subject: patch.subject ?? base.subject,
    html: patch.html ?? base.html,
    text: patch.text ?? base.text,
  };
}

function buildPatchedSettings(current: AuthSettings, patch: NonNullable<z.infer<typeof patchSchema>>): AuthSettings {
  const ghPatch = patch.providers?.github;
  let clientSecret = current.providers.github.clientSecret;
  if (ghPatch && 'clientSecret' in ghPatch) {
    const s = ghPatch.clientSecret;
    if (s != null && s !== '' && s !== '********') clientSecret = s;
    if (s === '' || s === null) clientSecret = undefined;
  }

  const gh = { ...current.providers.github, ...patch.providers?.github };
  const pk = { ...current.providers.passkey, ...patch.providers?.passkey };

  const em = patch.email;
  let smtpPassword = current.email.smtp.password;
  if (em?.smtp && 'password' in em.smtp) {
    const p = em.smtp.password;
    if (p != null && p !== '' && p !== '********') smtpPassword = p;
    if (p === '' || p === null) smtpPassword = undefined;
  }

  const smtpBase = current.email.smtp;
  const smtpPatch = em?.smtp ?? {};
  const nextSmtp = {
    host: smtpPatch.host ?? smtpBase.host,
    port: smtpPatch.port ?? smtpBase.port,
    secure: smtpPatch.secure ?? smtpBase.secure,
    user: smtpPatch.user != null ? smtpPatch.user : smtpBase.user,
    password: smtpPassword,
    fromEmail: smtpPatch.fromEmail != null ? smtpPatch.fromEmail : smtpBase.fromEmail,
    fromName: smtpPatch.fromName != null ? smtpPatch.fromName : smtpBase.fromName,
  };

  const tpl = current.email.templates;
  const tplPatch = em?.templates;
  const nextTemplates = {
    verification: mergeEmailTemplate(tpl.verification, tplPatch?.verification),
    passwordReset: mergeEmailTemplate(tpl.passwordReset, tplPatch?.passwordReset),
    generic: mergeEmailTemplate(tpl.generic, tplPatch?.generic),
  };

  return {
    ...current,
    registrationEnabled: patch.registrationEnabled ?? current.registrationEnabled,
    providers: {
      github: {
        ...gh,
        clientId: gh.clientId ?? undefined,
        clientSecret,
      },
      passkey: {
        ...pk,
        rpId: pk.rpId ?? undefined,
        rpName: pk.rpName ?? undefined,
      },
    },
    email: {
      enabled: em?.enabled ?? current.email.enabled,
      smtp: nextSmtp,
      templates: nextTemplates,
    },
  };
}

export async function GET() {
  const { error } = await apiRequirePermission('system:auth_settings');
  if (error) return error;

  const settings = await getAuthSettings();
  return NextResponse.json({ settings: redactSecrets(settings) });
}

export async function PATCH(req: NextRequest) {
  const { error } = await apiRequirePermission('system:auth_settings');
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 });
  }

  const patch = parsed.data;
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const current = await getAuthSettings();
  const candidate = buildPatchedSettings(current, patch);

  const valid = authSettingsSchema.safeParse(candidate);
  if (!valid.success) {
    return NextResponse.json({ error: 'invalid_settings' }, { status: 400 });
  }

  await saveAuthSettings(valid.data);
  const saved = await getAuthSettings();
  return NextResponse.json({ settings: redactSecrets(saved) });
}
