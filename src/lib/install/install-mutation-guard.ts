import { NextResponse } from 'next/server';

/**
 * 变更类安装接口（执行迁移、写 Vercel 环境变量）：
 * - 生产环境必须配置 INSTALL_SECRET，且请求头 x-install-secret 一致
 * - 开发环境可不配；若配了则必须带对头部
 */
export function assertInstallMutationAllowed(request: Request): NextResponse | null {
  const secret = process.env.INSTALL_SECRET?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      return NextResponse.json(
        {
          error: 'production_install_secret_required',
          message: '生产环境必须设置 INSTALL_SECRET，并在请求头 x-install-secret 中传入相同值。',
        },
        { status: 503 }
      );
    }
    if (request.headers.get('x-install-secret') !== secret) {
      return NextResponse.json({ error: '安装密钥无效' }, { status: 403 });
    }
    return null;
  }
  if (secret && request.headers.get('x-install-secret') !== secret) {
    return NextResponse.json({ error: '安装密钥无效（与 INSTALL_SECRET 不一致）' }, { status: 403 });
  }
  return null;
}
