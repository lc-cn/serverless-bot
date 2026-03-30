'use client';

import { useTranslations } from 'next-intl';
import { HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/shared/utils';

export function SponsorSidebarFooter({
  collapsed,
  className,
  primaryUrl,
}: {
  collapsed: boolean;
  className?: string;
  primaryUrl: string | null;
}) {
  const t = useTranslations('Sponsor');

  if (!primaryUrl) return null;

  return (
    <div className={cn('shrink-0 border-t border-border p-3', className)}>
      <a
        href={primaryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:text-sm',
          collapsed && 'justify-center px-2',
        )}
        aria-label={t('openInNewTabAria')}
      >
        <HeartHandshake className="size-4 shrink-0 text-primary/80" aria-hidden />
        <span className={cn('truncate', collapsed && 'sr-only')}>{t('sidebarLink')}</span>
      </a>
    </div>
  );
}
