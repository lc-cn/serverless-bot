'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/shared/utils';
import type {
  AdapterSetupGuideDefinition,
  SetupGuideBody,
  SetupGuideStepBorder,
} from '@/core/adapter-setup-guide';

const linkClass = 'text-primary underline underline-offset-2 hover:text-primary/90';

const codeInline = (chunks: React.ReactNode) => (
  <code className="rounded bg-muted px-2 py-1 text-xs">{chunks}</code>
);

const usageBoxClass = cn(
  'space-y-2 rounded-lg border border-border bg-muted/40 p-4',
  'dark:bg-muted/25',
);

const usageLead = 'font-medium text-foreground';

const STEP_BORDER: Record<SetupGuideStepBorder, string> = {
  blue: 'border-blue-500',
  indigo: 'border-indigo-500',
  green: 'border-green-500',
};

/** portal 目标由 namespace 决定，与文案中 <portal> 标签一致 */
const PORTAL_BY_NS: Record<string, string> = {
  discord: 'https://discord.com/developers/applications',
  qq: 'https://q.qq.com',
  onebot11: 'https://github.com/botuniverse/onebot-11',
  satori: 'https://satori.chat/zh-CN/introduction.html',
  milky: 'https://milky.ntqqrev.org/',
  wechat_mp: 'https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html',
};

function GuideStep({
  borderClassName,
  title,
  children,
}: {
  borderClassName: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('border-l-4 pl-4', borderClassName)}>
      <p className="font-medium">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

type GuideT = ReturnType<typeof useTranslations<'AdapterSetupGuide'>>;

/** 适配器定义的 messageKey 与 namespace 拼接，此处放宽 next-intl 路径类型 */
function keyNs(ns: string, suffix: string) {
  return `${ns}.${suffix}`;
}

function richPartsForNamespace(ns: string) {
  const portalHref = PORTAL_BY_NS[ns] ?? '#';
  return {
    code: codeInline,
    code1: codeInline,
    code2: codeInline,
    portal: (chunks: React.ReactNode) => (
      <a href={portalHref} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {chunks}
      </a>
    ),
    lead: (chunks: React.ReactNode) => <span className={usageLead}>{chunks}</span>,
    field: (chunks: React.ReactNode) => <strong className="text-foreground">{chunks}</strong>,
  };
}

function StepBody({ ns, body, t }: { ns: string; body: SetupGuideBody; t: GuideT }) {
  const parts = richPartsForNamespace(ns);
  const k = (suffix: string) => keyNs(ns, suffix);
  const tStr = (suffix: string) => t(k(suffix) as 'telegram.step1Title');
  const tRich = (suffix: string) => t.rich(k(suffix) as 'telegram.step1Body', parts);

  if (body.kind === 'plain') {
    return <p className="text-sm text-muted-foreground">{tStr(body.messageKey)}</p>;
  }
  if (body.kind === 'rich') {
    return <p className="text-sm text-muted-foreground">{tRich(body.messageKey)}</p>;
  }
  if (body.kind === 'beforeCodeAfter') {
    return (
      <p className="text-sm text-muted-foreground">
        {tStr(body.beforeKey)}
        <code className="mx-0.5 rounded bg-muted px-2 py-1 text-xs">{body.codeSample}</code>
        {tStr(body.afterKey)}
      </p>
    );
  }
  if (body.kind === 'paragraphAndCodeBlock') {
    return (
      <>
        <p className="text-sm text-muted-foreground">{tStr(body.paragraphKey)}</p>
        <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">{tStr(body.codeBlockMessageKey)}</code>
      </>
    );
  }
  if (body.kind === 'paragraphAndList') {
    return (
      <>
        <p className="text-sm text-muted-foreground">{tStr(body.paragraphKey)}</p>
        <ul className="mt-1 ml-4 list-disc text-sm text-muted-foreground">
          {body.listItemKeys.map((itemKey) => (
            <li key={itemKey}>{tStr(itemKey)}</li>
          ))}
        </ul>
      </>
    );
  }
  return null;
}

function SetupGuidePanel({ guide, t }: { guide: AdapterSetupGuideDefinition; t: GuideT }) {
  const ns = guide.namespace;
  const sectionTitle = t(keyNs(ns, guide.sectionTitleKey) as 'telegram.getTokenTitle');

  return (
    <>
      <h3 className="font-semibold">{sectionTitle}</h3>
      <div className="space-y-3">
        {guide.steps.map((step) => (
          <GuideStep key={`${ns}-${step.titleKey}`} borderClassName={STEP_BORDER[step.border]} title={t(keyNs(ns, step.titleKey) as 'telegram.step1Title')}>
            <StepBody ns={ns} body={step.body} t={t} />
          </GuideStep>
        ))}
      </div>
      {guide.tipKey ? (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle className="sr-only">{t('tipScreenReader')}</AlertTitle>
          <AlertDescription>{t(keyNs(ns, guide.tipKey) as 'telegram.tip')}</AlertDescription>
        </Alert>
      ) : null}
      {guide.warns?.map((w, i) => (
        <Alert key={`${ns}-warn-${i}`} className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/80">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="sr-only">{t('warnScreenReader')}</AlertTitle>
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            <p className="font-medium">{t(keyNs(ns, w.titleKey) as 'qq.warnTitle')}</p>
            <ul className="mt-1 ml-4 list-disc">
              {w.listKeys.map((lk) => (
                <li key={lk}>{t(keyNs(ns, lk) as 'qq.warnPassive')}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ))}
      {guide.usage ? (
        <>
          <Separator className="my-4" />
          <h3 className="font-semibold">{t('usageSectionTitle')}</h3>
          <div className={usageBoxClass}>
            {guide.usage.lines.map((line, idx) => {
              const path = keyNs(ns, line.key);
              if (line.kind === 'lead') {
                return (
                  <p key={`${line.key}-${idx}`} className="text-sm text-foreground/90">
                    {t.rich(path as 'telegram.usage1', { lead: richPartsForNamespace(ns).lead })}
                  </p>
                );
              }
              return (
                <p key={`${line.key}-${idx}`} className="ml-4 text-sm text-foreground/90">
                  {t.rich(path as 'discord.usage4BotToken', { field: richPartsForNamespace(ns).field })}
                </p>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}

/** 单平台适配器详情页：接入步骤与「在本系统中的用法」 */
export function AdapterSetupGuideCard({ guide }: { guide: AdapterSetupGuideDefinition }) {
  const t = useTranslations('AdapterSetupGuide');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-8 sm:pb-6">
        <SetupGuidePanel guide={guide} t={t} />
      </CardContent>
    </Card>
  );
}
