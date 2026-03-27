import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getDashboardServerOverview } from '@/lib/runtime/runtime';
import type { DatabaseEngine } from '@/lib/database/db';
import type { KvBackendKind } from '@/lib/kv/kv-runtime';
import type { InstallPhase } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Server,
  Cpu,
  HardDrive,
  Database,
  KeyRound,
  Link2,
  CircleDot,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/shared/utils';

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function MiniStatCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 shadow-sm',
        className
      )}
    >
      {Icon ? (
        <Icon
          className="pointer-events-none absolute right-2 top-2 size-3.5 text-primary/30"
          aria-hidden
        />
      ) : null}
      <p className="pr-6 text-[10px] font-medium leading-none text-muted-foreground">{title}</p>
      <div className="mt-1.5 min-w-0 text-xs font-semibold leading-snug text-foreground">{children}</div>
    </div>
  );
}

export async function ServerOverviewSection() {
  const overview = await getDashboardServerOverview();
  const t = await getTranslations('DashboardPage');

  const engineLabels: Record<DatabaseEngine, string> = {
    libsql: t('serverOverview.engine.libsql'),
    'nodejs-sqlite': t('serverOverview.engine.nodejs-sqlite'),
    mysql: t('serverOverview.engine.mysql'),
  };

  const kvLabels: Record<KvBackendKind, string> = {
    'redis-rest': t('serverOverview.kvKind.redis-rest'),
    memory: t('serverOverview.kvKind.memory'),
  };

  const phaseLabels: Record<InstallPhase, string> = {
    no_database: t('serverOverview.phase.no_database'),
    needs_install: t('serverOverview.phase.needs_install'),
    needs_upgrade: t('serverOverview.phase.needs_upgrade'),
    installed: t('serverOverview.phase.installed'),
  };

  const publicUrl = overview.publicUrl.trim();

  let sqlValue: string;
  if (!overview.sql) {
    sqlValue = t('serverOverview.unset');
  } else {
    const eng = engineLabels[overview.databaseEngine];
    if (overview.sqlDialect === 'sqlite')
      sqlValue = `${eng} · ${t('serverOverview.dialect.sqlite')}`;
    else if (overview.sqlDialect === 'mysql')
      sqlValue = `${eng} · ${t('serverOverview.dialect.mysql')}`;
    else sqlValue = eng;
  }

  const migrationDisplay: ReactNode =
    overview.databaseEngine === 'mysql' ? (
      <span className="font-normal text-muted-foreground">{t('serverOverview.mysqlMigrationRow')}</span>
    ) : overview.lastAppliedMigration?.trim() ? (
      <span className="break-all font-mono text-[11px] font-normal">{overview.lastAppliedMigration}</span>
    ) : overview.sql ? (
      t('serverOverview.migrationNone')
    ) : (
      t('serverOverview.unset')
    );

  const phaseBadgeClass =
    overview.installPhase === 'installed'
      ? 'text-emerald-700 dark:text-emerald-400'
      : overview.installPhase === 'needs_upgrade'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-muted-foreground';

  const mem = overview.processMemory;
  const memValue: ReactNode =
    mem == null ? (
      t('serverOverview.memoryUnavailable')
    ) : (
      <span className="font-mono text-[11px] font-normal tabular-nums leading-relaxed">
        {t('serverOverview.memoryCompact', {
          heap: `${formatMb(mem.heapUsed)}/${formatMb(mem.heapTotal)}`,
          rss: formatMb(mem.rss),
          ext: formatMb(mem.external),
        })}
      </span>
    );

  const runtimeValue = (
    <span className="block font-mono text-[11px] font-normal tabular-nums leading-relaxed">
      <span className="text-foreground">{overview.nodeVersion}</span>
      <span className="text-muted-foreground"> · </span>
      <span>{overview.nodeEnv}</span>
    </span>
  );

  return (
    <section aria-labelledby="dash-server-overview-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 id="dash-server-overview-heading" className="text-sm font-semibold tracking-tight">
            {t('serverOverview.title')}
          </h2>
        </div>
        {overview.installPhase === 'needs_upgrade' ? (
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link href="/upgrade">{t('serverOverview.ctaUpgrade')}</Link>
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{t('serverOverview.desc')}</p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        <MiniStatCard title={t('serverOverview.rowRuntime')} icon={Cpu}>
          {runtimeValue}
        </MiniStatCard>
        <MiniStatCard title={t('serverOverview.rowMemory')} icon={HardDrive}>
          {memValue}
        </MiniStatCard>
        <MiniStatCard title={t('serverOverview.rowSqlEngine')} icon={Database}>
          <span className="break-words font-normal">{sqlValue}</span>
        </MiniStatCard>
        <MiniStatCard title={t('serverOverview.rowKv')} icon={KeyRound}>
          <span className="break-words font-normal">{kvLabels[overview.kv]}</span>
        </MiniStatCard>
        <MiniStatCard
          title={t('serverOverview.rowPublicUrl')}
          icon={Link2}
          className="col-span-2 md:col-span-3 xl:col-span-2"
        >
          {publicUrl ? (
            <span
              className="block break-all font-mono text-[11px] font-normal leading-snug text-foreground"
              title={publicUrl}
            >
              {publicUrl}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">{t('serverOverview.unset')}</span>
          )}
        </MiniStatCard>
        <MiniStatCard title={t('serverOverview.rowInstallPhase')} icon={CircleDot}>
          <span className={cn('font-normal', phaseBadgeClass)}>{phaseLabels[overview.installPhase]}</span>
        </MiniStatCard>
        <MiniStatCard title={t('serverOverview.rowLastMigration')} icon={GitBranch}>
          {migrationDisplay}
        </MiniStatCard>
      </div>
    </section>
  );
}
