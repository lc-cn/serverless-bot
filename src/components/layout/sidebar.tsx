'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/shared/utils';
import { SponsorSidebarFooter } from '@/components/sponsor/sponsor-sidebar-footer';
import {
  Settings,
  Workflow,
  ChevronRight,
  LayoutDashboard,
  Users,
  Shield,
  User,
  Briefcase,
  ListChecks,
  Zap,
  MessageSquare,
  Hash,
  Sparkles,
  BookOpen,
  Wrench,
  Layers,
  Plug,
  Clock,
  Rocket,
  KeyRound,
  SlidersHorizontal,
} from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  /** 需要该权限才显示；不填则始终显示 */
  permission?: string;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

function navItemIsActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/dashboard') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  }
  if (item.href === '/agents') {
    return pathname.startsWith('/agents');
  }
  if (item.href === '/llm/vendors') {
    return pathname.startsWith('/llm/vendors');
  }
  if (item.href === '/llm/mcp') {
    return pathname.startsWith('/llm/mcp');
  }
  if (item.href === '/chat') {
    return pathname.startsWith('/chat');
  }
  if (item.href === '/schedule') {
    return pathname.startsWith('/schedule');
  }
  if (item.href === '/settings/auth') {
    return pathname.startsWith('/settings/auth');
  }
  if (item.href === '/settings/platform') {
    return pathname.startsWith('/settings/platform');
  }
  return pathname.startsWith(item.href);
}

