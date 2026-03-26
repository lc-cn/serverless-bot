'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { BotListClient } from '@/components/bot/bot-list-client';
import { AdapterSetupGuideCard } from '@/components/adapter/adapter-setup-guide';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { BotConfig } from '@/types';
import { FormUISchema } from '@/core';

export type AdapterPlatformInfo = {
  name: string;
  description: string;
  icon?: string;
};

export function AdapterPlatformView({
  platform,
  adapterInfo,
  initialBots,
  botConfigSchema,
  guide,
}: {
  platform: string;
  adapterInfo: AdapterPlatformInfo;
  initialBots: BotConfig[];
  botConfigSchema?: FormUISchema;
  guide: AdapterSetupGuideDefinition | null;
}) {
  const tPlatform = useTranslations('Dashboard.adapterPlatform');
  const tUi = useTranslations('Ui');
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Link href="/adapter">
            <Button variant="outline" size="icon" aria-label={tUi('back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
              {adapterInfo.icon ? (
                <span className="shrink-0 text-2xl leading-none" aria-hidden>
                  {adapterInfo.icon}
                </span>
              ) : null}
              <span>{adapterInfo.name}</span>
            </h1>
            <p className="text-muted-foreground">{adapterInfo.description}</p>
          </div>
        </div>
        <Button
          type="button"
          className="shrink-0 self-start sm:self-center"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {tUi('addBot')}
        </Button>
      </div>

      {guide ? <AdapterSetupGuideCard guide={guide} /> : null}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{tPlatform('botManagement')}</h2>
        <BotListClient
          platform={platform}
          initialBots={initialBots}
          botConfigSchema={botConfigSchema}
          showTopAddBar={false}
          createOverlayOpen={createOpen}
          onCreateOverlayOpenChange={setCreateOpen}
        />
      </div>
    </div>
  );
}
