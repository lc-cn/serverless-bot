import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import {
  INSTALL_OK_COOKIE,
  setSignedInstallCookie,
  verifyInstallCookieValue,
} from '@/lib/install/install-cookie';
import { jsonApiError } from '@/lib/http/api-wire-error';
import { localeFromRequestCookies, pickMessage } from '@/lib/i18n/catalog';

const handleI18nRouting = createIntlMiddleware(routing);

function stripLocalePathname(
  pathname: string,
): { locale: string; pathWithoutLocale: string } | null {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) {
      return { locale, pathWithoutLocale: '/' };
    }
    if (pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length) || '/';
      return { locale, pathWithoutLocale: rest };
    }
  }
  return null;
}

function withLocalePath(locale: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${p === '/' ? '' : p}`;
}

/** 安装与系统级白名单：不参与「已安装」判断，也不做强制的登录跳转 */
function bypassInstallGate(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/install/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/webhook/') ||
    pathname.startsWith('/api/internal/flow-queue/') ||
    pathname.startsWith('/api/internal/cron/') ||
    pathname.startsWith('/api/dev/')
  );
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 已安装后仍允许匿名访问的路径 */
function isPublicPath(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === '/' || pathWithoutLocale === '/favicon.ico') return true;
  if (matchesPathPrefix(pathWithoutLocale, '/docs')) return true;
  const publicPrefixes = [
    '/sign-in',
    '/sign-up',
    '/api/auth',
    '/api/webauthn',
    '/api/webhook',
    '/api/internal/flow-queue',
    '/api/internal/cron',
    '/api/dev',
    '/_next',
  ] as const;
  return publicPrefixes.some((p) => matchesPathPrefix(pathWithoutLocale, p));
}

function hasSessionCookie(request: NextRequest): boolean {
  const candidates = [
    '__Secure-authjs.session-token',
    'authjs.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
  ];
  for (const name of candidates) {
    if (request.cookies.get(name)?.value) return true;
    if (request.cookies.get(`${name}.0`)?.value) return true;
  }
  return false;
}

type GatePhase = 'no_database' | 'needs_install' | 'needs_upgrade' | 'installed';

async function fetchInstallPhase(request: NextRequest): Promise<GatePhase> {
  try {
    const url = new URL('/api/install/status', request.nextUrl.origin);
    const r = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { cookie: request.headers.get('cookie') ?? '' },
    });
    const data = (await r.json()) as { phase?: string };
    const p = data.phase;
    if (p === 'installed' || p === 'needs_upgrade' || p === 'needs_install' || p === 'no_database') {
      return p;
    }
    return 'needs_install';
  } catch {
    return 'needs_install';
  }
}

async function applyInstallCookieIfNeeded(
  request: NextRequest,
  base: NextResponse,
): Promise<NextResponse> {
  const installCookieRaw = request.cookies.get(INSTALL_OK_COOKIE)?.value;
  const installCookieOk = await verifyInstallCookieValue(installCookieRaw);
  if (!installCookieOk) {
    try {
      await setSignedInstallCookie(base);
    } catch {
      /* 无签名密钥时不写 Cookie */
    }
  }
  return base;
}

/**
 * API 路由无语言前缀：单独跑安装阶段 + 匿名门禁（matcher 排除了 api，故 intl 不会处理它们）。
 */
async function proxyApi(request: NextRequest, pathname: string): Promise<NextResponse> {
  const phase = await fetchInstallPhase(request);
  const loc = localeFromRequestCookies((n) => request.cookies.get(n)?.value);

  if (phase === 'no_database' || phase === 'needs_install') {
    return NextResponse.redirect(new URL(withLocalePath(loc, '/install'), request.url));
  }
  if (phase === 'needs_upgrade') {
    return NextResponse.redirect(new URL(withLocalePath(loc, '/upgrade'), request.url));
  }

  let res = NextResponse.next();
  res = await applyInstallCookieIfNeeded(request, res);

  if (isPublicPath(pathname)) {
    return res;
  }

  if (!hasSessionCookie(request)) {
    const msg = pickMessage(loc, 'Api.unauthorized');
    return await applyInstallCookieIfNeeded(request, jsonApiError(401, 'UNAUTHORIZED', msg));
  }

  return res;
}

/**
 * Next.js 16+：`proxy.ts` 合并 next-intl 与安装/登录门禁。
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (bypassInstallGate(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return proxyApi(request, pathname);
  }

  const intlResponse = handleI18nRouting(request);
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse;
  }
  if (intlResponse.headers.get('location')) {
    return intlResponse;
  }

  const stripped = stripLocalePathname(pathname);
  const locale = stripped?.locale ?? routing.defaultLocale;
  const pathForGate = stripped?.pathWithoutLocale ?? pathname;

  const phase = await fetchInstallPhase(request);

  if (pathForGate === '/install') {
    if (phase === 'installed') {
      const res = NextResponse.redirect(new URL(withLocalePath(locale, '/'), request.url));
      try {
        await setSignedInstallCookie(res);
      } catch {
        /* 同上 */
      }
      return res;
    }
    if (phase === 'needs_upgrade') {
      return NextResponse.redirect(new URL(withLocalePath(locale, '/upgrade'), request.url));
    }
    return intlResponse;
  }

  if (pathForGate === '/upgrade') {
    if (phase === 'installed') {
      const res = NextResponse.redirect(new URL(withLocalePath(locale, '/'), request.url));
      try {
        await setSignedInstallCookie(res);
      } catch {
        /* 同上 */
      }
      return res;
    }
    if (phase === 'no_database' || phase === 'needs_install') {
      return NextResponse.redirect(new URL(withLocalePath(locale, '/install'), request.url));
    }
    return intlResponse;
  }

  if (phase === 'no_database' || phase === 'needs_install') {
    return NextResponse.redirect(new URL(withLocalePath(locale, '/install'), request.url));
  }
  if (phase === 'needs_upgrade') {
    return NextResponse.redirect(new URL(withLocalePath(locale, '/upgrade'), request.url));
  }

  let res = intlResponse;
  res = await applyInstallCookieIfNeeded(request, res);

  if (isPublicPath(pathForGate)) {
    return res;
  }

  if (!hasSessionCookie(request)) {
    const signInUrl = new URL(withLocalePath(locale, '/sign-in'), request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return await applyInstallCookieIfNeeded(request, NextResponse.redirect(signInUrl));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next|_vercel|_next/static|_next/image|.*\\..*).*)'],
};