export function SidebarNav({
  collapsed,
  onLinkClick,
  className,
  sponsorPrimaryUrl,
}: {
  collapsed: boolean;
  onLinkClick?: () => void;
  className?: string;
  /** 由 dashboard layout 服务端注入；未配置则不显示 */
  sponsorPrimaryUrl?: string | null;
}) {
  const pathname = usePathname();
  const t = useTranslations('Sidebar');
  const { data: session } = useSession();
  const perms = session?.user?.permissions ?? [];

  const navSections: NavSection[] = useMemo(
    () => [
      {
        titleKey: 'sectionOverview',
        items: [
          {
            href: '/dashboard',
            labelKey: 'navDashboard',
            icon: <LayoutDashboard className="size-4 shrink-0" />,
          },
          { href: '/onboarding', labelKey: 'navOnboarding', icon: <Rocket className="size-4 shrink-0" /> },
        ],
      },
      {
        titleKey: 'sectionBot',
        items: [
          { href: '/adapter', labelKey: 'navAdapter', icon: <Settings className="size-4 shrink-0" /> },
          { href: '/chat', labelKey: 'navChat', icon: <MessageSquare className="size-4 shrink-0" /> },
        ],
      },
      {
        titleKey: 'sectionAutomation',
        items: [
          { href: '/trigger', labelKey: 'navTrigger', icon: <Zap className="size-4 shrink-0" /> },
          { href: '/flow', labelKey: 'navFlow', icon: <Workflow className="size-4 shrink-0" /> },
          { href: '/job', labelKey: 'navJob', icon: <Briefcase className="size-4 shrink-0" /> },
          { href: '/schedule', labelKey: 'navSchedule', icon: <Clock className="size-4 shrink-0" /> },
        ],
      },
      {
        titleKey: 'sectionStep',
        items: [
          {
            href: '/step',
            labelKey: 'navStep',
            icon: <ListChecks className="size-4 shrink-0" />,
          },
        ],
      },
      {
        titleKey: 'sectionLlmRuntime',
        items: [
          {
            href: '/llm/vendors',
            labelKey: 'navVendors',
            icon: <Layers className="size-4 shrink-0" />,
          },
          { href: '/agents', labelKey: 'navAgents', icon: <Sparkles className="size-4 shrink-0" /> },
        ],
      },
      {
        titleKey: 'sectionLlmAssets',
        items: [
          { href: '/llm/skills', labelKey: 'navSkills', icon: <BookOpen className="size-4 shrink-0" /> },
          { href: '/llm/tools', labelKey: 'navTools', icon: <Wrench className="size-4 shrink-0" /> },
          { href: '/llm/mcp', labelKey: 'navMcp', icon: <Plug className="size-4 shrink-0" /> },
        ],
      },
      {
        titleKey: 'sectionRbac',
        items: [
          { href: '/users', labelKey: 'navUsers', icon: <Users className="size-4 shrink-0" /> },
          { href: '/roles', labelKey: 'navRoles', icon: <Shield className="size-4 shrink-0" /> },
          {
            href: '/settings/auth',
            labelKey: 'navAuthSettings',
            icon: <KeyRound className="size-4 shrink-0" />,
            permission: 'system:auth_settings',
          },
          {
            href: '/settings/platform',
            labelKey: 'navPlatformSettings',
            icon: <SlidersHorizontal className="size-4 shrink-0" />,
            permission: 'system:platform_settings',
          },
        ],
      },
      {
        titleKey: 'sectionProfile',
        items: [{ href: '/profile', labelKey: 'navProfile', icon: <User className="size-4 shrink-0" /> }],
      },
      {
        titleKey: 'sectionPlatform',
        items: [
          { href: '/discord/commands', labelKey: 'navDiscord', icon: <Hash className="size-4 shrink-0" /> },
          { href: '/qq/settings', labelKey: 'navQq', icon: <MessageSquare className="size-4 shrink-0" /> },
        ],
      },
    ],
    [perms],
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-transparent', className)}>
      <div className={cn('shrink-0 border-b border-border p-4', collapsed && 'px-2 py-3')}>
        <Link
          href="/dashboard"
          onClick={() => onLinkClick?.()}
          className={cn('flex items-center gap-2 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring', collapsed && 'justify-center')}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-surface-xs ring-1 ring-border/35">
            <span className="text-sm font-bold">SB</span>
          </div>
          <span className={cn('font-semibold tracking-tight', collapsed && 'sr-only')}>{t('brand')}</span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain p-3" aria-label={t('navAriaLabel')}>
        {navSections.map((section, si) => (
          <div
            key={section.titleKey}
            role="group"
            aria-label={t(section.titleKey)}
            className={cn(si > 0 && 'mt-3 border-t border-border pt-3')}
          >
            <div
              className={cn(
                'px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]',
                collapsed && 'sr-only',
              )}
            >
              {t(section.titleKey)}
            </div>
            <div className="space-y-0.5">
              {section.items
                .filter((item) => !item.permission || perms.includes(item.permission))
                .map((item) => {
                  const isActive = navItemIsActive(pathname, item);
                  const label = t(item.labelKey);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? label : undefined}
                      onClick={() => onLinkClick?.()}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors duration-150 sm:text-sm',
                        collapsed && 'justify-center px-2',
                        isActive
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {item.icon}
                      <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      <SponsorSidebarFooter collapsed={collapsed} primaryUrl={sponsorPrimaryUrl ?? null} />
    </div>
  );
}

const segmentLabelKeys = [
  'dashboard',
  'job',
  'flow',
  'trigger',
  'schedule',
  'adapter',
  'onebot11',
  'satori',
  'milky',
  'wechat_mp',
  'chat',
  'step',
  'agents',
  'users',
  'roles',
  'profile',
  'onboarding',
  'llm',
  'vendors',
  'skills',
  'tools',
  'mcp',
  'discord',
  'qq',
  'settings',
  'auth',
  'platform',
] as const;

export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const tb = useTranslations('Breadcrumb');
  const tc = useTranslations('Common');

  if (segments.length === 0) return null;

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const decoded = decodeURIComponent(segment);
    const labelKey = segmentLabelKeys.includes(decoded as (typeof segmentLabelKeys)[number])
      ? (decoded as (typeof segmentLabelKeys)[number])
      : null;
    const label = labelKey ? tb(labelKey) : decoded;

    return { href, label };
  });

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm',
        className,
      )}
    >
      <Link href="/" className="shrink-0 hover:text-foreground">
        {tc('home')}
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
          {index === breadcrumbs.length - 1 ? (
            <span className="truncate text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="min-w-0 truncate hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
