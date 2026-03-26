'use client';

import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StepType } from '@/types';
import { STEP_TYPE_GROUPS } from '@/lib/steps/step-type-groups';
import {
  MessageSquare,
  Globe,
  Database,
  Variable,
  CheckCircle,
  XCircle,
  GitBranch,
  Timer,
  Calculator,
  FileText,
  Filter,
  Zap,
  Code,
  Sparkles,
  Braces,
  Binary,
  Link2,
} from 'lucide-react';

const stepTypeIcons: Record<StepType, typeof MessageSquare> = {
  send_message: MessageSquare,
  call_api: Globe,
  call_bot: Zap,
  hardcode: FileText,
  log: Code,
  get_user_info: Database,
  get_group_info: Database,
  set_variable: Variable,
  conditional: GitBranch,
  delay: Timer,
  random_reply: Calculator,
  template_message: FileText,
  forward_message: MessageSquare,
  handle_request: CheckCircle,
  recall_message: XCircle,
  extract_data: Filter,
  llm_agent: Sparkles,
  parse_json: Braces,
  stringify_json: Braces,
  base64_encode: Binary,
  base64_decode: Binary,
  url_encode: Link2,
  url_decode: Link2,
};

export default function StepPage() {
  const t = useTranslations('StepTypes');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>

      <div className="space-y-12">
        {STEP_TYPE_GROUPS.map((group) => (
          <section key={group.labelKey}>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">
              {t(`groups.${group.labelKey}`)}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.types.map((type) => {
                const Icon = stepTypeIcons[type];
                return (
                  <Card key={type}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{t(`labels.${type}`)}</CardTitle>
                          <code className="text-xs text-muted-foreground">{type}</code>
                        </div>
                      </div>
                      <CardDescription className="mt-2">{t(`descriptions.${type}`)}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
