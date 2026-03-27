import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { cn } from '@/lib/shared/utils';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Clock,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Workflow,
  Zap,
  CheckCircle2,
} from 'lucide-react';

function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  cta,
  className,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
  cta: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-5 shadow-surface-sm transition-all duration-300',
        'hover:-translate-y-1 hover:border-primary/35 hover:shadow-surface-md supports-[backdrop-filter]:backdrop-blur-sm',
        className,
      )}
    >
      <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 p-2.5 text-primary ring-1 ring-border/40 transition-all group-hover:from-primary/25 group-hover:to-primary/10">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight sm:text-base">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
        {cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

function ConsolePreview({
  previewTitle,
  previewFlowLabel,
  previewFlowStatus,
  previewAdapterLabel,
}: {
  previewTitle: string;
  previewFlowLabel: string;
  previewFlowStatus: string;
  previewAdapterLabel: string;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/95 via-card/90 to-muted/30 p-1 shadow-surface-lg ring-1 ring-border/30"
      aria-hidden
    >
      <div className="brand-gradient-line mb-0 w-[40%] opacity-90" />
      <div className="flex gap-0 rounded-b-xl bg-background/40 p-3">
        <div className="flex w-[28%] flex-col gap-1.5 border-r border-border/50 pr-2 pt-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-2 rounded-full bg-muted/80',
                i === 1 ? 'w-full bg-primary/25' : 'w-4/5',
              )}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2 pl-3 pt-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {previewTitle}
          </p>
          <div className="rounded-lg border border-border/50 bg-background/80 p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-foreground">{previewFlowLabel}</span>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400">
                {previewFlowStatus}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-2/3 rounded-full bg-muted" />
            <div className="mt-1.5 h-1.5 w-1/2 rounded-full bg-muted/70" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/25 bg-primary/5 px-2 py-1.5">
            <Bot className="size-3.5 shrink-0 text-primary" />
            <span className="text-[10px] text-muted-foreground">{previewAdapterLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function HomeLanding({
  signedIn,
  registrationEnabled,
}: {
  signedIn: boolean;
  registrationEnabled: boolean;
}) {
  const t = await getTranslations('HomePage');

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[min(85vh,620px)] w-[min(110vw,900px)] -translate-x-1/2 rounded-[50%] bg-primary/[0.09] blur-3xl" />
        <div className="absolute bottom-[10%] left-[-10%] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-5%] top-[28%] h-56 w-56 rounded-full bg-secondary blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent" />
      </div>

      <header className="home-rise relative z-20 border-b border-border/50 bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/55">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
          <span className="truncate text-sm font-semibold tracking-tight sm:text-base">{t('title')}</span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <LanguageSwitcher />
            {!signedIn ? (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                  <Link href="/sign-in">{t('ctaSignIn')}</Link>
                </Button>
                {registrationEnabled && (
                  <Button asChild size="sm" className="shadow-surface-sm">
                    <Link href="/sign-up">
                      <span className="hidden sm:inline">{t('ctaSignUp')}</span>
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard">
                  <span className="hidden sm:inline">{t('ctaDashboard')}</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pb-28 sm:pt-14 md:pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1fr_min(36rem,1fr)] lg:gap-16">
          <div className="home-rise home-rise-d1 text-center lg:text-left">
            <p className="mb-4 inline-flex max-w-[95vw] items-center rounded-full border border-border/80 bg-muted/35 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
              {t('heroBadge')}
            </p>
            <div className="brand-gradient-line mx-auto mb-5 w-24 lg:mx-0" />
            <h1 className="text-hero">{t('heroTitle')}</h1>
            <p className="text-hero-sub mx-auto mt-4 max-w-xl lg:mx-0 lg:max-w-lg">{t('heroSubtitle')}</p>
            <p className="mx-auto mt-3 max-w-lg text-xs font-medium text-primary/90 lg:mx-0 sm:text-sm">{t('heroHighlight')}</p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-start">
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-12 text-muted-foreground hover:text-foreground"
              >
                <Link href="/docs">
                  <BookOpen className="size-4" aria-hidden />
                  {t('ctaDocs')}
                </Link>
              </Button>
            </div>
            {!signedIn && registrationEnabled ? (
              <p className="mt-4 text-center text-[11px] text-muted-foreground sm:text-xs lg:text-left">{t('heroTrust')}</p>
            ) : null}
          </div>

          <div className="home-rise home-rise-d2 flex justify-center lg:justify-end">
            <ConsolePreview
              previewTitle={t('previewTitle')}
              previewFlowLabel={t('previewFlowLabel')}
              previewFlowStatus={t('previewFlowStatus')}
              previewAdapterLabel={t('previewAdapterLabel')}
            />
          </div>
        </section>

        <section className="home-rise home-rise-d3 mt-14 border-y border-border/50 bg-muted/20 py-8 sm:mt-20 sm:py-10">
          <div className="grid grid-cols-3 gap-4 divide-x divide-border/40 sm:gap-6">
            {[
              { v: t('stat1Value'), l: t('stat1Label') },
              { v: t('stat2Value'), l: t('stat2Label') },
              { v: t('stat3Value'), l: t('stat3Label') },
            ].map((s, i) => (
              <div key={i} className="px-2 text-center first:pl-0 last:pr-0 sm:px-4">
                <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">{s.v}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-rise home-rise-d3 mt-16 sm:mt-24">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t('capabilitiesTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t('capabilitiesDesc')}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              href="/adapter"
              icon={Settings}
              title={t('cardAdapterTitle')}
              description={t('cardAdapterDesc')}
              cta={t('cardCta')}
              className="sm:col-span-1"
            />
            <FeatureCard
              href="/flow"
              icon={Workflow}
              title={t('cardFlowTitle')}
              description={t('cardFlowDesc')}
              cta={t('cardCta')}
            />
            <FeatureCard
              href="/trigger"
              icon={Zap}
              title={t('cardTriggerTitle')}
              description={t('cardTriggerDesc')}
              cta={t('cardCta')}
            />
            <FeatureCard
              href="/agents"
              icon={Sparkles}
              title={t('cardAgentTitle')}
              description={t('cardAgentDesc')}
              cta={t('cardCta')}
            />
            <FeatureCard
              href="/schedule"
              icon={Clock}
              title={t('cardScheduleTitle')}
              description={t('cardScheduleDesc')}
              cta={t('cardCta')}
            />
            <FeatureCard
              href="/chat"
              icon={FlaskConical}
              title={t('cardSandboxTitle')}
              description={t('cardSandboxDesc')}
              cta={t('cardCta')}
            />
            <FeatureCard
              href="/docs"
              icon={Bot}
              title={t('cardDocsTitle')}
              description={t('cardDocsDesc')}
              cta={t('cardCta')}
              className="sm:col-span-2 lg:col-span-3 border-dashed border-primary/30"
            />
          </div>
        </section>

        <section className="home-rise home-rise-d4 mt-16 sm:mt-24">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">{t('stepsTitle')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">{t('stepsSubtitle')}</p>
          <ol className="relative mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3">
            <span
              className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
              aria-hidden
            />
            {[
              { n: '1', title: t('step1Title'), desc: t('step1Desc'), icon: MessageSquare },
              { n: '2', title: t('step2Title'), desc: t('step2Desc'), icon: Workflow },
              { n: '3', title: t('step3Title'), desc: t('step3Desc'), icon: Shield },
            ].map((step) => (
              <li key={step.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-surface-sm ring-2 ring-background">
                  <step.icon className="size-5 text-primary" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground sm:text-sm">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-rise home-rise-d4 mt-16 sm:mt-24">
          <h2 className="mb-6 text-center text-lg font-semibold sm:mb-8 sm:text-xl">{t('platformsTitle')}</h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { k: 'tg', label: t('platformTelegram') },
              { k: 'dc', label: t('platformDiscord') },
              { k: 'qq', label: t('platformQq') },
              { k: 'ob', label: t('platformOnebot11') },
              { k: 'sat', label: t('platformSatori') },
              { k: 'milk', label: t('platformMilky') },
              { k: 'wx', label: t('platformWechatMp') },
            ].map((p) => (
              <span
                key={p.k}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-sm"
              >
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                {p.label}
              </span>
            ))}
          </div>
        </section>

        <section className="home-rise home-rise-d5 mt-16 sm:mt-24">
          <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">{t('quickStart')}</h2>
          <p className="mx-auto mb-6 max-w-xl text-center text-xs text-muted-foreground sm:text-sm">{t('quickStartDesc')}</p>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-muted/25 shadow-inner">
            <pre className="overflow-x-auto p-4 text-left text-[11px] leading-relaxed text-muted-foreground sm:p-6 sm:text-xs md:text-sm">
              <code className="font-mono">
                {`${t('webhookFormatTitle')}
POST /api/webhook/{platform}/{bot_id}

${t('webhookExampleTitle')}
${t('webhookExamplePosts')}`}
              </code>
            </pre>
          </div>
        </section>

        {!signedIn && registrationEnabled ? (
          <section
            className="home-rise home-rise-d5 relative mt-20 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card/80 to-muted/60 p-8 shadow-surface-lg sm:mt-28 sm:p-10 md:p-12"
            aria-labelledby="home-cta-heading"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
            <div className="relative mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('ctaBandEyebrow')}</p>
              <h2 id="home-cta-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                {t('ctaBandTitle')}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('ctaBandSubtitle')}</p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 px-8 shadow-surface-md">
                  <Link href="/sign-up">
                    <UserPlus className="size-4" aria-hidden />
                    {t('ctaBandPrimary')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="h-12 px-8">
                  <Link href="/sign-in">{t('ctaBandSecondary')}</Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="home-rise home-rise-d5 mt-20 border-t border-border/50 pt-10 text-center sm:mt-24">
          <p className="text-xs text-muted-foreground sm:text-sm">{t('footerTagline')}</p>
          <Link
            href="/docs"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            {t('ctaDocs')}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </footer>
      </div>
    </main>
  );
}
