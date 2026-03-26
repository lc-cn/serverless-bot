'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, Edit, Trash2 } from 'lucide-react';
import type { LlmAgent } from '@/types';

export default function AgentsPage() {
  const t = useTranslations('Ui');
  const ta = useTranslations('Dashboard.agents');
  const [agents, setAgents] = useState<LlmAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/agents');
        if (r.ok) {
          const d = await r.json();
          setAgents(d.agents || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeleteAgent'))) return;
    const r = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    if (r.ok) setAgents((prev) => prev.filter((a) => a.id !== id));
    else alert(t('deleteFailed'));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{ta('title')}</h1>
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{ta('title')}</h1>
          <p className="text-muted-foreground mt-1">{ta('description')}</p>
        </div>
        <Link href="/agents/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {ta('newAgent')}
          </Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{ta('empty')}</p>
            <Link href="/agents/new">
              <Button>{ta('createFirst')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{a.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{a.id}</CardDescription>
                  </div>
                  <Badge variant="outline">{a.vendorKind}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {a.configuredModelId ? (
                  <p>
                    <span className="text-foreground/80">{ta('presetModel')}</span>
                    {a.configuredModelSummary ?? a.configuredModelId}
                  </p>
                ) : (
                  <p>
                    {ta('model')} {a.defaultModel}
                  </p>
                )}
                <p className="truncate" title={a.apiBaseUrl}>
                  {ta('url')} {a.apiBaseUrl}
                </p>
                <p>
                  {ta('apiKey')} {a.hasApiKey ? ta('apiKeySet') : ta('apiKeyUnset')}
                </p>
                <p>
                  {ta('countsLine', {
                    skills: a.skillIds?.length ?? 0,
                    tools: a.toolIds?.length ?? 0,
                    mcp: a.mcpServerIds?.length ?? 0,
                  })}
                </p>
                <div className="flex gap-2 pt-2">
                  <Link href={`/agents/${encodeURIComponent(a.id)}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      {t('edit')}
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
