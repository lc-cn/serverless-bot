import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 公开路由（不需要认证）
const publicPaths = [
  '/login',
  '/api/auth',
  '/api/init',
  '/api/webhook',
  '/api/dev',
  '/api/adapters',
  '/api/flows',
  '/api/triggers',
  '/api/jobs',
  '/_next',
  '/favicon.ico',
];

// 需要特定权限的路由
const protectedRoutes: { path: string; permissions: string[] }[] = [
  { path: '/users', permissions: ['users:read'] },
  { path: '/api/users', permissions: ['users:read'] },
  { path: '/roles', permissions: ['roles:read'] },
  { path: '/api/roles', permissions: ['roles:read'] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否是公开路由
  const isPublicPath = publicPaths.some(
    (path) => pathname.startsWith(path) || pathname === '/'
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 获取 session token
  const token = request.cookies.get('authjs.session-token')?.value ||
                request.cookies.get('__Secure-authjs.session-token')?.value;

  if (!token) {
    // 未登录，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 权限检查需要在 API 路由或页面中进行（因为 middleware 无法访问完整 session）
  // 这里只做基本的认证检查

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (浏览器图标)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
