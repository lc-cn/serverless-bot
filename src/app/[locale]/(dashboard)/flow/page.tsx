'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, UserPlus, Bell, Plus, Briefcase, Zap } from 'lucide-react';
import { Flow } from '@/types';
import { FirstVisitOnboardingHint } from '@/components/onboarding/first-visit-onboarding-hint';

type EventType = 'message' | 'request' | 'notice';

const eventIcons = {
  message: { icon: MessageSquare, color: 'text-blue-500' },
  request: { icon: UserPlus, color: 'text-green-500' },
  notice: { icon: Bell, color: 'text-orange-500' },
};

export default function FlowPage() {
  const t = useTranslations('Dashboard.flowHub');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [filter, setFilter] = useState<'all' | EventType>('all');

  const eventTypeConfig = useMemo(
    () =>
      ({
        message: { name: t('events.message'), ...eventIcons.message },
        request: { name: t('events.request'), ...eventIcons.request },
        notice: { name: t('events.notice'), ...eventIcons.notice },
      }) as const,
    [t],
  );

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      const res = await fetch('/api/flows');
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error('Failed to load flows:', error);
    }
  };

  const filteredFlows = flows.filter((flow) => filter === 'all' || flow.eventType === filter);

  const noFlowsMessage =
    filter === 'all'
      ? t('noFlows')
      : filter === 'message'
        ? t('noMessageFlows')
        : filter === 'request'
          ? t('noRequestFlows')
          : t('noNoticeFlows');

  return (
    <div>
      <FirstVisitOnboardingHint sectionId="automation" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          {t('all')} ({flows.length})
        </Button>
        {(Object.keys(eventTypeConfig) as EventType[]).map((type) => {
          const config = eventTypeConfig[type];
          const Icon = config.icon;
          const count = flows.filter((f) => f.eventType === type).length;
          return (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type)}
            >
              <Icon className="w-4 h-4 mr-1" />
              {config.name} ({count})
            </Button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {(Object.keys(eventTypeConfig) as EventType[]).map((type) => {
          const config = eventTypeConfig[type];
          const Icon = config.icon;
          return (
            <Link key={type} href={`/flow/${type}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-primary/10 ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {t('typedFlowLabel', { type: config.name })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('flowsCount', { count: flows.filter((f) => f.eventType === type).length })}
                        </div>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filteredFlows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">{noFlowsMessage}</p>
            <div className="flex gap-2">
              {filter === 'all' ? (
                <>
                  <Link href="/flow/message">
                    <Button variant="outline" size="sm">
                      {t('createMessageFlow')}
                    </Button>
                  </Link>
                  <Link href="/flow/request">
                    <Button variant="outline" size="sm">
                      {t('createRequestFlow')}
                    </Button>
                  </Link>
                  <Link href="/flow/notice">
                    <Button variant="outline" size="sm">
                      {t('createNoticeFlow')}
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href={`/flow/${filter}`}>
                  <Button variant="outline" size="sm">
                    {t('createFlow')}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFlows
            .sort((a, b) => b.priority - a.priority)
            .map((flow) => {
              const config = eventTypeConfig[flow.eventType as EventType];
              const Icon = config.icon;
              return (
                <Link key={flow.id} href={`/flow/${flow.eventType}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-4 h-4 ${config.color}`} />
                            <Badge variant="outline" className="text-xs">
                              {config.name}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {t('priority')}: {flow.priority}
                            </Badge>
                            {!flow.enabled && <Badge variant="secondary">{t('disabled')}</Badge>}
                          </div>
                          <CardTitle className="text-lg">{flow.name}</CardTitle>
                          {flow.description && (
                            <CardDescription className="mt-1">{flow.description}</CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          <span>{t('triggerCount', { count: flow.triggerIds?.length || 0 })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          <span>{t('pipelineCount', { count: flow.jobIds?.length || 0 })}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
