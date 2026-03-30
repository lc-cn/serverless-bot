import { NextResponse } from 'next/server';
import { getAuthSettings } from '@/lib/auth';
import { isRelationalDatabaseConfigured } from '@/lib/data-layer';

/**
 * 登录页用：不暴露密钥，仅开关与数据库内是否已配置 OAuth 应用。
 */
export async function GET() {
  const settings = await getAuthSettings();
  const gh = settings.providers.github;
  const go = settings.providers.google;
  const gl = settings.providers.gitlab;
  const pass = settings.providers.passkey;

  const githubConfigured = Boolean(gh.clientId?.trim() && gh.clientSecret?.trim());
  const googleConfigured = Boolean(go.clientId?.trim() && go.clientSecret?.trim());
  const gitlabConfigured = Boolean(gl.clientId?.trim() && gl.clientSecret?.trim());

  return NextResponse.json({
    registrationEnabled: settings.registrationEnabled,
    passwordLoginEnabled: true,
    github: {
      enabled: gh.enabled && githubConfigured,
      allowBind: gh.allowBind,
      allowSignup: gh.allowSignup,
    },
    google: {
      enabled: go.enabled && googleConfigured,
      allowBind: go.allowBind,
      allowSignup: go.allowSignup,
    },
    gitlab: {
      enabled: gl.enabled && gitlabConfigured,
      allowBind: gl.allowBind,
      allowSignup: gl.allowSignup,
    },
    passkey: {
      enabled: pass.enabled,
      allowBind: pass.allowBind,
      allowSignup: pass.allowSignup,
    },
    databaseConfigured: isRelationalDatabaseConfigured(),
  });
}
