import { NextResponse } from 'next/server';
import { vercelPushEnvironmentVariables } from '@/lib/install/vercel-env';
import { assertInstallMutationAllowed } from '@/lib/install/install-mutation-guard';

type Body = {
  token: string;
  projectId: string;
  teamId?: string;
  variables: Record<string, string>;
};

/**
 * 将环境变量写入 Vercel 项目（需用户 Personal Access Token）。
 * 写入后须在 Vercel 控制台重新部署，新变量才会注入运行时。
 */
export async function POST(request: Request) {
  const denied = assertInstallMutationAllowed(request);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.token?.trim() || !body?.projectId?.trim() || !body?.variables || typeof body.variables !== 'object') {
    return NextResponse.json({ error: '需要 token、projectId、variables' }, { status: 400 });
  }

  const result = await vercelPushEnvironmentVariables({
    token: body.token,
    projectId: body.projectId,
    teamId: body.teamId,
    variables: body.variables,
  });

  if (!result.ok) {
    return NextResponse.json({ error: 'vercel_api_error', details: result.details }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message:
      '已在 Vercel 创建/更新环境变量。请到 Vercel 项目执行一次 Redeploy，部署完成后再进行「数据库一键安装」。',
  });
}
