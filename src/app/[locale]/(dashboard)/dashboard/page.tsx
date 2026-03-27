import type { ComponentType } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import type { ExtendedSession } from '@/types/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Bot,
  Briefcase,
  Clock,
  Layers,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { ServerOverviewSection } from '@/components/dashboard/server-overview-section';

function StatLinkCard({
  href,
  title,
  description,
  value,
  sub,
  linkLabel,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  value: number;
  sub?: string;
  linkLabel: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}) {
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-surface-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium leading-none">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

function HealthRow({ label, active, total, href }: { label: string; active: number; total: number; href: string }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Link href={href} className="font-medium hover:text-primary hover:underline">
          {label}
        </Link>
        <span className="tabular-nums text-xs text-muted-foreground">
          {active}/{total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = (await auth()) as ExtendedSession | null;
  const userId = session?.user?.id;
  if (!userId) return null;

  const t = await getTranslations('DashboardPage');

  const [bots, flows, triggers, jobs, schedules, agents] = await Promise.all([
    storage.getBots(userId),
    storage.listFlowsForUser(userId),
    storage.listTriggersForUser(userId),
    storage.listJobsForUser(userId),
    storage.listScheduledTasksForUser(userId),
    storage.getLlmAgentsByOwner(userId),
  ]);

  const flowsOn = flows.filter((f) => f.enabled).length;
  const triggersOn = triggers.filter((x) => x.enabled).length;
  const botsOn = bots.filter((b) => b.enabled).length;
  const schedOn = schedules.filter((s) => s.enabled).length;
  const jobsOn = jobs.filter((j) => j.enabled).length;

  const linkLabel = t('cardLink');

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
      </div>

      <ServerOverviewSection />

      <section aria-labelledby="dash-stats-heading">
        <h2 id="dash-stats-heading" className="sr-only">
          {t('statsHeading')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatLinkCard
            href="/adapter"
            title={t('cardBotsTitle')}
            description={t('cardBotsDesc')}
            value={bots.length}
            sub={t('cardBotsSub', { on: botsOn, total: bots.length })}
            linkLabel={linkLabel}
            icon={Bot}
          />
          <StatLinkCard
            href="/flow"
            title={t('cardFlowsTitle')}
            description={t('cardFlowsDesc')}
            value={flows.length}
            sub={t('cardFlowsSub', { on: flowsOn, total: flows.length })}
            linkLabel={linkLabel}
            icon={Workflow}
          />
          <StatLinkCard
            href="/trigger"
            title={t('cardTriggersTitle')}
            description={t('cardTriggersDesc')}
            value={triggers.length}
            sub={t('cardTriggersSub', { on: triggersOn, total: triggers.length })}
            linkLabel={linkLabel}
            icon={Zap}
          />
          <StatLinkCard
            href="/job"
            title={t('cardJobsTitle')}
            description={t('cardJobsDesc')}
            value={jobs.length}
            sub={t('cardJobsSub', { on: jobsOn, total: jobs.length })}
            linkLabel={linkLabel}
            icon={Briefcase}
          />
          <StatLinkCard
            href="/schedule"
            title={t('cardSchedulesTitle')}
            description={t('cardSchedulesDesc')}
            value={schedules.length}
            sub={t('cardSchedulesSub', { on: schedOn, total: schedules.length })}
            linkLabel={linkLabel}
            icon={Clock}
          />
          <StatLinkCard
            href="/agents"
            title={t('cardAgentsTitle')}
            description={t('cardAgentsDesc')}
            value={agents.length}
            linkLabel={linkLabel}
            icon={Sparkles}
          />
        </div>
      </section>

      <section aria-labelledby="dash-health-heading">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" aria-hidden />
              <CardTitle className="text-lg">{t('healthTitle')}</CardTitle>
            </div>
            <CardDescription>{t('healthDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <HealthRow label={t('healthFlows')} active={flowsOn} total={flows.length} href="/flow" />
            <HealthRow label={t('healthTriggers')} active={triggersOn} total={triggers.length} href="/trigger" />
            <HealthRow label={t('healthBots')} active={botsOn} total={bots.length} href="/adapter" />
            <HealthRow label={t('healthSchedules')} active={schedOn} total={schedules.length} href="/schedule" />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">{t('quickSandbox')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/docs">{t('quickDocs')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/onboarding">{t('quickOnboarding')}</Link>
        </Button>
      </section>
    </div>
  );
}
