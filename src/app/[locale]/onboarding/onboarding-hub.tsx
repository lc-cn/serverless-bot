'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { countSectionPending } from '@/lib/onboarding/onboarding-sections';
import type { OnboardingSectionId } from '@/lib/onboarding/onboarding-registry';
import type { OnboardingSectionsState } from '@/lib/onboarding/onboarding-sections';

type RegistryRow = {
  id: OnboardingSectionId;
  title: string;
  description: string;
  routes: string[];
  canAccess: boolean;
  progress: { status: string; at?: number };
};

export function OnboardingHub() {
  const router = useRouter();
  const th = useTranslations('Onboarding.hub');
  const ts = useTranslations('Onboarding.sections');
  const [registry, setRegistry] = useState<RegistryRow[]>([]);
  const [sections, setSections] = useState<OnboardingSectionsState | null>(null);
  const [hubCompletedAt, setHubCompletedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/onboarding/progress');
    if (!r.ok) return;
    const d = await r.json();
    setRegistry(d.registry || []);
    setSections(d.sections || null);
    setHubCompletedAt(d.hubCompletedAt ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const finishHub = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/onboarding/complete', { method: 'POST' });
      if (r.ok) {
        setHubCompletedAt(Date.now());
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const pending = sections ? countSectionPending(sections) : 0;

  const statusLabel = (s: string) => {
    if (s === 'done') return th('statusDone');
    if (s === 'skipped') return th('statusSkipped');
    return th('statusPending');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{th('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{th('subtitle')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-muted-foreground">
            {pending === 0 ? th('pendingNone') : th('pendingSome', { count: pending })}
          </p>
          <Button type="button" disabled={busy || hubCompletedAt != null} onClick={() => void finishHub()}>
            {hubCompletedAt != null ? th('finishedCta') : th('finishCta')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {registry.map((row) => {
          const st = row.progress?.status ?? 'pending';
          const title = ts(`${row.id}.title` as 'overview.title');
          const description = ts(`${row.id}.description` as 'overview.description');
          return (
            <Card key={row.id} className={row.canAccess ? '' : 'opacity-60'}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{title}</CardTitle>
                  <span className="text-xs shrink-0 text-muted-foreground">{statusLabel(st)}</span>
                </div>
                <CardDescription className="text-xs line-clamp-3">{description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col gap-2">
                {row.canAccess ? (
                  <Link
                    href={`/onboarding/${row.id}`}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    {th('startSection')}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">{th('noPermission')}</p>
                )}
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {row.routes.join(' · ')}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
