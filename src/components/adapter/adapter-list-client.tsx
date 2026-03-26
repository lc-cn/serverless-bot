"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

interface AdapterInfo {
  platform: string;
  name: string;
  description?: string;
  icon?: string;
}

interface AdapterItem extends AdapterInfo {
  botCount: number;
}

interface AdapterListClientProps {
  initialAdapters: AdapterItem[];
}

export function AdapterListClient({ initialAdapters }: AdapterListClientProps) {
  const t = useTranslations('Ui');
  const tDash = useTranslations('Dashboard.adapter');
  const [adapters] = useState<AdapterItem[]>(initialAdapters);

  return (
    <div>
      {adapters.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground mb-4">{t('emptyAdapters')}</div>
          <p className="text-sm text-muted-foreground">{t('emptyAdaptersHint')}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {adapters.map((adapter) => (
            <Card key={adapter.platform} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {adapter.icon ? (
                    <span className="shrink-0 text-xl leading-none" aria-hidden>
                      {adapter.icon}
                    </span>
                  ) : null}
                  <span>{adapter.name}</span>
                </CardTitle>
                {adapter.description ? <CardDescription className="mt-1.5">{adapter.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 pt-0">
                <p className="min-w-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {tDash('adapterBotCount', { count: adapter.botCount })}
                </p>
                <Link
                  href={`/adapter/${adapter.platform}`}
                  aria-label={`${tDash('configurePlatform')}: ${adapter.name}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-muted/60 hover:text-primary"
                >
                  {tDash('configurePlatform')}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
