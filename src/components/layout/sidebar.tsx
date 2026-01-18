'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Settings, Workflow, Home, ChevronRight, Users, Shield, User, Briefcase, ListChecks, Zap, MessageSquare, Hash, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { href: '/', label: '首页', icon: <Home className="w-4 h-4" /> },
  { href: '/adapter', label: '适配器', icon: <Settings className="w-4 h-4" /> },
  { href: '/trigger', label: '触发器', icon: <Zap className="w-4 h-4" /> },
  { href: '/flow', label: '事件流转', icon: <Workflow className="w-4 h-4" /> },
  { href: '/job', label: '作业管理', icon: <Briefcase className="w-4 h-4" /> },
  { href: '/step', label: '步骤管理', icon: <ListChecks className="w-4 h-4" /> },
  { href: '/users', label: '用户管理', icon: <Users className="w-4 h-4" /> },
  { href: '/roles', label: '角色管理', icon: <Shield className="w-4 h-4" /> },
  { href: '/profile', label: '个人设置', icon: <User className="w-4 h-4" /> },
];

// 平台专属功能
const platformItems: NavItem[] = [
  { href: '/discord/commands', label: 'Discord 命令', icon: <Hash className="w-4 h-4" /> },
  { href: '/qq/settings', label: 'QQ 设置', icon: <MessageSquare className="w-4 h-4" /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">SB</span>
          </div>
          <span className="font-semibold">Serverless Bot</span>
        </Link>
      </div>

      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* 平台专属功能 */}
        <div className="pt-4 mt-4 border-t">
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            平台功能
          </div>
          {platformItems.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="destructive"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </Button>
      </div>
    </aside>
  );
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = decodeURIComponent(segment);

    return { href, label };
  });

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link href="/" className="hover:text-foreground">
        首页
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
          {index === breadcrumbs.length - 1 ? (
            <span className="text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
