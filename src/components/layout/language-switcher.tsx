'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('Common');

  const label = locale === 'zh-CN' ? t('localeZh') : t('localeEn');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1 px-2 font-normal text-muted-foreground hover:text-foreground sm:gap-1.5 sm:px-2.5"
          aria-label={t('language')}
        >
          <span className="text-sm tabular-nums">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8.5rem]">
        {routing.locales.map((l) => {
          const itemLabel = l === 'zh-CN' ? t('localeZh') : t('localeEn');
          const selected = l === locale;
          return (
            <DropdownMenuItem
              key={l}
              className="gap-2"
              onClick={() => {
                router.replace(pathname, { locale: l });
                router.refresh();
              }}
            >
              <span className="flex-1">{itemLabel}</span>
              {selected ? <Check className="size-4 shrink-0 opacity-80" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
