'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/shared/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

const options = [
  { value: 'light' as const, icon: Sun },
  { value: 'dark' as const, icon: Moon },
  { value: 'system' as const, icon: Monitor },
];

/**
 * SSR 与首次客户端渲染共用的触发器图标，禁止依赖 theme（否则会与 next-themes
 * 在客户端抢先解析的 theme 不一致，触发 hydration 报错）。
 */
const PLACEHOLDER_TRIGGER_ICON = Monitor;

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const tc = useTranslations('Common');

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = !theme || theme === 'system' ? 'system' : theme;
  const TriggerIcon = !mounted
    ? PLACEHOLDER_TRIGGER_ICON
    : active === 'system'
      ? Monitor
      : active === 'dark'
        ? Moon
        : Sun;

  /** 与 SSR 一致：未挂载时视作 theme 未解析，仅「跟随系统」显示勾选 */
  const themeForSelection = mounted ? theme : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-9 text-muted-foreground hover:text-foreground', className)}
          aria-label={mounted ? tc('theme') : undefined}
          disabled={!mounted}
          aria-hidden={!mounted ? true : undefined}
        >
          <TriggerIcon className="size-[1.125rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10.5rem]">
        {options.map(({ value, icon: Icon }) => {
          const selected =
            value === 'system'
              ? !themeForSelection || themeForSelection === 'system'
              : themeForSelection === value;
          const label =
            value === 'light' ? tc('themeLight') : value === 'dark' ? tc('themeDark') : tc('themeSystem');
          return (
            <DropdownMenuItem
              key={value}
              className="gap-2"
              disabled={!mounted}
              onClick={() => mounted && setTheme(value)}
            >
              <Icon className="size-4 shrink-0 opacity-70" aria-hidden />
              <span className="flex-1">{label}</span>
              {selected ? <Check className="size-4 shrink-0 opacity-80" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
