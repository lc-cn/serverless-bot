'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Server, Edit, Trash2 } from 'lucide-react';
import type { LlmMcpServer } from '@/types';

export default function LlmMcpPage() {
  const tu = useTranslations('Ui');
  const tm = useTranslations('Dashboard.llmMcp');
  const ta = useTranslations('Dashboard.agents');
  const [servers, setServers] = useState<LlmMcpServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/llm/mcp-servers');
        if (r.ok) {
          const d = await r.json();
          setServers(d.servers || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (sid: string) => {
    if (!confirm(tu('confirmDeleteMcp'))) return;
    const r = await fetch(`/api/llm/mcp-servers/${encodeURIComponent(sid)}`, { method: 'DELETE' });
    if (r.ok) setServers((prev) => prev.filter((s) => s.id !== sid));
    else alert(tu('deleteFailed'));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{tm('title')}</h1>
        <p className="text-muted-foreground">{tu('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tm('title')}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{tm('description')}</p>
        </div>
        <Link href="/llm/mcp/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {tm('newMcp')}
          </Button>
        </Link>
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{tm('empty')}</p>
            <Link href="/llm/mcp/new">
              <Button>{tm('add')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {servers.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-lg">{s.name}</CardTitle>
                <CardDescription className="font-mono text-xs break-all">{s.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="break-all" title={s.url}>
                  {ta('url')} {s.url}
                </p>
                <p>
                  {tm('transportLine', {
                    transport: s.transport,
                    headers: s.hasHeaders ? ta('apiKeySet') : tu('none'),
                  })}
                </p>
                <div className="flex gap-2 pt-2">
                  <Link href={`/llm/mcp/${encodeURIComponent(s.id)}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      {tu('edit')}
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {tu('delete')}
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
