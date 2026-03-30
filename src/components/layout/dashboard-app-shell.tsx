'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/shared/utils';
import { Breadcrumb, SidebarNav } from '@/components/layout/sidebar';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { HeartHandshake, LogOut, Menu, PanelLeft, PanelLeftClose, User } from 'lucide-react';

export type DashboardShellUser = {
  name: string;
  email?: string;
  image?: string | null;
};

function UserMenu({
  user,
  sponsorPrimaryUrl,
}: {
  user: DashboardShellUser;
  sponsorPrimaryUrl: string | null;
}) {
  const locale = useLocale();
  const tc = useTranslations('Common');
  const t = useTranslations('DashboardLayout');
  const ts = useTranslations('Sponsor');

  const initial =
    user.name
      .trim()
      .split(/\s/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="relative size-9 shrink-0 rounded-full p-0"
          aria-label={t('userMenu')}
        >
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="size-9 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {initial}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            {user.email ? (
              <p className="truncate text-xs leading-snug text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="size-4" />
            {t('goProfile')}
          </Link>
        </DropdownMenuItem>
        {sponsorPrimaryUrl ? (
          <DropdownMenuItem asChild>
            <a
              href={sponsorPrimaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
              aria-label={ts('openInNewTabAria')}
            >
              <HeartHandshake className="size-4" />
              {ts('supportProject')}
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => void signOut({ callbackUrl: `/${locale}/sign-in` })}
        >
          <LogOut className="size-4" />
          {tc('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'dashboard-sidebar-collapsed';

export function DashboardAppShell({
  children,
  user,
  sponsorPrimaryUrl = null,
}: {
  children: React.ReactNode;
  user: DashboardShellUser;
  sponsorPrimaryUrl?: string | null;
}) {
  const t = useTranslations('DashboardLayout');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-transparent">
      <aside
        className={cn(
          'dashboard-glass-panel hidden h-full min-h-0 shrink-0 flex-col border-r transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
        aria-label={t('sidebarLabel')}
      >
        <SidebarNav collapsed={collapsed} sponsorPrimaryUrl={sponsorPrimaryUrl} />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="dashboard-glass-header flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b px-3 py-2.5 sm:min-h-[3.25rem] sm:gap-x-3 sm:px-5 sm:py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            aria-label={t('openMenu')}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden shrink-0 md:inline-flex"
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeft className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>

          <div className="min-w-0 flex-1 py-0.5">
            <Breadcrumb className="mb-0" />
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <UserMenu user={user} sponsorPrimaryUrl={sponsorPrimaryUrl} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent px-4 pb-6 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          {children}
        </div>
      </main>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex h-full w-[min(20rem,calc(100vw-1.5rem))] max-w-[20rem] flex-col gap-0 border-r border-border p-0 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">{t('navigationMenu')}</SheetTitle>
          <SidebarNav
            collapsed={false}
            onLinkClick={() => setMobileOpen(false)}
            className="border-0 shadow-none"
            sponsorPrimaryUrl={sponsorPrimaryUrl}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
