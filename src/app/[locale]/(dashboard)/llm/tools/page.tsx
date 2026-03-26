'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wrench, Edit, Trash2 } from 'lucide-react';
import type { LlmTool } from '@/types';

export default function LlmToolsPage() {
  const tu = useTranslations('Ui');
  const tt = useTranslations('Dashboard.llmTools');
  const [tools, setTools] = useState<LlmTool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/llm/tools');
        if (r.ok) {
          const d = await r.json();
          setTools(d.tools || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (toolId: string) => {
    if (!confirm(tu('confirmDeleteTool'))) return;
    const r = await fetch(`/api/llm/tools/${encodeURIComponent(toolId)}`, { method: 'DELETE' });
    if (r.ok) setTools((prev) => prev.filter((x) => x.id !== toolId));
    else alert(tu('deleteFailed'));
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{tt('title')}</h1>
        <p className="text-muted-foreground">{tu('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tt('title')}</h1>
          <p className="text-muted-foreground mt-1">{tt('description')}</p>
        </div>
        <Link href="/llm/tools/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {tt('newTool')}
          </Button>
        </Link>
      </div>

      {tools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{tt('empty')}</p>
            <Link href="/llm/tools/new">
              <Button>{tt('create')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">{tool.id}</CardDescription>
                    {tool.description && (
                      <p className="text-sm text-muted-foreground mt-2">{tool.description}</p>
                    )}
                    {tool.stepCount != null && tool.stepCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {tt('implStepCount', { count: tool.stepCount })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/llm/tools/${encodeURIComponent(tool.id)}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(tool.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap max-h-40 overflow-auto">
                  {tool.definitionJson}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
