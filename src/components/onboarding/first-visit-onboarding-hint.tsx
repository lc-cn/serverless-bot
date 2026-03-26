'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Overlay } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shared/utils';
import { getOnboardingSection, type OnboardingSectionId } from '@/lib/onboarding/onboarding-registry';

const storageKey = (sectionId: OnboardingSectionId) => `onboarding_first_visit_hint_${sectionId}`;

type RegistryRow = {
  id: OnboardingSectionId;
  canAccess: boolean;
  progress?: { status: string };
};

export function FirstVisitOnboardingHint({ sectionId }: { sectionId: OnboardingSectionId }) {
  const def = getOnboardingSection(sectionId);
  const tf = useTranslations('Onboarding.firstVisit');
  const ts = useTranslations('Onboarding.sections');
  const [open, setOpen] = useState(false);

  const sectionTitle = ts(`${sectionId}.title` as 'overview.title');
  const sectionDescription = ts(`${sectionId}.description` as 'overview.description');

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey(sectionId), '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [sectionId]);

  useEffect(() => {
    if (!def) return;
    try {
      if (localStorage.getItem(storageKey(sectionId))) return;
    } catch {
      /* ignore */
    }

    let cancelled = false;
    (async () => {
      const r = await fetch('/api/onboarding/progress');
      if (!r.ok || cancelled) return;
      const d = (await r.json()) as { registry?: RegistryRow[] };
      const row = d.registry?.find((x) => x.id === sectionId);
      if (!row?.canAccess) return;
      const st = row.progress?.status ?? 'pending';
      if (st !== 'pending') return;
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [def, sectionId]);

  if (!def) return null;

  return (
    <Overlay isOpen={open} onClose={dismiss} title={`${tf('titlePrefix')}${sectionTitle}`}>
      <p className="text-sm text-muted-foreground mb-4">{sectionDescription}</p>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button type="button" variant="outline" onClick={dismiss}>
          {tf('dismissNever')}
        </Button>
        <Link
          href={`/onboarding/${sectionId}`}
          onClick={dismiss}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80',
          )}
        >
          {tf('openGuide')}
        </Link>
      </div>
    </Overlay>
  );
}
